"""Tests for the searchable skill vocabulary endpoint.

The interesting cases are all about what must *not* appear in the list. A chip a
recruiter can click but that can never match anything is worse than a missing
chip: the search comes back empty and nothing on screen explains why.
"""

import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db

URL_NAME = "skill-list"


@pytest.fixture
def get(api_client, candidate):
    api_client.force_authenticate(user=candidate)

    def _get(**params):
        return api_client.get(reverse(URL_NAME), params)

    return _get


def _codes(response):
    return {row["code"] for row in response.data["results"]}


def _row(response, code):
    return next(r for r in response.data["results"] if r["code"] == code)


class TestAuthorization:
    def test_anonymous_is_refused(self, api_client):
        assert api_client.get(reverse(URL_NAME)).status_code in (401, 403)

    def test_any_authenticated_user_may_read_the_vocabulary(self, get, taxonomy):
        """This is taxonomy, not candidate data — deliberately not behind the
        recruiter gate, so the builder can reuse it."""
        assert get().status_code == 200


class TestWhatIsListed:
    def test_traits_are_excluded_by_default(self, get, taxonomy):
        """A required TRAIT code matches nobody: `matching.search._prefilter`
        filters on `ClaimType.scorable()`. Offering it as a search chip would
        guarantee an empty result set with no visible cause."""
        assert taxonomy.trait.code not in _codes(get())

    def test_traits_can_be_opted_back_in(self, get, taxonomy):
        assert taxonomy.trait.code in _codes(get(include_traits="1"))

    def test_inactive_activities_are_excluded(self, get, taxonomy):
        assert taxonomy.retired.code not in _codes(get())

    def test_scorable_activities_are_listed(self, get, taxonomy):
        assert {taxonomy.sdtm.code, taxonomy.adam.code} <= _codes(get())

    def test_count_matches_the_rows_returned(self, get, taxonomy):
        response = get()
        assert response.data["count"] == len(response.data["results"])

    def test_variants_are_carried_through(self, get, taxonomy):
        """The UI needs these to offer "SDTM IG 3.3 specifically"."""
        assert _row(get(), taxonomy.sdtm.code)["variants"] == ["3.2", "3.3"]


class TestFiltering:
    def test_function_filter_scopes_results(self, get, taxonomy):
        in_function = _codes(get(function=taxonomy.function.code))
        assert taxonomy.sdtm.code in in_function
        assert _codes(get(function=taxonomy.other_function.code)) == set()

    def test_unknown_function_returns_empty_not_an_error(self, get, taxonomy):
        response = get(function="no-such-function")
        assert response.status_code == 200
        assert response.data == {"count": 0, "results": []}

    def test_q_matches_the_label(self, get, taxonomy):
        assert _codes(get(q="ADaM")) == {taxonomy.adam.code}

    def test_q_matches_the_code(self, get, taxonomy):
        assert taxonomy.sdtm.code in _codes(get(q="sdtm-implementation"))

    def test_q_works_without_a_function(self, get, taxonomy):
        """Cross-function lookup: "find #sdtm wherever it lives"."""
        assert _codes(get(q="implementation guide")) == {
            taxonomy.sdtm.code,
            taxonomy.adam.code,
        }

    def test_q_and_function_combine(self, get, taxonomy):
        assert _codes(
            get(function=taxonomy.other_function.code, q="ADaM")
        ) == set()


class TestCrossFunctionalSkills:
    """`Activity.competency_areas` is many-to-many by design — an activity like
    ICH-GCP Compliance is reused across functions."""

    @pytest.fixture
    def shared(self, taxonomy):
        from taxonomy.models import CompetencyArea

        other_area = CompetencyArea.objects.create(
            function=taxonomy.other_function,
            code="data-standards",
            label="Data Standards",
        )
        taxonomy.sdtm.competency_areas.add(other_area)
        return other_area

    def test_an_unscoped_query_reports_every_area(self, get, taxonomy, shared):
        row = _row(get(), taxonomy.sdtm.code)
        assert {a["function_code"] for a in row["areas"]} == {
            taxonomy.function.code,
            taxonomy.other_function.code,
        }

    def test_a_scoped_query_reports_only_that_functions_area(
        self, get, taxonomy, shared
    ):
        """Otherwise a chip in the Statistical Programming view carries a heading
        from Data Management, and the grouped list makes no sense."""
        row = _row(get(function=taxonomy.function.code), taxonomy.sdtm.code)
        assert [a["code"] for a in row["areas"]] == [taxonomy.area.code]
        assert row["areas"][0]["function_label"] == taxonomy.function.label

    def test_a_shared_activity_is_not_duplicated(self, get, taxonomy, shared):
        """Joining across the m2m without `distinct()` returns one row per area."""
        codes = [r["code"] for r in get().data["results"]]
        assert codes.count(taxonomy.sdtm.code) == 1


class TestQueryBudget:
    def test_serializing_areas_does_not_scale_with_the_row_count(
        self, get, taxonomy, django_assert_num_queries
    ):
        """Without the `competency_areas` prefetch this is one query per skill —
        ~150 for a real function.
        """
        from taxonomy.models import Activity, ClaimType

        for i in range(20):
            activity = Activity.objects.create(
                code=f"bulk-activity-{i}",
                label=f"Bulk activity {i}",
                claim_type=ClaimType.ACTIVITY,
            )
            activity.competency_areas.add(taxonomy.area)

        with django_assert_num_queries(2):
            assert get(function=taxonomy.function.code).status_code == 200
