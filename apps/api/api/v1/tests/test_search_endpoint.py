"""Tests for the recruiter search endpoint's authorization and request contract.

Search reads across the entire candidate pool, so the interesting cases are the
ones where access should be refused. `IsAuthenticated` would pass every one of
them.
"""

from types import SimpleNamespace

import pytest
from profiles.models import CandidateProfile, ActivityClaim
from django.conf import settings
from django.urls import reverse

pytestmark = pytest.mark.django_db

URL_NAME = "candidate-search"


def _token(scope: str):
    """Stand-in for an OAuth2 access token.

    `force_authenticate(token=...)` sets `request.auth` directly, which is the
    only thing the permission reads. Going through a real token would drag in
    oauthlib and test django-oauth-toolkit rather than our own gate.
    """
    return SimpleNamespace(scope=scope)


class TestAuthorization:
    def test_anonymous_is_refused(self, api_client):
        response = api_client.post(reverse(URL_NAME), {}, format="json")
        assert response.status_code in (401, 403)

    def test_a_plain_candidate_login_is_refused(self, api_client, candidate):
        """The whole point of the scope: a candidate's own credentials must not
        let them enumerate every other candidate."""
        api_client.force_authenticate(user=candidate)
        response = api_client.post(
            reverse(URL_NAME),
            {"required_activity_codes": ["adam-implementation-guide"]},
            format="json",
        )
        assert response.status_code == 403

    def test_a_recruiter_login_is_allowed(self, api_client, recruiter, taxonomy):
        """The browser path: a recruiter is a person with a JWT, not a service
        holding a client secret."""
        api_client.force_authenticate(user=recruiter)
        response = api_client.post(
            reverse(URL_NAME),
            {"required_activity_codes": [taxonomy.adam.code]},
            format="json",
        )
        assert response.status_code == 200

    def test_the_recruiter_flag_is_what_grants_access_not_authentication(
        self, api_client, candidate, taxonomy
    ):
        """Guard on the `HasRecruiterSearchScope | IsRecruiterUser` composition:
        loosening `IsRecruiterUser` to `IsAuthenticated` would open the whole
        pool to every candidate, and every other test here would still pass.
        """
        candidate.is_recruiter = True
        candidate.save(update_fields=["is_recruiter"])
        api_client.force_authenticate(user=candidate)
        assert (
            api_client.post(
                reverse(URL_NAME),
                {"required_activity_codes": [taxonomy.adam.code]},
                format="json",
            ).status_code
            == 200
        )

        candidate.is_recruiter = False
        candidate.save(update_fields=["is_recruiter"])
        api_client.force_authenticate(user=candidate)
        assert (
            api_client.post(
                reverse(URL_NAME),
                {"required_activity_codes": [taxonomy.adam.code]},
                format="json",
            ).status_code
            == 403
        )

    def test_a_token_without_the_scope_is_refused_not_crashed(self, api_client, candidate):
        """`TokenHasScope` raises ImproperlyConfigured (a 500) for non-OAuth2
        auth; this must be a clean 403 instead."""
        api_client.force_authenticate(user=candidate, token=_token("read write"))
        response = api_client.post(
            reverse(URL_NAME),
            {"required_activity_codes": ["adam-implementation-guide"]},
            format="json",
        )
        assert response.status_code == 403

    def test_a_token_with_the_scope_is_allowed(self, api_client, taxonomy):
        api_client.force_authenticate(
            user=None, token=_token(settings.RECRUITER_SEARCH_SCOPE)
        )
        response = api_client.post(
            reverse(URL_NAME),
            {"required_activity_codes": [taxonomy.adam.code]},
            format="json",
        )
        assert response.status_code == 200
        assert response.data == {"count": 0, "results": []}

    def test_scope_prefix_does_not_count_as_the_scope(self, api_client):
        """Scopes are space-separated tokens, so a substring match would let
        `candidates:searchable` through."""
        api_client.force_authenticate(user=None, token=_token("candidates:searchable"))
        response = api_client.post(
            reverse(URL_NAME),
            {"required_activity_codes": ["adam-implementation-guide"]},
            format="json",
        )
        assert response.status_code == 403


class TestRequestContract:
    @pytest.fixture
    def post(self, api_client):
        api_client.force_authenticate(
            user=None, token=_token(settings.RECRUITER_SEARCH_SCOPE)
        )

        def _post(payload):
            return api_client.post(reverse(URL_NAME), payload, format="json")

        return _post

    def test_a_query_with_no_codes_is_refused(self, post, taxonomy):
        assert post({}).status_code == 400

    def test_a_non_numeric_limit_is_a_400_not_a_500(self, post, taxonomy):
        response = post(
            {"required_activity_codes": [taxonomy.adam.code], "limit": "lots"}
        )
        assert response.status_code == 400

    def test_limit_above_the_cap_is_refused(self, post, taxonomy):
        response = post({"required_activity_codes": [taxonomy.adam.code], "limit": 5000})
        assert response.status_code == 400

    def test_variant_constraint_on_an_unsearched_code_is_refused(self, post, taxonomy):
        """Otherwise the constraint is silently inert and the caller believes it
        searched for SDTM IG 3.3 when nothing did."""
        response = post(
            {
                "required_activity_codes": [taxonomy.adam.code],
                "required_variants": {taxonomy.sdtm.code: ["3.3"]},
            }
        )
        assert response.status_code == 400
        assert "required_variants" in response.data

    def test_variant_constraint_on_a_required_code_is_accepted(self, post, taxonomy):
        response = post(
            {
                "required_activity_codes": [taxonomy.sdtm.code],
                "required_variants": {taxonomy.sdtm.code: ["3.3"]},
            }
        )
        assert response.status_code == 200

class TestResponseContract:
    def test_search_results_include_claim_metadata(self, api_client, django_user_model, taxonomy):
        # Create a candidate profile with a claim
        user = django_user_model.objects.create(email="candidate@example.com", is_recruiter=True)
        profile = CandidateProfile.objects.create(user=user, is_searchable=True, open_to_opportunities=True)
        ActivityClaim.objects.create(
            profile=profile,
            activity=taxonomy.sdtm,
            proficiency=4,
            years_experience=3.5,
            last_used_year=2025
        )
        api_client.force_authenticate(user=user)
        
        # Act
        res = api_client.post(
            "/api/v1/search/",
            {
                "required_activity_codes": [taxonomy.sdtm.code],
                "optional_activity_codes": []
            },
            format="json"
        )
        
        # Assert
        assert res.status_code == 200
        data = res.json()
        assert data["count"] == 1
        
        matched_required = data["results"][0]["matched_required"]
        assert len(matched_required) == 1
        skill = matched_required[0]
        assert skill["code"] == taxonomy.sdtm.code
        assert skill["proficiency"] == 4
        assert skill["years_experience"] == 3.5
        assert skill["last_used_year"] == 2025
