"""Root URL configuration for the HireRight API."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    # Candidate + recruiter API (versioned).
    path("api/v1/", include("api.v1.urls")),
    # Auth (dj-rest-auth + allauth).
    path("api/v1/auth/", include("dj_rest_auth.urls")),
    path("api/v1/auth/registration/", include("dj_rest_auth.registration.urls")),
    path("api/v1/auth/", include("allauth.urls")),
    # OAuth2 for recruiter services: POST /o/token/ with grant_type=client_credentials.
    # Without this the scope-gated search endpoint has no way to issue tokens.
    path("o/", include("oauth2_provider.urls", namespace="oauth2_provider")),
    # OpenAPI 3.1 schema.
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/schema/swagger/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/v1/schema/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]