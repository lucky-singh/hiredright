"""Match scoring — a pure function, deliberately free of ORM and request state.

Kept pure so it is table-testable and so the ranking formula can be replaced
without touching the view layer. `search.py` is responsible for turning
querysets into the plain dicts this module consumes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

# How much a claim is worth as it ages. A programmer who last produced ADaM
# datasets in 2016 is a weaker match than one who did it last year, but not a
# non-match — hence a floor rather than a cliff.
RECENCY_FULL_CREDIT_YEARS = 2
RECENCY_FLOOR = 0.55
RECENCY_DECAY_PER_YEAR = 0.05

# Proficiency 1–4 (see profiles.Proficiency) mapped to a multiplier. An
# unanswered proficiency is treated as "working knowledge" rather than zero, so
# candidates are not punished for skipping the optional inline detail.
PROFICIENCY_WEIGHT = {1: 0.6, 2: 0.85, 3: 1.0, 4: 1.15}
PROFICIENCY_DEFAULT = 0.85

OPTIONAL_ACTIVITY_WEIGHT = 0.35


@dataclass(frozen=True)
class Claim:
    """Flattened ActivityClaim. No ORM objects cross this boundary."""

    activity_code: str
    proficiency: int | None = None
    last_used_year: int | None = None
    variants: frozenset[str] = frozenset()


@dataclass(frozen=True)
class Query:
    required_activity_codes: frozenset[str] = frozenset()
    optional_activity_codes: frozenset[str] = frozenset()
    # {activity_code: {acceptable variants}} — e.g. {"sdtm-implementation-guide": {"3.3"}}
    required_variants: dict[str, frozenset[str]] = field(default_factory=dict)


@dataclass(frozen=True)
class MatchResult:
    score: float
    meets_requirements: bool
    matched_required: tuple[str, ...]
    missing_required: tuple[str, ...]
    matched_optional: tuple[str, ...]

    @property
    def score_pct(self) -> int:
        return round(self.score * 100)


def _recency_multiplier(last_used_year: int | None, *, today: date) -> float:
    """Full credit for recent work, gentle linear decay, hard floor.

    A missing `last_used_year` gets full credit: the field is optional in the
    builder, and penalising an omission would push candidates toward guessing.
    """
    if last_used_year is None:
        return 1.0
    years_ago = today.year - last_used_year
    if years_ago <= RECENCY_FULL_CREDIT_YEARS:
        return 1.0
    decayed = 1.0 - (years_ago - RECENCY_FULL_CREDIT_YEARS) * RECENCY_DECAY_PER_YEAR
    return max(RECENCY_FLOOR, decayed)


def _claim_weight(claim: Claim, *, today: date) -> float:
    proficiency = PROFICIENCY_WEIGHT.get(claim.proficiency, PROFICIENCY_DEFAULT)
    return proficiency * _recency_multiplier(claim.last_used_year, today=today)


def _satisfies_variants(claim: Claim, required: frozenset[str] | None) -> bool:
    """A variant requirement is met if the claim overlaps it at all.

    Overlap rather than superset: a recruiter asking for SDTM IG 3.3 is asking
    "can you work to 3.3", not "you must have used only 3.3".
    """
    if not required:
        return True
    return bool(claim.variants & required)


def score(
    claims: list[Claim] | tuple[Claim, ...],
    query: Query,
    *,
    today: date | None = None,
) -> MatchResult:
    """Score one candidate against one search.

    Returns 0.0 with ``meets_requirements=False`` when any required activity is
    absent, but still reports which ones matched — recruiters consistently want
    to see near-misses rather than have them silently dropped, and the caller
    decides whether to filter or merely rank them lower.

    Callers must pass only scorable claims (ACTIVITY / PROFICIENCY). TRAIT items
    are excluded upstream in ``search.py``; see ``taxonomy.ClaimType.scorable``.
    """
    today = today or date.today()
    by_code = {c.activity_code: c for c in claims}

    matched_required: list[str] = []
    missing_required: list[str] = []
    required_weight = 0.0

    for code in sorted(query.required_activity_codes):
        claim = by_code.get(code)
        if claim is None or not _satisfies_variants(claim, query.required_variants.get(code)):
            missing_required.append(code)
            continue
        matched_required.append(code)
        required_weight += _claim_weight(claim, today=today)

    matched_optional: list[str] = []
    optional_weight = 0.0
    for code in sorted(query.optional_activity_codes - query.required_activity_codes):
        claim = by_code.get(code)
        if claim is None:
            continue
        matched_optional.append(code)
        optional_weight += _claim_weight(claim, today=today) * OPTIONAL_ACTIVITY_WEIGHT

    meets = not missing_required
    if not meets:
        final = 0.0
    else:
        # Normalise against the best achievable score for THIS query so results
        # are comparable across searches of different sizes.
        max_required = len(query.required_activity_codes) * max(PROFICIENCY_WEIGHT.values())
        max_optional = (
            len(query.optional_activity_codes - query.required_activity_codes)
            * max(PROFICIENCY_WEIGHT.values())
            * OPTIONAL_ACTIVITY_WEIGHT
        )
        denominator = max_required + max_optional
        final = (required_weight + optional_weight) / denominator if denominator else 0.0

    return MatchResult(
        score=round(min(final, 1.0), 4),
        meets_requirements=meets,
        matched_required=tuple(matched_required),
        missing_required=tuple(missing_required),
        matched_optional=tuple(matched_optional),
    )
