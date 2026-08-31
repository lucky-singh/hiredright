"""API v1 URL routing."""

from django.urls import path, include

from .views import (
    BuilderProgressView,
    BuilderView,
    CandidateSearchView,
    ClaimBatchView,
    FunctionListView,
    SkillListView,
    ResumeUploadView,
    ResumeTaskStatusView,
    CandidateProfileView,
)

urlpatterns = [
    # Auth endpoints via dj-rest-auth
    path("auth/", include("dj_rest_auth.urls")),
    path("auth/registration/", include("dj_rest_auth.registration.urls")),
    
    # Builder APIs
    path("functions/", FunctionListView.as_view(), name="function-list"),
    path("skills/", SkillListView.as_view(), name="skill-list"),
    path("builder/claims/", ClaimBatchView.as_view(), name="builder-claims"),
    path("builder/progress/", BuilderProgressView.as_view(), name="builder-progress"),
    path("profile/resume/", ResumeUploadView.as_view(), name="resume-upload"),
    path("profile/resume/status/<str:task_id>/", ResumeTaskStatusView.as_view(), name="resume-status"),
    path("profile/", CandidateProfileView.as_view(), name="candidate-profile"),
    path("builder/<slug:function_code>/", BuilderView.as_view(), name="builder"),
    path("search/", CandidateSearchView.as_view(), name="candidate-search"),
]