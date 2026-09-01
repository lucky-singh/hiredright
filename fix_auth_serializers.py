import re

with open("apps/api/api/v1/auth_serializers.py", "r") as f:
    content = f.read()

new_content = """from django.contrib.auth import get_user_model
from rest_framework import serializers
from dj_rest_auth.registration.serializers import RegisterSerializer

User = get_user_model()

class CustomRegisterSerializer(RegisterSerializer):
    username = None
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    
    def validate_email(self, email):
        email = super().validate_email(email)
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError(
                "A user is already registered with this e-mail address."
            )
        return email

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data['first_name'] = self.validated_data.get('first_name', '')
        data['last_name'] = self.validated_data.get('last_name', '')
        data['phone_number'] = self.validated_data.get('phone_number', '')
        return data

    def custom_signup(self, request, user):
        user.first_name = self.validated_data.get('first_name', '')
        user.last_name = self.validated_data.get('last_name', '')
        user.phone_number = self.validated_data.get('phone_number', '')
        user.save()
"""

with open("apps/api/api/v1/auth_serializers.py", "w") as f:
    f.write(new_content)
