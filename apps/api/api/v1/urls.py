"""API v1 URL routing."""

from django.urls import path

from .views import (
    BuilderProgressView,
    BuilderView,
    CandidateSearchView,
    ClaimBatchView,
    FunctionListView,
    SkillListView,
    ResumeUploadView,
    CandidateProfileView,
)

urlpatterns = [
    path("functions/", FunctionListView.as_view(), name="function-list"),
    path("skills/", SkillListView.as_view(), name="skill-list"),
    path("builder/claims/", ClaimBatchView.as_view(), name="builder-claims"),
    path("builder/progress/", BuilderProgressView.as_view(), name="builder-progress"),
    path("profile/resume/", ResumeUploadView.as_view(), name="resume-upload"),
    path("profile/", CandidateProfileView.as_view(), name="candidate-profile"),
    path("builder/<slug:function_code>/", BuilderView.as_view(), name="builder"),
    path("search/", CandidateSearchView.as_view(), name="candidate-search"),
]