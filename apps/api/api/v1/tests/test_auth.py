import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status

User = get_user_model()

@pytest.mark.django_db
class TestAuthRegistration:
    def test_registration_with_custom_fields(self, api_client):
        payload = {
            "email": "dwight@dundermifflin.com",
            "password1": "beets123",
            "password2": "beets123",
            "first_name": "Dwight",
            "last_name": "Schrute",
            "phone_number": "+15705551234"
        }
        url = reverse("rest_register")
        response = api_client.post(url, data=payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        
        user = User.objects.get(email="dwight@dundermifflin.com")
        assert user.first_name == "Dwight"
        assert user.last_name == "Schrute"
        assert user.phone_number == "+15705551234"

@pytest.mark.django_db
class TestAuthProfileUpdate:
    def test_update_profile_fields(self, api_client):
        user = User.objects.create_user(
            email="pam@dundermifflin.com", 
            password="art",
            first_name="Pam",
            last_name="Beesly",
            phone_number=""
        )
        api_client.force_authenticate(user=user)
        
        url = reverse("rest_user_details")
        payload = {
            "first_name": "Pamela",
            "last_name": "Halpert",
            "phone_number": "+15705559876"
        }
        response = api_client.put(url, data=payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        
        user.refresh_from_db()
        assert user.first_name == "Pamela"
        assert user.last_name == "Halpert"
        assert user.phone_number == "+15705559876"

@pytest.mark.django_db
class TestCandidateProfileView:
    def test_candidate_profile_view_returns_phone_number(self, api_client):
        user = User.objects.create_user(
            email="jim@dundermifflin.com", 
            password="prank",
            first_name="Jim",
            last_name="Halpert",
            phone_number="+15705555555"
        )
        api_client.force_authenticate(user=user)
        
        url = reverse("candidate-profile")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["phone_number"] == "+15705555555"

    def test_candidate_profile_view_returns_roles_and_claims(self, api_client):
        from profiles.models import CandidateProfile, BuilderProgress, ActivityClaim
        from taxonomy.models import Role, CompetencyArea, Activity

        user = User.objects.create_user(email="testroles@example.com", password="pwd")
        profile = CandidateProfile.objects.create(user=user)
        role = Role.objects.create(code="test-role", label="Test Role")
        area = CompetencyArea.objects.create(role=role, code="test-area", label="Test Area")
        activity = Activity.objects.create(code="test-activity", label="Test Activity")
        activity.competency_areas.add(area)
        
        # Candidate has builder progress
        BuilderProgress.objects.create(profile=profile, role=role)
        # Candidate has a claim
        ActivityClaim.objects.create(profile=profile, activity=activity, proficiency=3)

        api_client.force_authenticate(user=user)
        url = reverse("candidate-profile")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert "roles" in data
        assert len(data["roles"]) == 1
        assert data["roles"][0]["code"] == "test-role"
        
        assert "claims" in data
        assert len(data["claims"]) == 1
        assert data["claims"][0]["role_code"] == "test-role"
        assert data["claims"][0]["activity_code"] == "test-activity"

    def test_candidate_profile_view_returns_roles_from_resumes(self, api_client):
        from profiles.models import CandidateProfile, CandidateResume
        from taxonomy.models import Role
        from django.core.files.uploadedfile import SimpleUploadedFile

        user = User.objects.create_user(email="testresumes@example.com", password="pwd")
        profile = CandidateProfile.objects.create(user=user)
        role = Role.objects.create(code="resume-only-role", label="Resume Only Role")
        
        # User uploaded a resume for a role but has NO claims or progress
        resume_file = SimpleUploadedFile("dummy.pdf", b"content", content_type="application/pdf")
        CandidateResume.objects.create(profile=profile, role=role, file=resume_file)

        api_client.force_authenticate(user=user)
        url = reverse("candidate-profile")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert "roles" in data
        assert len(data["roles"]) == 1
        assert data["roles"][0]["code"] == "resume-only-role"
        assert data["roles"][0]["resume"] is not None

    def test_candidate_profile_view_no_phantom_roles_for_shared_skills(self, api_client):
        from profiles.models import CandidateProfile, BuilderProgress, ActivityClaim
        from taxonomy.models import Role, CompetencyArea, Activity

        user = User.objects.create_user(email="nophantom@example.com", password="pwd")
        profile = CandidateProfile.objects.create(user=user)
        
        # Create Role A and Role B
        role_a = Role.objects.create(code="role-a", label="Role A")
        role_b = Role.objects.create(code="role-b", label="Role B")
        
        # Create Area A (Role A) and Area B (Role B)
        area_a = CompetencyArea.objects.create(role=role_a, code="area-a", label="Area A", sort_order=1)
        area_b = CompetencyArea.objects.create(role=role_b, code="area-b", label="Area B", sort_order=2)
        
        # Create a shared activity that belongs to both areas
        shared_activity = Activity.objects.create(code="shared-skill", label="Shared Skill", is_active=True)
        shared_activity.competency_areas.set([area_a, area_b])
        
        # The user has ONLY built Role A
        BuilderProgress.objects.create(profile=profile, role=role_a, last_area_code="area-a")
        
        # The user claims the shared skill
        ActivityClaim.objects.create(profile=profile, activity=shared_activity, proficiency=3)

        api_client.force_authenticate(user=user)
        url = reverse("candidate-profile")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        
        # Role B should NOT be included in roles, because the shared skill is covered by Role A
        role_codes = [r["code"] for r in data["roles"]]
        assert "role-a" in role_codes
        assert "role-b" not in role_codes
        
        # The skill should still be returned
        assert len(data["claims"]) == 1
        assert data["claims"][0]["role_code"] == "role-a"

    def test_candidate_profile_view_recovers_orphaned_claims(self, api_client):
        from profiles.models import CandidateProfile, ActivityClaim
        from taxonomy.models import Role, CompetencyArea, Activity

        user = User.objects.create_user(email="orphaned@example.com", password="pwd")
        profile = CandidateProfile.objects.create(user=user)
        
        # Create Role and Area
        role = Role.objects.create(code="abandoned-role", label="Abandoned Role")
        area = CompetencyArea.objects.create(role=role, code="abandoned-area", label="Area", sort_order=1)
        activity = Activity.objects.create(code="abandoned-skill", label="Abandoned Skill", is_active=True)
        activity.competency_areas.set([area])
        
        # The user has NO BuilderProgress and NO CandidateResume for this role!
        # But they have a claim (e.g. they abandoned the builder before clicking Next)
        ActivityClaim.objects.create(profile=profile, activity=activity, proficiency=3)

        api_client.force_authenticate(user=user)
        url = reverse("candidate-profile")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        
        # The role MUST be dynamically recovered so the claim isn't orphaned
        assert len(data["roles"]) == 1
        assert data["roles"][0]["code"] == "abandoned-role"
        assert len(data["claims"]) == 1
        assert data["claims"][0]["role_code"] == "abandoned-role"

@pytest.mark.django_db
class TestAuthPasswordReset:
    def test_password_reset_confirm_redirect(self, api_client):
        from django.conf import settings
        uidb64 = "MTA"
        token = "test-token-123"
        url = reverse("password_reset_confirm", kwargs={"uidb64": uidb64, "token": token})
        response = api_client.get(url)
        assert response.status_code == 302
        expected_url = f"{settings.FRONTEND_URL}/reset-password?uid={uidb64}&token={token}"
        assert response.url == expected_url
