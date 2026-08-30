"""Tests for the ORM half of matching — the SQL pre-filter.

`test_scoring.py` covers the ranking maths with no database. What can only be
tested here is whether the pre-filter and the pure scorer agree about which
claims exist: if they disagree, a profile passes the filter and is then reported
as missing the very requirement it was selected for.
"""

import pytest

from matching.scoring import Query
from matching.search import search_candidates
from profiles.models import ActivityClaim, CandidateProfile

pytestmark = pytest.mark.django_db


@pytest.fixture
def make_profile(db):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    counter = iter(range(1000))

    def _make(*, searchable=True, open_to=True, claims=()):
        n = next(counter)
        user = User.objects.create_user(email=f"c{n}@example.com")
        profile = CandidateProfile.objects.create(
            user=user, is_searchable=searchable, open_to_opportunities=open_to
        )
        for activity, variants in claims:
            ActivityClaim.objects.create(
                profile=profile,
                activity=activity,
                proficiency=3,
                last_used_year=2026,
                variants=list(variants),
            )
        return profile

    return _make


class TestPrefilterScope:
    def test_a_profile_with_every_required_code_is_returned(self, taxonomy, make_profile):
        profile = make_profile(claims=[(taxonomy.adam, []), (taxonomy.sdtm, ["3.3"])])
        results = search_candidates(
            Query(required_activity_codes=frozenset({taxonomy.adam.code}))
        )
        assert [r.profile_id for r in results] == [profile.id]

    def test_a_profile_missing_a_required_code_is_filtered_in_sql(
        self, taxonomy, make_profile
    ):
        make_profile(claims=[(taxonomy.adam, [])])
        results = search_candidates(
            Query(
                required_activity_codes=frozenset(
                    {taxonomy.adam.code, taxonomy.sdtm.code}
                )
            )
        )
        assert results == []

    def test_unsearchable_profiles_are_excluded(self, taxonomy, make_profile):
        make_profile(searchable=False, claims=[(taxonomy.adam, [])])
        results = search_candidates(
            Query(required_activity_codes=frozenset({taxonomy.adam.code}))
        )
        assert results == []

    def test_profiles_not_open_to_opportunities_are_excluded(self, taxonomy, make_profile):
        make_profile(open_to=False, claims=[(taxonomy.adam, [])])
        results = search_candidates(
            Query(required_activity_codes=frozenset({taxonomy.adam.code}))
        )
        assert results == []


class TestPrefilterAgreesWithScorer:
    """The two layers filter claims independently; these are the cases where
    they could drift apart."""

    def test_a_trait_claim_does_not_satisfy_a_required_code(self, taxonomy, make_profile):
        make_profile(claims=[(taxonomy.trait, [])])
        query = Query(required_activity_codes=frozenset({taxonomy.trait.code}))

        assert search_candidates(query) == []
        # And it is not merely hidden as a near-miss either: the pre-filter must
        # not have selected it at all.
        assert search_candidates(query, include_near_misses=True) == []

    def test_an_inactive_activity_claim_does_not_satisfy_a_required_code(
        self, taxonomy, make_profile
    ):
        make_profile(claims=[(taxonomy.retired, [])])
        query = Query(required_activity_codes=frozenset({taxonomy.retired.code}))
        assert search_candidates(query, include_near_misses=True) == []


class TestUnconstrainedQueries:
    def test_an_empty_query_returns_nothing_rather_than_everyone(
        self, taxonomy, make_profile
    ):
        make_profile(claims=[(taxonomy.adam, [])])
        assert search_candidates(Query()) == []

    def test_optional_only_query_excludes_profiles_that_match_nothing(
        self, taxonomy, make_profile
    ):
        matching = make_profile(claims=[(taxonomy.adam, [])])
        make_profile(claims=[(taxonomy.trait, [])])  # no scorable overlap
        results = search_candidates(
            Query(optional_activity_codes=frozenset({taxonomy.adam.code}))
        )
        assert [r.profile_id for r in results] == [matching.id]


class TestVariantsAndNearMisses:
    def test_wrong_variant_is_dropped_by_default(self, taxonomy, make_profile):
        make_profile(claims=[(taxonomy.sdtm, ["3.2"])])
        query = Query(
            required_activity_codes=frozenset({taxonomy.sdtm.code}),
            required_variants={taxonomy.sdtm.code: frozenset({"3.3"})},
        )
        assert search_candidates(query) == []

    def test_wrong_variant_surfaces_as_a_near_miss_when_asked_for(
        self, taxonomy, make_profile
    ):
        profile = make_profile(claims=[(taxonomy.sdtm, ["3.2"])])
        query = Query(
            required_activity_codes=frozenset({taxonomy.sdtm.code}),
            required_variants={taxonomy.sdtm.code: frozenset({"3.3"})},
        )
        results = search_candidates(query, include_near_misses=True)
        assert [r.profile_id for r in results] == [profile.id]
        assert results[0].result.meets_requirements is False
        assert results[0].result.missing_required == (taxonomy.sdtm.code,)


class TestRanking:
    def test_results_are_ordered_by_score_descending(self, taxonomy, make_profile):
        weak = make_profile(claims=[(taxonomy.adam, [])])
        ActivityClaim.objects.filter(profile=weak).update(
            proficiency=1, last_used_year=2005
        )
        strong = make_profile(claims=[(taxonomy.adam, [])])
        ActivityClaim.objects.filter(profile=strong).update(
            proficiency=4, last_used_year=2026
        )

        results = search_candidates(
            Query(required_activity_codes=frozenset({taxonomy.adam.code}))
        )
        assert [r.profile_id for r in results] == [strong.id, weak.id]

    def test_limit_is_respected(self, taxonomy, make_profile):
        for _ in range(3):
            make_profile(claims=[(taxonomy.adam, [])])
        results = search_candidates(
            Query(required_activity_codes=frozenset({taxonomy.adam.code})), limit=2
        )
        assert len(results) == 2
