"""Tests for the builder payload and the server-side resume state."""

import pytest
from django.urls import reverse

from profiles.models import BuilderProgress

pytestmark = pytest.mark.django_db


class TestBuilderPayload:
    def test_returns_the_whole_tree_in_one_response(self, api_client, candidate, taxonomy):
        api_client.force_authenticate(user=candidate)
        response = api_client.get(
            reverse("builder", kwargs={"function_code": taxonomy.function.code})
        )
        assert response.status_code == 200

        data = response.data
        assert data["function"]["code"] == taxonomy.function.code
        areas = data["function"]["competency_areas"]
        assert [a["code"] for a in areas] == ["cdisc-sdtm"]

        activities = {a["code"]: a for a in areas[0]["activities"]}
        assert activities["sdtm-implementation-guide"]["variants"] == ["3.2", "3.3"]
        assert activities["quality-mindset"]["claim_type"] == "trait"

    def test_creates_the_profile_on_first_open(self, api_client, candidate, taxonomy):
        api_client.force_authenticate(user=candidate)
        api_client.get(reverse("builder", kwargs={"function_code": taxonomy.function.code}))
        assert candidate.profile is not None

    def test_unknown_function_is_404(self, api_client, candidate, taxonomy):
        api_client.force_authenticate(user=candidate)
        response = api_client.get(reverse("builder", kwargs={"function_code": "nope"}))
        assert response.status_code == 404

    def test_inactive_function_is_404(self, api_client, candidate, taxonomy):
        taxonomy.function.is_active = False
        taxonomy.function.save(update_fields=["is_active"])
        api_client.force_authenticate(user=candidate)
        response = api_client.get(
            reverse("builder", kwargs={"function_code": taxonomy.function.code})
        )
        assert response.status_code == 404

    def test_anonymous_is_rejected(self, api_client, taxonomy):
        response = api_client.get(
            reverse("builder", kwargs={"function_code": taxonomy.function.code})
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
                "function_code": taxonomy.function.code,
                "completed_area_codes": ["cdisc-sdtm"],
                "last_area_code": "cdisc-adam",
            }
        )
        assert response.status_code == 200
        assert response.data["function_code"] == taxonomy.function.code
        assert response.data["completed_area_codes"] == ["cdisc-sdtm"]
        assert response.data["last_area_code"] == "cdisc-adam"

    def test_missing_function_code_is_a_400_naming_the_field(self, put, taxonomy):
        response = put({"completed_area_codes": []})
        assert response.status_code == 400
        assert "function_code" in response.data

    def test_unknown_function_code_is_a_400(self, put, taxonomy):
        response = put({"function_code": "no-such-function"})
        assert response.status_code == 400

    def test_switching_function_moves_the_single_row(self, put, taxonomy):
        """BuilderProgress is a OneToOne on profile. Keying the upsert on
        (profile, function) would miss the existing row here and then trip the
        uniqueness constraint on insert."""
        assert put({"function_code": taxonomy.function.code}).status_code == 200

        response = put({"function_code": taxonomy.other_function.code})
        assert response.status_code == 200
        assert response.data["function_code"] == taxonomy.other_function.code
        assert BuilderProgress.objects.count() == 1

    def test_repeated_saves_update_in_place(self, put, taxonomy):
        put({"function_code": taxonomy.function.code, "last_area_code": "a"})
        put({"function_code": taxonomy.function.code, "last_area_code": "b"})
        assert BuilderProgress.objects.count() == 1
        assert BuilderProgress.objects.get().last_area_code == "b"

    def test_anonymous_is_rejected(self, api_client, taxonomy):
        response = api_client.put(
            reverse("builder-progress"),
            {"function_code": taxonomy.function.code},
            format="json",
        )
        assert response.status_code in (401, 403)
        assert not BuilderProgress.objects.exists()
