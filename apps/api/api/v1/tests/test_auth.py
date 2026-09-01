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

