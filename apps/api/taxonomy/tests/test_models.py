import pytest
from django.core.exceptions import ValidationError
from taxonomy.models import Activity, ClaimType, CompetencyArea, Function

pytestmark = pytest.mark.django_db

def test_function_str():
    f = Function(code="sp", label="Stat Prog")
    assert str(f) == "Stat Prog"

def test_competency_area_str():
    f = Function(code="sp", label="Stat Prog")
    a = CompetencyArea(function=f, code="core", label="Core")
    assert str(a) == "sp / Core"

def test_activity_str():
    act = Activity(code="sdtm", label="SDTM IG")
    assert str(act) == "SDTM IG"

def test_activity_clean_validates_variants():
    act = Activity(code="test", label="Test")
    
    # Not a list
    act.variants = "not-a-list"
    with pytest.raises(ValidationError) as e:
        act.clean()
    assert "Must be a list of strings" in str(e.value)

    # Not strings or empty strings
    act.variants = ["v1", ""]
    with pytest.raises(ValidationError) as e:
        act.clean()
    assert "All variants must be non-empty strings" in str(e.value)

    # Duplicates
    act.variants = ["v1", "v1"]
    with pytest.raises(ValidationError) as e:
        act.clean()
    assert "Variants must be unique" in str(e.value)

def test_activity_is_scorable():
    act1 = Activity(claim_type=ClaimType.ACTIVITY)
    assert act1.is_scorable
    act2 = Activity(claim_type=ClaimType.TRAIT)
    assert not act2.is_scorable
