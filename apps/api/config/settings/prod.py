"""Production settings — hardened, all values from environment."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

ALLOWED_HOSTS = env("ALLOWED_HOSTS")

SECRET_KEY = env("DJANGO_SECRET_KEY")

# Security hardening.
SECURE_SSL_REDIRECT = env("SECURE_SSL_REDIRECT", default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env("SECURE_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
X_FRAME_OPTIONS = "DENY"

# Email — real SMTP.
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = True

# SMS — must be a real provider. No console fallback here: silently printing a
# login OTP to a production log instead of sending it would let anyone with log
# access take over an account.
SMS_BACKEND = env("SMS_BACKEND")

# Storage — S3-compatible via django-storages (MinIO / AWS / GCS / R2).
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "access_key": env("S3_ACCESS_KEY", default=""),
            "secret_key": env("S3_SECRET_KEY", default=""),
            "bucket_name": env("S3_BUCKET_NAME", default=""),
            "endpoint_url": env("S3_ENDPOINT_URL", default=""),
            "region_name": env("S3_REGION", default=""),
        },
    },
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# CORS — explicit allow-list only.
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_ALL_ORIGINS = False