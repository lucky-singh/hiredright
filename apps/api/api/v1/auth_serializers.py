from django.contrib.auth import get_user_model
from rest_framework import serializers
from dj_rest_auth.registration.serializers import RegisterSerializer

User = get_user_model()

class CustomRegisterSerializer(RegisterSerializer):
    username = None
    
    def validate_email(self, email):
        email = super().validate_email(email)
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError(
                "A user is already registered with this e-mail address."
            )
        return email
