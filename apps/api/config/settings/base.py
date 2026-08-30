"""Base settings shared across all environments.

Environment-specific overrides live in `dev.py` and `prod.py`. All secrets and
per-environment values come from environment variables via django-environ, so
the same code runs locally, in CI, and in any cloud without code changes.
"""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parents[2]  # apps/api
REPO_ROOT = BASE_DIR.parents[1]

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, []),
)

# `.env` lives at the repo root so Docker Compose and a bare `runserver` share
# one file. An `apps/api/.env` wins if present, for the occasional need to run
# two API instances against different databases. `read_env` never clobbers a
# real environment variable, so in a container the injected values still win.
for _env_file in (BASE_DIR / ".env", REPO_ROOT / ".env"):
    if _env_file.is_file():
        environ.Env.read_env(_env_file)

SECRET_KEY = env("DJANGO_SECRET_KEY", default="insecure-dev-only-change-me")
DEBUG = env("DEBUG")

ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework.authtoken",
    "drf_spectacular",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    # LinkedIn via the generic OIDC provider, not allauth's `linkedin_oauth2`:
    # that one still calls the retired v1 profile projections with the
    # r_liteprofile / r_emailaddress scopes, which LinkedIn no longer issues.
    "allauth.socialaccount.providers.openid_connect",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "oauth2_provider",
    "corsheaders",
]

LOCAL_APPS = [
    "accounts",
    "taxonomy",
    "profiles",
    "matching",
    "api",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="hiredright"),
        "USER": env("POSTGRES_USER", default="hiredright"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="hiredright"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
    }
}

# ---------------------------------------------------------------------------
# Cache & queue
# ---------------------------------------------------------------------------

REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/1")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

AUTH_USER_MODEL = "accounts.User"

# OAuth2 scope a recruiter service must hold to run candidate search. Named here
# rather than inline so the scope registry and the permission class cannot drift
# apart — a typo in either would silently open or close the endpoint.
RECRUITER_SEARCH_SCOPE = "candidates:search"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

SITE_ID = 1

# allauth — email-first, passwordless-capable, account linking by verified email.
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_EMAIL_VERIFICATION = "optional"
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*"]
ACCOUNT_EMAIL_SUBJECT_PREFIX = "[HireRight] "
ACCOUNT_DEFAULT_HTTP_PROTOCOL = "https"

SOCIALACCOUNT_PROVIDERS = {
    "openid_connect": {
        "APPS": [
            {
                "provider_id": "linkedin",
                "name": "LinkedIn",
                "client_id": env("LINKEDIN_CLIENT_ID", default=""),
                "secret": env("LINKEDIN_CLIENT_SECRET", default=""),
                "settings": {
                    # allauth appends /.well-known/openid-configuration and
                    # reads the endpoints from LinkedIn's discovery document, so
                    # there are no hard-coded URLs to rot here.
                    "server_url": "https://www.linkedin.com/oauth",
                },
            },
        ],
    }
}
# Default OIDC scope is already openid/profile/email — exactly what LinkedIn's
# "Sign In with LinkedIn using OpenID Connect" product grants.

# dj-rest-auth + simplejwt
REST_AUTH = {
    "USE_JWT": True,
    "JWT_AUTH_HTTPONLY": False,
    "JWT_AUTH_COOKIE": "hiredright-access",
    "JWT_AUTH_REFRESH_COOKIE": "hiredright-refresh",
    "JWT_AUTH_RETURN_EXPIRATION": True,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Recruiter portals are separate services, not people, so they authenticate with
# OAuth2 client credentials rather than a candidate's JWT. The scope is what
# actually gates `/api/v1/search/` — see api.v1.permissions.
OAUTH2_PROVIDER = {
    "SCOPES": {
        RECRUITER_SEARCH_SCOPE: "Search and rank candidate profiles",
    },
    "ACCESS_TOKEN_EXPIRE_SECONDS": 3600,
    "ROTATE_REFRESH_TOKEN": True,
}

# ---------------------------------------------------------------------------
# DRF
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "oauth2_provider.contrib.rest_framework.OAuth2Authentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "HireRight API",
    "DESCRIPTION": (
        "Talent intelligence and matching engine for clinical trials and "
        "pharmaceutical development."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & media
# ---------------------------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# CORS (dev permissive; prod overrides)
# ---------------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS", default=[])