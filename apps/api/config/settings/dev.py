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