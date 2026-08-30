"""Tests for the claim batch autosave endpoint.

The theme here is that the write path uses `update_or_create`, which never calls
model `clean()`. Every constraint the model *declares* therefore has to be
re-asserted at the API layer or it simply does not hold, and these tests are what
keep that honest.
"""

import pytest
from django.urls import reverse

from profiles.models import ActivityClaim

pytestmark = pytest.mark.django_db


@pytest.fixture
def post(api_client, candidate):
    url = reverse("builder-claims")
    api_client.force_authenticate(user=candidate)

    def _post(claims):
        return api_client.post(url, {"claims": claims}, format="json")

    return _post


class TestRejectedBatches:
    """A rejected batch must be rejected whole. Reporting success while dropping
    an answer is the one failure this flow exists to prevent."""

    def test_unknown_activity_code_is_rejected(self, post, taxonomy):
        response = post([{"activity_code": "no-such-activity", "claimed": True}])
        assert response.status_code == 400
        assert "no-such-activity" in str(response.data)

    def test_inactive_activity_code_is_rejected(self, post, taxonomy):
        response = post([{"activity_code": taxonomy.retired.code, "claimed": True}])
        assert response.status_code == 400

    def test_variant_outside_the_activitys_options_is_rejected(self, post, taxonomy):
        response = post(
            [
                {
                    "activity_code": taxonomy.sdtm.code,
                    "claimed": True,
                    "variants": ["3.3", "9.9"],
                }
            ]
        )
        assert response.status_code == 400
        assert "9.9" in str(response.data)
        assert not ActivityClaim.objects.exists()

    def test_variant_on_an_activity_with_no_variants_is_rejected(self, post, taxonomy):
        response = post(
            [
                {
                    "activity_code": taxonomy.adam.code,
                    "claimed": True,
                    "variants": ["1.1"],
                }
            ]
        )
        assert response.status_code == 400

    def test_future_last_used_year_is_rejected(self, post, taxonomy):
        response = post(
            [
                {
                    "activity_code": taxonomy.adam.code,
                    "claimed": True,
                    "last_used_year": 3000,
                }
            ]
        )
        assert response.status_code == 400

    def test_prehistoric_last_used_year_is_rejected(self, post, taxonomy):
        response = post(
            [
                {
                    "activity_code": taxonomy.adam.code,
                    "claimed": True,
                    "last_used_year": 1979,
                }
            ]
        )
        assert response.status_code == 400

    def test_duplicate_variants_rejected(self, post, taxonomy):
        response = post(
            [
                {
                    "activity_code": taxonomy.sdtm.code,
                    "claimed": True,
                    "variants": ["3.2", "3.2"],
                }
            ]
        )
        assert response.status_code == 400

    def test_duplicate_code_in_one_batch_is_rejected(self, post, taxonomy):
        response = post(
            [
                {"activity_code": taxonomy.adam.code, "claimed": True},
                {"activity_code": taxonomy.adam.code, "claimed": False},
            ]
        )
        assert response.status_code == 400

    def test_one_bad_delta_rolls_back_the_good_ones(self, post, taxonomy):
        response = post(
            [
                {"activity_code": taxonomy.adam.code, "claimed": True},
                {"activity_code": "no-such-activity", "claimed": True},
            ]
        )
        assert response.status_code == 400
        assert not ActivityClaim.objects.exists()


class TestAcceptedBatches:
    def test_upsert_creates_a_claim(self, post, taxonomy, candidate):
        response = post(
            [
                {
                    "activity_code": taxonomy.sdtm.code,
                    "claimed": True,
                    "proficiency": 3,
                    "years_experience": "4.5",
                    "last_used_year": 2025,
                    "variants": ["3.2", "3.3"],
                }
            ]
        )
        assert response.status_code == 200
        assert response.data["synced_count"] == 1

        claim = ActivityClaim.objects.get(activity=taxonomy.sdtm)
        assert claim.proficiency == 3
        assert claim.last_used_year == 2025
        assert sorted(claim.variants) == ["3.2", "3.3"]

    def test_null_last_used_year_is_accepted(self, post, taxonomy, candidate):
        response = post(
            [
                {
                    "activity_code": taxonomy.adam.code,
                    "claimed": True,
                    "last_used_year": None,
                }
            ]
        )
        assert response.status_code == 200
        claim = ActivityClaim.objects.get(activity=taxonomy.adam)
        assert claim.last_used_year is None

    def test_replaying_the_same_batch_does_not_duplicate(self, post, taxonomy):
        """The debounce can double-fire; the (profile, activity) constraint and
        the upsert together have to make that a no-op."""
        payload = [{"activity_code": taxonomy.adam.code, "claimed": True, "proficiency": 2}]
        assert post(payload).status_code == 200
        assert post(payload).status_code == 200
        assert ActivityClaim.objects.filter(activity=taxonomy.adam).count() == 1

    def test_unticking_deletes_the_claim(self, post, taxonomy):
        post([{"activity_code": taxonomy.adam.code, "claimed": True}])
        response = post([{"activity_code": taxonomy.adam.code, "claimed": False}])
        assert response.status_code == 200
        assert response.data["synced_count"] == 1
        assert not ActivityClaim.objects.filter(activity=taxonomy.adam).exists()

    def test_unticking_something_never_claimed_is_harmless(self, post, taxonomy):
        response = post([{"activity_code": taxonomy.adam.code, "claimed": False}])
        assert response.status_code == 200
        assert response.data["synced_count"] == 0

    def test_trait_claims_are_still_accepted(self, post, taxonomy):
        """Traits are excluded from *scoring*, not from collection — the
        recruiter still reads them."""
        response = post([{"activity_code": taxonomy.trait.code, "claimed": True}])
        assert response.status_code == 200
        assert ActivityClaim.objects.filter(activity=taxonomy.trait).exists()

    def test_batch_over_the_cap_is_rejected(self, post, taxonomy):
        response = post(
            [{"activity_code": f"code-{i}", "claimed": True} for i in range(201)]
        )
        assert response.status_code == 400


class TestAuth:
    def test_anonymous_cannot_write_claims(self, api_client, taxonomy):
        response = api_client.post(
            reverse("builder-claims"),
            {"claims": [{"activity_code": taxonomy.adam.code}]},
            format="json",
        )
        assert response.status_code in (401, 403)
        assert not ActivityClaim.objects.exists()
