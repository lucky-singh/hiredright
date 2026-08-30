"""Turning search queries into scored, ranked candidate results.

This module owns all ORM access for matching; `scoring.py` stays pure. The split
means the ranking formula can be unit-tested with plain dicts and changed without
risk of accidentally introducing an N+1 query.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from django.db.models import Count, Q

from profiles.models import ActivityClaim, CandidateProfile
from taxonomy.models import ClaimType

from .scoring import Claim, MatchResult, Query, score


@dataclass(frozen=True)
class RankedCandidate:
    profile_id: int
    result: MatchResult


def _prefilter(query: Query):
    """Narrow to plausible profiles in SQL before scoring anything in Python.

    Only the required *codes* are enforced here. Variant requirements
    (e.g. SDTM IG 3.3) are checked during scoring instead: expressing JSONB
    overlap portably in the ORM is awkward, and the candidate set is already
    small by this point, so the simpler correct path wins.

    The claim filter mirrors the one in `search_candidates` — same claim types,
    same `is_active`. If the two disagreed, a profile could pass the prefilter on
    a TRAIT claim and then be reported by the scorer as missing that very
    requirement.
    """
    qs = CandidateProfile.objects.filter(is_searchable=True, open_to_opportunities=True)

    required = query.required_activity_codes
    if required:
        qs = (
            qs.filter(_claim_matches(required))
            .annotate(
                n_required=Count(
                    "claims__activity__code",
                    filter=_claim_matches(required),
                    distinct=True,
                )
            )
            .filter(n_required=len(required))
        )
    elif query.optional_activity_codes:
        # No hard requirements, so "matches at least one optional code" is the
        # only thing keeping this off a full scan of every searchable profile.
        qs = qs.filter(_claim_matches(query.optional_activity_codes))
    else:
        return qs.none()

    return qs.distinct()


def _claim_matches(codes) -> Q:
    """A scorable, live claim on one of `codes`."""
    return Q(
        claims__activity__code__in=codes,
        claims__activity__claim_type__in=ClaimType.scorable(),
        claims__activity__is_active=True,
    )


def search_candidates(
    query: Query,
    *,
    limit: int = 50,
    include_near_misses: bool = False,
    today: date | None = None,
) -> list[RankedCandidate]:
    """Score and rank candidates against `query`.

    `include_near_misses` surfaces profiles that fail a variant requirement but
    otherwise match, because recruiters generally want to see "has SDTM IG 3.2,
    not 3.3" rather than have that candidate vanish silently.
    """
    today = today or date.today()

    profile_ids = list(_prefilter(query).values_list("id", flat=True))
    if not profile_ids:
        return []

    # Only scorable claim types contribute to ranking. TRAIT items are
    # self-reported dispositions that every candidate asserts, so including them
    # would flatten the score distribution without adding information.
    relevant_codes = query.required_activity_codes | query.optional_activity_codes
    claim_rows = (
        ActivityClaim.objects.filter(
            profile_id__in=profile_ids,
            activity__code__in=relevant_codes,
            activity__claim_type__in=ClaimType.scorable(),
            activity__is_active=True,
        )
        .select_related("activity")
        .values(
            "profile_id",
            "activity__code",
            "proficiency",
            "last_used_year",
            "variants",
        )
    )

    by_profile: dict[int, list[Claim]] = {pid: [] for pid in profile_ids}
    for row in claim_rows:
        by_profile[row["profile_id"]].append(
            Claim(
                activity_code=row["activity__code"],
                proficiency=row["proficiency"],
                last_used_year=row["last_used_year"],
                variants=frozenset(row["variants"] or ()),
            )
        )

    ranked = [
        RankedCandidate(profile_id=pid, result=score(claims, query, today=today))
        for pid, claims in by_profile.items()
    ]

    if not include_near_misses:
        ranked = [r for r in ranked if r.result.meets_requirements]

    ranked.sort(key=lambda r: (-r.result.score, r.profile_id))
    return ranked[:limit]
