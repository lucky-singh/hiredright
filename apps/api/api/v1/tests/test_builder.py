"""Tests for the builder payload and the server-side resume state."""

import pytest
from django.urls import reverse

from profiles.models import BuilderProgress

pytestmark = pytest.mark.django_db


class TestBuilderPayload:
    def test_returns_the_whole_tree_in_one_response(self, api_client, candidate, taxonomy):
        api_client.force_authenticate(user=candidate)
        response = api_client.get(
            reverse("builder", kwargs={"role_code": taxonomy.role.code})
        )
        assert response.status_code == 200

        data = response.data
        assert data["role"]["code"] == taxonomy.role.code
        areas = data["role"]["competency_areas"]
        assert [a["code"] for a in areas] == ["cdisc-sdtm"]

        activities = {a["code"]: a for a in areas[0]["activities"]}
        assert activities["sdtm-implementation-guide"]["variants"] == ["3.2", "3.3"]
        assert activities["quality-mindset"]["claim_type"] == "trait"

    def test_creates_the_profile_on_first_open(self, api_client, candidate, taxonomy):
        api_client.force_authenticate(user=candidate)
        api_client.get(reverse("builder", kwargs={"role_code": taxonomy.role.code}))
        assert candidate.profile is not None

    def test_unknown_function_is_404(self, api_client, candidate, taxonomy):
        api_client.force_authenticate(user=candidate)
        response = api_client.get(reverse("builder", kwargs={"role_code": "nope"}))
        assert response.status_code == 404

    def test_inactive_function_is_404(self, api_client, candidate, taxonomy):
        taxonomy.role.is_active = False
        taxonomy.role.save(update_fields=["is_active"])
        api_client.force_authenticate(user=candidate)
        response = api_client.get(
            reverse("builder", kwargs={"role_code": taxonomy.role.code})
        )
        assert response.status_code == 404

    def test_anonymous_is_rejected(self, api_client, taxonomy):
        response = api_client.get(
            reverse("builder", kwargs={"role_code": taxonomy.role.code})
        )
        assert response.status_code in (401, 403)


class TestProgress:
    @pytest.fixture
    def put(self, api_client, candidate):
        url = reverse("builder-progress")
        api_client.force_authenticate(user=candidate)

        def _put(payload):
            return api_client.put(url, payload, format="json")

        return _put

    def test_saves_and_returns_progress(self, put, taxonomy):
        response = put(
            {
                "role_code": taxonomy.role.code,
                "completed_area_codes": ["cdisc-sdtm"],
                "last_area_code": "cdisc-adam",
            }
        )
        assert response.status_code == 200
        assert response.data["role_code"] == taxonomy.role.code
        assert response.data["completed_area_codes"] == ["cdisc-sdtm"]
        assert response.data["last_area_code"] == "cdisc-adam"

    def test_missing_role_code_is_a_400_naming_the_field(self, put, taxonomy):
        response = put({"completed_area_codes": []})
        assert response.status_code == 400
        assert "role_code" in response.data

    def test_unknown_role_code_is_a_400(self, put, taxonomy):
        response = put({"role_code": "no-such-role"})
        assert response.status_code == 400

    def test_invalid_completed_area_codes_rejected(self, put, taxonomy):
        response = put(
            {
                "role_code": taxonomy.role.code,
                "completed_area_codes": [123],
            }
        )
        assert response.status_code == 400
        assert "completed_area_codes" in response.data

    def test_switching_function_moves_the_single_row(self, put, taxonomy):
        """BuilderProgress is a OneToOne on profile. Keying the upsert on
        (profile, role) would miss the existing row here and then trip the
        uniqueness constraint on insert."""
        assert put({"role_code": taxonomy.role.code}).status_code == 200

        response = put({"role_code": taxonomy.other_role.code})
        assert response.status_code == 200
        assert response.data["role_code"] == taxonomy.other_role.code
        assert BuilderProgress.objects.count() == 1

    def test_repeated_saves_update_in_place(self, put, taxonomy):
        put({"role_code": taxonomy.role.code, "last_area_code": "a"})
        put({"role_code": taxonomy.role.code, "last_area_code": "b"})
        assert BuilderProgress.objects.count() == 1
        assert BuilderProgress.objects.get().last_area_code == "b"

    def test_anonymous_is_rejected(self, api_client, taxonomy):
        response = api_client.put(
            reverse("builder-progress"),
            {"role_code": taxonomy.role.code},
            format="json",
        )
        assert response.status_code in (401, 403)
        assert not BuilderProgress.objects.exists()

class TestFunctionList:
    def test_returns_active_functions_only(self, api_client, candidate, taxonomy):
        taxonomy.other_role.is_active = False
        taxonomy.other_role.save()
        
        api_client.force_authenticate(user=candidate)
        response = api_client.get(reverse("role-list"))
        
        assert response.status_code == 200
        codes = [f["code"] for f in response.data]
        assert taxonomy.role.code in codes
        assert taxonomy.other_role.code not in codes

    def test_anonymous_is_rejected(self, api_client):
        response = api_client.get(reverse("role-list"))
        assert response.status_code in (401, 403)
