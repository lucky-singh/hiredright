"""API v1 URL routing."""

from django.urls import path

from .views import (
    BuilderProgressView,
    BuilderView,
    CandidateSearchView,
    ClaimBatchView,
    FunctionListView,
)

urlpatterns = [
    path("functions/", FunctionListView.as_view(), name="function-list"),
    path("builder/claims/", ClaimBatchView.as_view(), name="builder-claims"),
    path("builder/progress/", BuilderProgressView.as_view(), name="builder-progress"),
    path("builder/<slug:function_code>/", BuilderView.as_view(), name="builder"),
    path("search/", CandidateSearchView.as_view(), name="candidate-search"),
]