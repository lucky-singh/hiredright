"""Permissions for API v1.

Candidate endpoints are gated by ordinary authentication. Recruiter search is
different in kind: it reads across the whole candidate pool, so it is restricted
to OAuth2 client-credentials tokens carrying an explicit scope, or to users
explicitly flagged as recruiters. A candidate's own JWT must never open it.
"""

from __future__ import annotations

from django.conf import settings
from rest_framework.permissions import BasePermission


class HasRecruiterSearchScope(BasePermission):
    """Require an OAuth2 access token carrying the recruiter search scope.

    Deliberately hand-rolled rather than using `TokenHasScope`: that class
    raises `ImproperlyConfigured` (a 500) when the request authenticated by some
    other means, which would turn a candidate probing this endpoint into a
    server error instead of a clean 403.
    """

    message = "Requires an OAuth2 token with the 'candidates:search' scope."

    def has_permission(self, request, view) -> bool:
        granted = getattr(request.auth, "scope", None)
        if not isinstance(granted, str):
            return False
        return settings.RECRUITER_SEARCH_SCOPE in granted.split()


class IsRecruiterUser(BasePermission):
    """Require a logged-in user explicitly flagged as a recruiter.

    This is the browser path: a recruiter is a person with a JWT, not a service
    holding a client secret, and a confidential OAuth2 client cannot live in a
    single-page app. The flag is what keeps that path narrow — being
    authenticated is not sufficient, so a candidate signing in through the same
    SPA still cannot enumerate the pool.
    """

    message = "Requires a recruiter account."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "is_recruiter", False)
        )
