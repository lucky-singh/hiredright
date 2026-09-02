"""API v1 URL routing."""

from django.urls import path, include
from django.views.generic import RedirectView
from django.conf import settings

from .views import (
    BuilderProgressView,
    BuilderView,
    CandidateSearchView,
    ClaimBatchView,
    RoleListView,
    SkillListView,
    ResumeUploadView,
    ResumeTaskStatusView,
    CandidateProfileView,
    HealthCheckView,
)

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health-check"),
    # Auth endpoints via dj-rest-auth
    path("auth/", include("dj_rest_auth.urls")),
    path("auth/registration/", include("dj_rest_auth.registration.urls")),
    
    # Required for dj-rest-auth to build the password reset email link
    path(
        "auth/password/reset/confirm/<str:uidb64>/<str:token>/",
        RedirectView.as_view(url=f"{settings.FRONTEND_URL}/reset-password?uid=%(uidb64)s&token=%(token)s"),
        name="password_reset_confirm",
    ),
    
    # Builder APIs
    path("roles/", RoleListView.as_view(), name="role-list"),
    path("skills/", SkillListView.as_view(), name="skill-list"),
    path("builder/claims/", ClaimBatchView.as_view(), name="builder-claims"),
    path("builder/progress/", BuilderProgressView.as_view(), name="builder-progress"),
    path("profile/resume/", ResumeUploadView.as_view(), name="resume-upload"),
    path("profile/resume/status/<str:task_id>/", ResumeTaskStatusView.as_view(), name="resume-status"),
    path("profile/", CandidateProfileView.as_view(), name="candidate-profile"),
    path("builder/<slug:role_code>/", BuilderView.as_view(), name="builder"),
    path("search/", CandidateSearchView.as_view(), name="candidate-search"),
]