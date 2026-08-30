"""Pytest fixtures shared across the test suite.

The scoring tests are pure (no ORM) and must run without a database. Tests that
touch the ORM opt in via the `db` fixture (directly or through one of the
fixtures below), so the pure suite stays fast and database-independent.
"""

from datetime import date
from types import SimpleNamespace

import pytest


@pytest.fixture
def today():
    """A fixed date for deterministic scoring tests."""
    return date(2026, 8, 28)


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def candidate(db):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create_user(
        email="candidate@example.com", password="not-a-real-password"
    )


@pytest.fixture
def taxonomy(db):
    """A miniature Statistical Programming tree covering every claim_type.

    Deliberately includes a TRAIT and an inactive activity: those are the two
    cases where the SQL pre-filter and the pure scorer have to agree about what
    counts, and where a disagreement is invisible in the happy path.
    """
    from taxonomy.models import Activity, ClaimType, CompetencyArea, Function

    function = Function.objects.create(
        code="statistical-programming", label="Statistical Programming"
    )
    other_function = Function.objects.create(
        code="data-management", label="Data Management"
    )
    area = CompetencyArea.objects.create(
        function=function, code="cdisc-sdtm", label="CDISC SDTM"
    )
    sdtm = Activity.objects.create(
        code="sdtm-implementation-guide",
        label="SDTM Implementation Guide versions",
        claim_type=ClaimType.PROFICIENCY,
        variants=["3.2", "3.3"],
    )
    sdtm.competency_areas.add(area)
    
    adam = Activity.objects.create(
        code="adam-implementation-guide",
        label="ADaM Implementation Guide versions",
        claim_type=ClaimType.ACTIVITY,
    )
    adam.competency_areas.add(area)
    
    trait = Activity.objects.create(
        code="quality-mindset",
        label="Quality mindset",
        claim_type=ClaimType.TRAIT,
    )
    trait.competency_areas.add(area)
    
    retired = Activity.objects.create(
        code="retired-activity",
        label="Retired activity",
        claim_type=ClaimType.ACTIVITY,
        is_active=False,
    )
    retired.competency_areas.add(area)

    return SimpleNamespace(
        function=function,
        other_function=other_function,
        area=area,
        sdtm=sdtm,
        adam=adam,
        trait=trait,
        retired=retired,
    )


@pytest.fixture
def profile(candidate):
    from profiles.models import CandidateProfile

    return CandidateProfile.objects.create(user=candidate)
