"""Development settings — local Docker Compose / runserver."""

from .base import *  # noqa: F401,F403

DEBUG = True

ALLOWED_HOSTS = ["*"]

CORS_ALLOW_ALL_ORIGINS = True

# Email — print to console so magic links / OTP are visible in dev.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# SMS backend — console in dev (no real SMS provider).
SMS_BACKEND = "accounts.sms.ConsoleSMSBackend"

# Storage — local filesystem in dev (MinIO optional via env).
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# Disable HTTPS-only cookies locally.
ACCOUNT_DEFAULT_HTTP_PROTOCOL = "http"
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
# Extend JWT token lifetime for development
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=365),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=365),
}

# Trust the Vite frontend origin for CSRF during authentication (SessionAuth)
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Remove SessionAuthentication to disable CSRF checks on the SPA frontend 
# (since we are purely using JWTs for the SPA)
REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"] = (
    "rest_framework_simplejwt.authentication.JWTAuthentication",
    "oauth2_provider.contrib.rest_framework.OAuth2Authentication",
)

# Also ensure dj-rest-auth doesn't try to use sessions
REST_AUTH["SESSION_LOGIN"] = False

# Ensure allauth knows username is completely disabled
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_AUTHENTICATION_METHOD = 'email' # Legacy setting just in case dj-rest-auth expects it

# Force dj-rest-auth to use our custom register serializer that drops the username field

# Force dj-rest-auth to use our custom register serializer
REST_AUTH["REGISTER_SERIALIZER"] = "api.v1.auth_serializers.CustomRegisterSerializer"
