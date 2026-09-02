"""API v1 views — the profile builder and recruiter search.

The builder is optimised for a single dense payload (see `BuilderPayloadSerializer`)
so the UI never blocks on a network round-trip mid-flow. Writes are debounced
batches of claim deltas, upserted atomically.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from .serializers import SearchResponseSerializer
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from matching.scoring import Query
from matching.search import search_candidates
from profiles.models import ActivityClaim, BuilderProgress, CandidateProfile
from taxonomy.models import Activity, ClaimType, CompetencyArea, Role

from .permissions import HasRecruiterSearchScope, IsRecruiterUser
from .serializers import (
    BuilderPayloadSerializer,
    BuilderProgressSerializer,
    CandidateSearchSerializer,
    ClaimBatchSerializer,
    RoleListSerializer,
    SkillSerializer,
)


from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

class RoleListView(APIView):
    """GET /api/v1/roles/ — list all active functions to select from."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=RoleListSerializer(many=True))
    @method_decorator(cache_page(60 * 60 * 24)) # cache for 24 hours
    def get(self, request):
        roles = Role.objects.filter(is_active=True).order_by("sort_order", "label")
        serializer = RoleListSerializer(roles, many=True)
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
        function        Role code. Scopes both the results and the `areas`
                        reported on each skill.
        q               Free-text match on label, code or help text. Works
                        without `function`, for cross-function lookup.
        include_traits  Include TRAIT items. Default false.
    """

    permission_classes = [IsAuthenticated]

    TRUTHY = {"1", "true", "yes", "on"}

    @extend_schema(
        parameters=[
            OpenApiParameter("role", OpenApiTypes.STR, description="Role code to filter by"),
            OpenApiParameter("q", OpenApiTypes.STR, description="Search query for labels or codes"),
            OpenApiParameter("include_traits", OpenApiTypes.BOOL, description="Include TRAIT items"),
        ],
        responses={200: SkillSerializer(many=True)}
    )
    @method_decorator(cache_page(60 * 60 * 24)) # cache for 24 hours
    def get(self, request):
        role_code = request.query_params.get("role") or ""
        query = (request.query_params.get("q") or "").strip()
        include_traits = (
            request.query_params.get("include_traits", "").lower() in self.TRUTHY
        )

        skills = Activity.objects.filter(is_active=True)
        if not include_traits:
            skills = skills.filter(claim_type__in=ClaimType.scorable())

        if role_code:
            skills = skills.filter(competency_areas__role__code=role_code)

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
        areas = CompetencyArea.objects.select_related("role")
        if role_code:
            areas = areas.filter(role__code=role_code)

        skills = (
            skills.prefetch_related(Prefetch("competency_areas", queryset=areas))
            .distinct()
            .order_by("sort_order", "label")
        )

        serializer = SkillSerializer(skills, many=True)
        return Response({"count": len(serializer.data), "results": serializer.data})


class BuilderView(APIView):
    """GET /api/v1/builder/{role_code}/ — the single fetch powering the builder."""

    permission_classes = [IsAuthenticated]

    def get(self, request, role_code: str):
        role = get_object_or_404(Role, code=role_code, is_active=True)
        profile = CandidateProfile.objects.get_or_create(user=request.user)[0]

        claims = ActivityClaim.objects.filter(
            profile=profile,
            activity__competency_areas__role=role,
        ).select_related("activity")

        progress = BuilderProgress.objects.filter(
            profile=profile, role=role
        ).first()

        payload = BuilderPayloadSerializer(
            {
                "role": role,
                "claims": claims,
                "progress": progress,
                "years_experience": self._primary_years(profile, role),
            }
        )
        return Response(payload.data)

    @staticmethod
    def _primary_years(profile: CandidateProfile, role: Role):
        cf = profile.roles.filter(role=role).first()
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
                    "is_ai_inferred": False,
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
                "role": data["role"],
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

    @extend_schema(
        request=CandidateSearchSerializer,
        responses={200: SearchResponseSerializer},
        description="Search for candidates matching specific skill requirements."
    )
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

        all_codes = set(query.required_activity_codes) | set(query.optional_activity_codes)
        for r in ranked:
            all_codes.update(r.result.other_skills)
        activities = Activity.objects.filter(code__in=all_codes).prefetch_related("competency_areas__role")
        skills_by_code = {
            act["code"]: act
            for act in SkillSerializer(activities, many=True).data
        }

        def enrich_skill(c, result_obj, is_missing=False):
            base = skills_by_code[c].copy()
            if not is_missing and c in getattr(result_obj, 'claims_dict', {}):
                claim = result_obj.claims_dict[c]
                base["proficiency"] = claim.proficiency
                base["years_experience"] = claim.years_experience
                base["last_used_year"] = claim.last_used_year
            return base

        results = [
            {
                "profile_id": r.profile_id,
                "score": r.result.score,
                "score_pct": r.result.score_pct,
                "meets_requirements": r.result.meets_requirements,
                "matched_required": [enrich_skill(c, r.result) for c in r.result.matched_required if c in skills_by_code],
                "missing_required": [enrich_skill(c, r.result, is_missing=True) for c in r.result.missing_required if c in skills_by_code],
                "matched_optional": [enrich_skill(c, r.result) for c in r.result.matched_optional if c in skills_by_code],
                "other_skills": [enrich_skill(c, r.result) for c in getattr(r.result, 'other_skills', ()) if c in skills_by_code],
            }
            for r in ranked
        ]
        return Response({"count": len(results), "results": results})

from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from profiles.tasks import parse_resume_task

class ResumeUploadView(APIView):
    """POST /api/v1/builder/resume/ — upload a resume to MinIO and trigger Celery."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        return Response({"detail": "Send a POST request with a 'resume' file to upload your CV."})

    def post(self, request):
        if "resume" not in request.FILES:
            return Response({"detail": "No resume file provided."}, status=status.HTTP_400_BAD_REQUEST)

        profile = CandidateProfile.objects.get_or_create(user=request.user)[0]
        resume_file = request.FILES["resume"]
        role_code = request.data.get("roleCode")
        role = get_object_or_404(Role, code=role_code, is_active=True)
        
        # Build meaningful filename
        from profiles.models import CandidateResume
        from django.core.files.base import ContentFile
        import re
        
        name_parts = filter(None, [request.user.first_name, request.user.last_name])
        full_name = "_".join(name_parts) if any([request.user.first_name, request.user.last_name]) else "Candidate"
        clean_name = re.sub(r'[^A-Za-z0-9_-]', '', full_name)
        new_filename = f"{clean_name}_{role.code}_Resume.pdf"
        
        resume_obj, created = CandidateResume.objects.update_or_create(
            profile=profile, role=role,
            defaults={"file": None} # We will set file next to trigger storage
        )
        # Save file directly which handles overwriting or appending hashes across users
        resume_obj.file.save(new_filename, resume_file)
        
        # Also store to profile for backward compatibility with old references if needed
        profile.resume.save(new_filename, resume_file)
        profile.save()

        # Trigger Celery background task
        task = parse_resume_task.delay(profile.pk, role_code)

        return Response({"detail": "Resume uploaded successfully, processing started.", "task_id": task.id}, status=status.HTTP_202_ACCEPTED)

from celery.result import AsyncResult

class ResumeTaskStatusView(APIView):
    """GET /api/v1/profile/resume/status/<task_id>/ — Check celery task status"""
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        res = AsyncResult(task_id)
        # res.result contains the return value of the task if successful, or Exception if failed
        result_data = str(res.result) if res.result else None
        return Response({
            "task_id": task_id,
            "status": res.status,
            "result": result_data
        })
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from profiles.models import CandidateProfile, ActivityClaim

class CandidateProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # We don't really have a rich profile, but we have user.first_name, etc.
        data = {
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone_number": getattr(user, "phone_number", ""),
            "is_recruiter": getattr(user, 'is_recruiter', False),
            "claims": []
        }
        
        try:
            profile = CandidateProfile.objects.get(user=user)
            if profile.resume:
                data["resume"] = profile.resume.url
                
            # Fetch all claims and role-specific resumes
            claims = ActivityClaim.objects.filter(profile=profile).select_related('activity').prefetch_related('activity__competency_areas__role')
            
            from profiles.models import BuilderProgress, CandidateResume
            progresses = BuilderProgress.objects.filter(profile=profile).select_related('role')
            role_resumes = {cr.role.code: cr.file.url for cr in CandidateResume.objects.filter(profile=profile) if cr.file}
            
            # Use dictionary to maintain uniqueness while preserving order
            user_roles = {}
            for p in progresses:
                user_roles[p.role.code] = p.role.label
                
            # Also include any roles from CandidateResume
            resumes = CandidateResume.objects.filter(profile=profile).select_related('role')
            for r in resumes:
                if r.role.code not in user_roles:
                    user_roles[r.role.code] = r.role.label
                    
            # Fallback: if they have claims that aren't covered by ANY role in user_roles
            # (e.g. they abandoned the builder before clicking Next so no BuilderProgress was saved),
            # we must add at least one role so the claim isn't orphaned.
            # We ONLY add a role if the claim is completely uncovered, which prevents shared
            # skills (like "Python") from spawning phantom roles when they are already covered
            # by a role the user is actively building.
            for claim in claims:
                areas = list(claim.activity.competency_areas.all())
                if not areas:
                    continue
                # Check if this claim is already covered by a role in user_roles
                covered = any(area.role and area.role.code in user_roles for area in areas)
                if not covered:
                    # Not covered! Add the role of its first area so it has somewhere to live.
                    primary = areas[0]
                    if primary.role:
                        user_roles[primary.role.code] = primary.role.label
                        
            data["roles"] = [{"code": code, "label": label, "resume": role_resumes.get(code)} for code, label in user_roles.items()]
            
            # Format claims
            claims_data = []
            for claim in claims:
                areas = list(claim.activity.competency_areas.all())
                if not areas:
                    claims_data.append({
                        "activity_code": claim.activity.code,
                        "activity_label": claim.activity.label,
                        "proficiency": claim.proficiency,
                        "category": "General",
                        "category_sort_order": 999,
                        "role_code": None,
                        "is_ai_inferred": claim.is_ai_inferred,
                        "years_experience": str(claim.years_experience) if claim.years_experience else None,
                        "last_used_year": claim.last_used_year
                    })
                    continue
                
                for area in areas:
                    # If this claim belongs to a role the user is actively building, include it.
                    # This prevents roles from showing up just because they share common skills,
                    # but ensures shared skills appear under all active roles they belong to.
                    if area.role and area.role.code in user_roles:
                        claims_data.append({
                            "activity_code": claim.activity.code,
                            "activity_label": claim.activity.label,
                            "proficiency": claim.proficiency,
                            "category": area.label,
                            "category_sort_order": area.sort_order,
                            "role_code": area.role.code,
                            "is_ai_inferred": claim.is_ai_inferred,
                            "years_experience": str(claim.years_experience) if claim.years_experience else None,
                            "last_used_year": claim.last_used_year
                        })
            data["claims"] = claims_data
                
        except CandidateProfile.DoesNotExist:
            pass
            
        return Response(data)

from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import connection

class HealthCheckView(APIView):
    """
    Lightweight health check endpoint for Kubernetes readiness/liveness probes.
    Pings the database to ensure the backend is fully operational.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, *args, **kwargs):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return Response({"status": "ok", "database": "connected"})
        except Exception as e:
            return Response({"status": "error", "database": "disconnected", "details": str(e)}, status=503)
