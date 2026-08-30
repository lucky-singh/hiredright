# Matching Engine & Scoring Specification

> Mathematical formulation, ranking algorithms, parameter weights, and test specifications for the HireRight candidate matching engine.

---

## Table of Contents

- [Overview](#overview)
- [Data Structures](#data-structures)
- [Scoring Formula & Mathematics](#scoring-formula--mathematics)
  - [1. Individual Claim Weight](#1-individual-claim-weight)
  - [2. Proficiency Weighting](#2-proficiency-weighting)
  - [3. Recency Decay Function](#3-recency-decay-function)
  - [4. Variant Overlap Satisfaction](#4-variant-overlap-satisfaction)
  - [5. Optional Activity Weighting](#5-optional-activity-weighting)
  - [6. Score Normalization](#6-score-normalization)
- [Requirement Enforcement & Near-Miss Diagnostics](#requirement-enforcement--near-miss-diagnostics)
- [Search Pipeline (`search.py`)](#search-pipeline-searchpy)
  - [SQL Pre-filtering](#sql-pre-filtering)
  - [Candidate Hydration & Execution](#candidate-hydration--execution)
- [Test Suite & Edge Cases](#test-suite--edge-cases)

---

## Overview

The HireRight matching engine ranks candidates against recruiter search specifications using a deterministic algorithm. Unlike stochastic keyword matchers or opaque embedding similarities, HireRight's scoring:
- Is **fully explainable**: Every point earned traces to a specific activity claim, verified proficiency, and recency factor.
- Is **query-normalized**: Scores from a 2-parameter search and a 15-parameter search both map to $[0.0, 1.0]$ and are directly comparable.
- Is **split cleanly between SQL pre-filtering and pure Python ranking**: Eliminating ORM overhead and $N+1$ query issues.

---

## Data Structures

The scoring core operates strictly on frozen Python dataclasses defined in `matching.scoring`:

```python
@dataclass(frozen=True)
class Claim:
    activity_code: str
    proficiency: int | None = None
    last_used_year: int | None = None
    variants: frozenset[str] = frozenset()

@dataclass(frozen=True)
class Query:
    required_activity_codes: frozenset[str] = frozenset()
    optional_activity_codes: frozenset[str] = frozenset()
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
```

---

## Scoring Formula & Mathematics

### 1. Individual Claim Weight

The base weight $W(c)$ of a single scorable claim $c$ is the product of its **Proficiency Weight** $P(c)$ and its **Recency Multiplier** $R(c)$:

$$W(c) = P(c) \times R(c)$$

---

### 2. Proficiency Weighting

Proficiency levels (1–4) reflect candidate depth:

| Level | Name | Multiplier ($P$) | Semantic Meaning |
| :---: | :--- | :---: | :--- |
| **1** | `EXPOSED` | `0.60` | Basic familiarity; requires supervision. |
| **2** | `WORKING` | `0.85` | Working knowledge; independent practitioner. |
| **3** | `PROFICIENT` | `1.00` | Standard benchmark; fluent practitioner. |
| **4** | `EXPERT` | `1.15` | Subject matter expert; can lead and mentor others. |
| *None* | *(Omitted)* | `0.85` | Default fallback when candidate omits optional level. |

> **Design Note**: Unanswered proficiencies default to `0.85` (`WORKING`) rather than `0.0`. Candidates are not penalized for skipping optional detail chips in the builder.

---

### 3. Recency Decay Function

Clinical standards evolve over time (e.g. CDISC IG versions, regulatory guidance). The recency multiplier $R(c)$ applies a gentle linear decay beyond a grace period, with a guaranteed non-zero floor:

$$\Delta y = \text{current\_year} - \text{last\_used\_year}$$

$$
R(c) = \begin{cases}
1.0 & \text{if } \text{last\_used\_year is None} \\
1.0 & \text{if } \Delta y \le 2 \\
\max\left(0.55, \, 1.0 - (\Delta y - 2) \times 0.05\right) & \text{if } \Delta y > 2
\end{cases}
$$

#### Recency Parameter Constants
- `RECENCY_FULL_CREDIT_YEARS = 2` (Work done within the last 2 years earns 100% credit).
- `RECENCY_DECAY_PER_YEAR = 0.05` (5% reduction per year past grace period).
- `RECENCY_FLOOR = 0.55` (Hard floor; experience from 10+ years ago retains at least 55% credit).

```
Recency Multiplier R(c)
1.00 ───┬───────\
        │        \
0.80 ───┤         \
        │          \
0.55 ───┤           \──────────────────── (Floor: 0.55)
        │
 0.0 ───┴───┬───┬───┬───┬───┬───┬───┬───>
        0   2   4   6   8  10  12  14  Years Ago (Δy)
```

---

### 4. Variant Overlap Satisfaction

For versioned standards (such as CDISC SDTM IG, ADaM IG, or Define-XML), queries specify required variants. A claim satisfies the variant requirement if there is **any overlap** between the candidate's claimed variants and the recruiter's requested set:

$$\text{Satisfied}(c, V_{\text{req}}) = (V_{\text{claim}} \cap V_{\text{req}} \neq \emptyset)$$

*Example*: If a recruiter asks for SDTM IG `["3.3"]` and the candidate claims `["3.2", "3.3"]`, the requirement is satisfied.

---

### 5. Optional Activity Weighting

Optional activities contribute additional credit to distinguish between multiple qualifying candidates, scaled by a fixed discount factor:

$$\text{OPTIONAL\_ACTIVITY\_WEIGHT} = 0.35$$

To prevent duplicate scoring, optional activities that also appear in the required set are removed:

$$O_{\text{effective}} = O \setminus R$$

---

### 6. Score Normalization

To ensure scores are directly comparable across searches of differing sizes (e.g. 3 requirements vs. 15 requirements), the combined raw weight is divided by the maximum possible theoretical score achievable for that specific query:

$$\text{Denominator} = |R| \times \max(P) + |O_{\text{effective}}| \times \max(P) \times 0.35$$

where $\max(P) = 1.15$ (the Expert proficiency multiplier).

$$\text{RawScore} = \frac{\sum_{r \in R} W(r) + \sum_{o \in O_{\text{effective}}} W(o) \times 0.35}{\text{Denominator}}$$

$$\text{FinalScore} = \min\left(1.0, \, \text{round}(\text{RawScore}, 4)\right)$$

$$\text{ScorePct} = \text{round}(\text{FinalScore} \times 100)$$

---

## Requirement Enforcement & Near-Miss Diagnostics

If a candidate fails to claim even **one** required activity code, or fails the variant requirement for a required code:

1. `meets_requirements` is set to `False`.
2. `score` is set to `0.0`.
3. Diagnostic tuples are populated:
   - `matched_required`: Subsets of requirements the candidate did satisfy.
   - `missing_required`: Exact codes that were absent or failed variant match.
   - `matched_optional`: Optional activities satisfied.

This enables recruiters to toggle `include_near_misses=True` to review candidates who possess 9 out of 10 requirements.

---

## Search Pipeline (`search.py`)

### SQL Pre-filtering

Candidate profiles are pre-filtered at the database level before loading claim records:

```python
def _claim_matches(codes) -> Q:
    """A scorable, live claim on one of `codes`."""
    return Q(
        claims__activity__code__in=codes,
        claims__activity__claim_type__in=ClaimType.scorable(),
        claims__activity__is_active=True,
    )


def _prefilter(query: Query):
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
        qs = qs.filter(_claim_matches(query.optional_activity_codes))
    else:
        return qs.none()

    return qs.distinct()
```

Two properties of this are load-bearing:

- **The claim predicate matches the hydration query exactly** — same claim types,
  same `is_active`. If the two disagreed, a profile could be selected on a TRAIT
  claim and then reported by the scorer as *missing* the requirement it was
  selected for, which surfaces as an inexplicable near-miss.
- **An unconstrained query returns nothing, not everyone.** With no required
  codes, matching at least one optional code is the only thing keeping this off a
  full scan of every searchable profile — all of which would score `0.0` anyway.
  With neither, the queryset is empty by construction.

### Candidate Hydration & Execution

1. Extracts candidate profile IDs from `_prefilter`.
2. Fetches only active, scorable (`claim_type in ["activity", "proficiency"]`) claims for the relevant codes using `ActivityClaim.objects.filter(...)`.
3. Converts database rows into `Claim` dataclasses.
4. Invokes pure `score()` for each candidate.
5. Sorts descending by `(-r.result.score, r.profile_id)`.
6. Truncates to `limit` (default: 50).

---

## Test Suite & Edge Cases

Two suites, split along the same seam as the code. `matching/tests/test_scoring.py`
is pure and needs no database; `matching/tests/test_search.py` covers the ORM half
and does.

### Pure scoring — `test_scoring.py`

| Test Group | Scenario Tested | Expected Behavior |
| :--- | :--- | :--- |
| **Requirements** | All required codes present | `meets_requirements=True`, `score > 0` |
| **Requirements** | Missing 1 of 2 required codes | `meets_requirements=False`, `score=0.0`, diagnostics populated |
| **Requirements** | Empty query | `meets_requirements=True`, `score=0.0` (no division by zero) |
| **Variants** | Overlapping variants (`{"3.2", "3.3"}` vs `{"3.3"}`) | `meets_requirements=True` |
| **Variants** | Non-overlapping variants (`{"3.1.2"}` vs `{"3.3"}`) | `meets_requirements=False`, listed in `missing_required` |
| **Recency** | Missing `last_used_year` | Full credit ($1.0$), equal to current year |
| **Recency** | Recent (2025) vs Stale (2010) | Recent scores strictly higher than stale |
| **Recency** | Ancient experience (1990) | Decay capped at floor ($>0.55$) |
| **Proficiency** | Monotonic ordering (Levels 1 to 4) | Strictly ascending score values |
| **Proficiency** | Omitted proficiency | Matches working knowledge (Level 2 = 0.85) |
| **Optional** | Adding optional matches | Strictly increases score |
| **Optional** | Code in both required & optional | Deduplicated; not double-counted |
| **Normalisation**| All expert claims with optional items | Capped at exactly `1.0` |
| **Normalisation**| Small query (1 item) vs Large query (6 items) | Comparable percentage scores |

### Search pipeline — `test_search.py`

| Test Group | Scenario Tested | Expected Behavior |
| :--- | :--- | :--- |
| **Prefilter scope** | Profile holds every required code | Returned |
| **Prefilter scope** | Profile missing one required code | Filtered out in SQL |
| **Prefilter scope** | `is_searchable=False` / not open to opportunities | Excluded |
| **Layer agreement** | Only claim is a TRAIT on the required code | Not selected at all, near-misses included |
| **Layer agreement** | Only claim is on an inactive activity | Not selected at all |
| **Unconstrained** | No required and no optional codes | Empty result, not the whole pool |
| **Unconstrained** | Optional-only query, profile matches nothing | Excluded |
| **Variants** | Claimed `3.2` against required `3.3` | Dropped by default; surfaced with `include_near_misses=True` |
| **Ranking** | Expert/recent vs exposed/stale | Ordered by descending score |
| **Ranking** | More matches than `limit` | Truncated to `limit` |
