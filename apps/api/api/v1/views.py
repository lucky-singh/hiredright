"""API v1 views — the profile builder and recruiter search.

The builder is optimised for a single dense payload (see `BuilderPayloadSerializer`)
so the UI never blocks on a network round-trip mid-flow. Writes are debounced
batches of claim deltas, upserted atomically.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from matching.scoring import Query
from matching.search import search_candidates
from profiles.models import ActivityClaim, BuilderProgress, CandidateProfile
from taxonomy.models import Activity, ClaimType, CompetencyArea, Function

from .permissions import HasRecruiterSearchScope, IsRecruiterUser
from .serializers import (
    BuilderPayloadSerializer,
    BuilderProgressSerializer,
    CandidateSearchSerializer,
    ClaimBatchSerializer,
    FunctionListSerializer,
    SkillSerializer,
)


class FunctionListView(APIView):
    """GET /api/v1/functions/ — list all active functions to select from."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        functions = Function.objects.filter(is_active=True).order_by("sort_order", "label")
        serializer = FunctionListSerializer(functions, many=True)
        return Response(serializer.data)


class SkillListView(APIView):
    """GET /api/v1/skills/ — the searchable skill vocabulary, for recruiter search.

    Deliberately separate from `BuilderView`: that endpoint is candidate-scoped
    (it creates a `CandidateProfile` and returns that candidate's own claims), so
    a recruiter UI reading it would both acquire a profile row and pull data it
    has no use for.

    Only scorable claim types are listed. A TRAIT code passed to search matches
    nobody — `matching.search._prefilter` filters on `ClaimType.scorable()` — so
    offering traits as search chips would hand recruiters a guaranteed-empty
    query with no visible reason. `include_traits=1` opts back in for callers
    that want the full vocabulary to display rather than to search on.

    Query params:
        function        Function code. Scopes both the results and the `areas`
                        reported on each skill.
        q               Free-text match on label, code or help text. Works
                        without `function`, for cross-function lookup.
        include_traits  Include TRAIT items. Default false.
    """

    permission_classes = [IsAuthenticated]

    TRUTHY = {"1", "true", "yes", "on"}

    def get(self, request):
        function_code = request.query_params.get("function") or ""
        query = (request.query_params.get("q") or "").strip()
        include_traits = (
            request.query_params.get("include_traits", "").lower() in self.TRUTHY
        )

        skills = Activity.objects.filter(is_active=True)
        if not include_traits:
            skills = skills.filter(claim_type__in=ClaimType.scorable())

        if function_code:
            skills = skills.filter(competency_areas__function__code=function_code)

        if query:
            skills = skills.filter(
                Q(label__icontains=query)
                | Q(code__icontains=query)
                | Q(help_text__icontains=query)
            )

        # Without this prefetch, serializing `areas` is one query per skill —
        # ~150 for a single function. Scoping the prefetch to the requested
        # function also keeps each chip labelled with the area the recruiter is
        # actually browsing, rather than an area from some other function that
        # happens to reuse the same activity.
        areas = CompetencyArea.objects.select_related("function")
        if function_code:
            areas = areas.filter(function__code=function_code)

        skills = (
            skills.prefetch_related(Prefetch("competency_areas", queryset=areas))
            .distinct()
            .order_by("sort_order", "label")
        )

        serializer = SkillSerializer(skills, many=True)
        return Response({"count": len(serializer.data), "results": serializer.data})


class BuilderView(APIView):
    """GET /api/v1/builder/{function_code}/ — the single fetch powering the builder."""

    permission_classes = [IsAuthenticated]

    def get(self, request, function_code: str):
        function = get_object_or_404(Function, code=function_code, is_active=True)
        profile = CandidateProfile.objects.get_or_create(user=request.user)[0]

        claims = ActivityClaim.objects.filter(
            profile=profile,
            activity__competency_areas__function=function,
        ).select_related("activity")

        progress = BuilderProgress.objects.filter(
            profile=profile, function=function
        ).first()

        payload = BuilderPayloadSerializer(
            {
                "function": function,
                "claims": claims,
                "progress": progress,
                "years_experience": self._primary_years(profile, function),
            }
        )
        return Response(payload.data)

    @staticmethod
    def _primary_years(profile: CandidateProfile, function: Function):
        cf = profile.functions.filter(function=function).first()
        return cf.years_experience if cf else None


class ClaimBatchView(APIView):
    """POST /api/v1/builder/claims/ — debounced autosave of claim deltas."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ClaimBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deltas = serializer.validated_data["claims"]

        activities = self._resolve_activities(deltas)
        self._check_variants(deltas, activities)

        profile = CandidateProfile.objects.get_or_create(user=request.user)[0]
        synced = self._apply(profile, deltas, activities)
        return Response({"status": "success", "synced_count": synced})

    @staticmethod
    def _resolve_activities(deltas: list[dict]) -> dict[str, Activity]:
        """Every code in the batch must exist and be active.

        Skipping unknown codes would make the autosave report success while
        quietly discarding a candidate's answer — the one failure mode this flow
        exists to prevent. A stale client is better told.
        """
        codes = [d["activity_code"] for d in deltas]
        activities = {
            a.code: a for a in Activity.objects.filter(code__in=codes, is_active=True)
        }
        unknown = [c for c in codes if c not in activities]
        if unknown:
            raise ValidationError(
                {"claims": f"Unknown or inactive activity code(s): {', '.join(sorted(set(unknown)))}."}
            )
        return activities

    @staticmethod
    def _check_variants(deltas: list[dict], activities: dict[str, Activity]) -> None:
        """Variants must be a subset of what the activity actually offers.

        `ActivityClaim.clean()` enforces this, but the upsert below goes through
        `update_or_create`, which never calls it — so without this check a client
        could store "3.9" against SDTM IG and poison every later variant search.
        """
        errors: dict[str, str] = {}
        for delta in deltas:
            if not delta["claimed"]:
                continue
            claimed_variants = delta.get("variants") or []
            if not claimed_variants:
                continue
            activity = activities[delta["activity_code"]]
            allowed = set(activity.variants or [])
            if not allowed:
                errors[activity.code] = "This activity does not define variants."
                continue
            unknown = sorted(set(claimed_variants) - allowed)
            if unknown:
                errors[activity.code] = (
                    f"Unknown variant(s): {', '.join(unknown)}. "
                    f"Allowed: {', '.join(sorted(allowed))}."
                )
        if errors:
            raise ValidationError({"claims": errors})

    @staticmethod
    @transaction.atomic
    def _apply(
        profile: CandidateProfile,
        deltas: list[dict],
        activities: dict[str, Activity],
    ) -> int:
        synced = 0
        for delta in deltas:
            activity = activities[delta["activity_code"]]

            if not delta["claimed"]:
                deleted, _ = ActivityClaim.objects.filter(
                    profile=profile, activity=activity
                ).delete()
                synced += deleted
                continue

            ActivityClaim.objects.update_or_create(
                profile=profile,
                activity=activity,
                defaults={
                    "proficiency": delta.get("proficiency"),
                    "years_experience": delta.get("years_experience"),
                    "last_used_year": delta.get("last_used_year"),
                    "variants": delta.get("variants") or [],
                },
            )
            synced += 1
        return synced


class BuilderProgressView(APIView):
    """PUT /api/v1/builder/progress/ — resume state, persisted server-side."""

    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = BuilderProgressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        profile = CandidateProfile.objects.get_or_create(user=request.user)[0]

        # Keyed on profile alone: BuilderProgress is a OneToOne, so including
        # `function` in the lookup would miss the existing row whenever the
        # candidate switches function and then fail the uniqueness constraint on
        # insert. The function is part of what gets written, not what is matched.
        progress, _ = BuilderProgress.objects.update_or_create(
            profile=profile,
            defaults={
                "function": data["function"],
                "completed_area_codes": data.get("completed_area_codes", []),
                "last_area_code": data.get("last_area_code", ""),
            },
        )
        return Response(BuilderProgressSerializer(progress).data)


class CandidateSearchView(APIView):
    """POST /api/v1/search/ — recruiter matching, for services and for people.

    Two ways in, and no third: an OAuth2 client-credentials token carrying the
    recruiter search scope (service-to-service), or a logged-in user flagged
    `is_recruiter` (the recruiter web UI). Plain authentication is deliberately
    not enough — this endpoint reads across the entire candidate pool, so an
    ordinary candidate's JWT must not open it.

    Candidate PII is excluded from results — only profile_id and match
    diagnostics are returned.
    """

    permission_classes = [HasRecruiterSearchScope | IsRecruiterUser]

    def post(self, request):
        serializer = CandidateSearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        query = Query(
            required_activity_codes=frozenset(data["required_activity_codes"]),
            optional_activity_codes=frozenset(data["optional_activity_codes"]),
            required_variants={
                code: frozenset(variants)
                for code, variants in data["required_variants"].items()
            },
        )

        ranked = search_candidates(
            query,
            limit=data["limit"],
            include_near_misses=data["include_near_misses"],
        )

        results = [
            {
                "profile_id": r.profile_id,
                "score": r.result.score,
                "score_pct": r.result.score_pct,
                "meets_requirements": r.result.meets_requirements,
                "matched_required": list(r.result.matched_required),
                "missing_required": list(r.result.missing_required),
                "matched_optional": list(r.result.matched_optional),
            }
            for r in ranked
        ]
        return Response({"count": len(results), "results": results})
