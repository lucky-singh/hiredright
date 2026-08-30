"""API v1 URL routing."""

from django.urls import path

from .views import (
    BuilderProgressView,
    BuilderView,
    CandidateSearchView,
    ClaimBatchView,
)

urlpatterns = [
    path("builder/<slug:function_code>/", BuilderView.as_view(), name="builder"),
    path("builder/claims/", ClaimBatchView.as_view(), name="builder-claims"),
    path("builder/progress/", BuilderProgressView.as_view(), name="builder-progress"),
    path("search/", CandidateSearchView.as_view(), name="candidate-search"),
]