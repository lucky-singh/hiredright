"""Table-driven tests for the pure scoring function.

Deliberately exercises the edge cases that would otherwise only surface as
"the rankings look a bit odd" once real profiles exist.
"""

from datetime import date

import pytest

from matching.scoring import Claim, Query, score

TODAY = date(2026, 8, 28)


def claim(code, *, prof=None, year=None, variants=()):
    return Claim(
        activity_code=code,
        proficiency=prof,
        last_used_year=year,
        variants=frozenset(variants),
    )


class TestRequirements:
    def test_all_required_present_meets(self):
        r = score([claim("a"), claim("b")], Query(required_activity_codes=frozenset({"a", "b"})), today=TODAY)
        assert r.meets_requirements
        assert r.matched_required == ("a", "b")
        assert r.missing_required == ()
        assert r.score > 0

    def test_missing_required_scores_zero_but_reports_partial(self):
        r = score([claim("a")], Query(required_activity_codes=frozenset({"a", "b"})), today=TODAY)
        assert not r.meets_requirements
        assert r.score == 0.0
        # The near-miss detail is the point: recruiters want to see what matched.
        assert r.matched_required == ("a",)
        assert r.missing_required == ("b",)

    def test_empty_query_scores_zero_without_dividing_by_zero(self):
        r = score([claim("a")], Query(), today=TODAY)
        assert r.meets_requirements
        assert r.score == 0.0


class TestVariants:
    Q_33 = Query(
        required_activity_codes=frozenset({"sdtm-ig"}),
        required_variants={"sdtm-ig": frozenset({"3.3"})},
    )

    def test_overlapping_variant_satisfies(self):
        r = score([claim("sdtm-ig", variants={"3.2", "3.3"})], self.Q_33, today=TODAY)
        assert r.meets_requirements

    def test_non_overlapping_variant_fails_requirement(self):
        r = score([claim("sdtm-ig", variants={"3.1.2", "3.2"})], self.Q_33, today=TODAY)
        assert not r.meets_requirements
        assert r.missing_required == ("sdtm-ig",)

    def test_claim_without_variants_fails_variant_requirement(self):
        r = score([claim("sdtm-ig")], self.Q_33, today=TODAY)
        assert not r.meets_requirements


class TestRecency:
    Q = Query(required_activity_codes=frozenset({"a"}))

    def test_missing_year_is_not_penalised(self):
        """last_used_year is optional in the builder; an omission must not be
        treated as stale, or candidates are pushed into guessing."""
        assert score([claim("a", year=None)], self.Q, today=TODAY).score == \
               score([claim("a", year=2026)], self.Q, today=TODAY).score

    def test_recent_beats_stale(self):
        recent = score([claim("a", year=2025)], self.Q, today=TODAY).score
        stale = score([claim("a", year=2010)], self.Q, today=TODAY).score
        assert recent > stale

    def test_decay_has_a_floor(self):
        """Very old experience is worth less, never nothing."""
        ancient = score([claim("a", year=1990)], self.Q, today=TODAY)
        assert ancient.meets_requirements
        assert ancient.score > 0.4


class TestProficiency:
    Q = Query(required_activity_codes=frozenset({"a"}))

    def test_higher_proficiency_scores_higher(self):
        scores = [score([claim("a", prof=p)], self.Q, today=TODAY).score for p in (1, 2, 3, 4)]
        assert scores == sorted(scores)

    def test_unset_proficiency_treated_as_working_knowledge(self):
        assert score([claim("a")], self.Q, today=TODAY).score == \
               score([claim("a", prof=2)], self.Q, today=TODAY).score


class TestOptional:
    def test_optional_matches_raise_score(self):
        q = Query(
            required_activity_codes=frozenset({"a"}),
            optional_activity_codes=frozenset({"b"}),
        )
        with_opt = score([claim("a"), claim("b")], q, today=TODAY).score
        without = score([claim("a")], q, today=TODAY).score
        assert with_opt > without

    def test_code_in_both_required_and_optional_not_double_counted(self):
        q = Query(
            required_activity_codes=frozenset({"a"}),
            optional_activity_codes=frozenset({"a"}),
        )
        r = score([claim("a")], q, today=TODAY)
        assert r.matched_optional == ()
        assert r.score <= 1.0


class TestNormalisation:
    def test_score_never_exceeds_one(self):
        """Expert proficiency carries a >1.0 weight, so the cap is load-bearing."""
        q = Query(
            required_activity_codes=frozenset({"a", "b"}),
            optional_activity_codes=frozenset({"c"}),
        )
        r = score(
            [claim("a", prof=4, year=2026), claim("b", prof=4, year=2026), claim("c", prof=4, year=2026)],
            q,
            today=TODAY,
        )
        assert r.score == 1.0

    def test_scores_comparable_across_query_sizes(self):
        small = score([claim("a", prof=3)], Query(required_activity_codes=frozenset({"a"})), today=TODAY)
        large = score(
            [claim(c, prof=3) for c in "abcdef"],
            Query(required_activity_codes=frozenset(set("abcdef"))),
            today=TODAY,
        )
        assert small.score == pytest.approx(large.score, abs=0.01)

    def test_other_skills_isolated(self):
        q = Query(required_activity_codes=frozenset({"req1"}), optional_activity_codes=frozenset({"opt1"}))
        claims = [
            claim("req1", prof=3),
            claim("opt1", prof=3),
            claim("extra1", prof=3),
            claim("extra2", prof=3)
        ]
        r = score(claims, q, today=TODAY)
        assert r.other_skills == ("extra1", "extra2")
