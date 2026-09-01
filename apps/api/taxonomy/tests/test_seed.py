import pytest
from io import StringIO
from django.core.management import call_command
from django.core.management.base import CommandError
from taxonomy.models import Role, CompetencyArea, Activity
import yaml

pytestmark = pytest.mark.django_db

def test_seed_taxonomy_success(tmp_path):
    yaml_content = {
        "role": {
            "code": "test-func",
            "label": "Test Role"
        },
        "competency_areas": [
            {
                "code": "area-1",
                "label": "Area 1",
                "activities": [
                    {
                        "code": "act-1",
                        "label": "Act 1",
                        "claim_type": "activity",
                        "variants": ["v1"]
                    }
                ]
            }
        ]
    }
    file_path = tmp_path / "test_func.yaml"
    with open(file_path, "w") as f:
        yaml.dump(yaml_content, f)

    out = StringIO()
    call_command("seed_taxonomy", "test-func", path=str(file_path), stdout=out)
    
    assert Role.objects.filter(code="test-func").exists()
    assert CompetencyArea.objects.filter(code="area-1").exists()
    assert Activity.objects.filter(code="act-1").exists()
    
    act = Activity.objects.get(code="act-1")
    assert act.competency_areas.count() == 1

def test_seed_taxonomy_prune(tmp_path):
    # First seed
    yaml_content1 = {
        "role": {"code": "prune-func", "label": "Prune Func"},
        "competency_areas": [{"code": "area-1", "label": "Area 1", "activities": [{"code": "act-1", "label": "Act 1"}]}]
    }
    file1 = tmp_path / "prune1.yaml"
    with open(file1, "w") as f:
        yaml.dump(yaml_content1, f)
    call_command("seed_taxonomy", "prune-func", path=str(file1))
    
    assert Activity.objects.get(code="act-1").is_active is True

    # Second seed, missing act-1, with prune
    yaml_content2 = {
        "role": {"code": "prune-func", "label": "Prune Func"},
        "competency_areas": [{"code": "area-1", "label": "Area 1", "activities": []}]
    }
    file2 = tmp_path / "prune2.yaml"
    with open(file2, "w") as f:
        yaml.dump(yaml_content2, f)
        
    call_command("seed_taxonomy", "prune-func", path=str(file2), prune=True)
    
    act = Activity.objects.get(code="act-1")
    assert act.is_active is False
    assert act.competency_areas.count() == 0

def test_seed_taxonomy_dry_run(tmp_path):
    yaml_content = {
        "role": {"code": "dry-func", "label": "Dry Func"},
        "competency_areas": [{"code": "area-1", "label": "Area 1", "activities": [{"code": "act-dry", "label": "Act Dry"}]}]
    }
    file_path = tmp_path / "dry.yaml"
    with open(file_path, "w") as f:
        yaml.dump(yaml_content, f)
        
    call_command("seed_taxonomy", "dry-func", path=str(file_path), dry_run=True)
    assert not Role.objects.filter(code="dry-func").exists()

def test_seed_taxonomy_validation_errors(tmp_path):
    file_path = tmp_path / "err.yaml"
    with open(file_path, "w") as f:
        yaml.dump({}, f)
    
    with pytest.raises(CommandError) as e:
        call_command("seed_taxonomy", "err-func", path=str(file_path))
    assert "expected a top-level 'role' key." in str(e.value)

    with open(file_path, "w") as f:
        yaml.dump({"role": {}}, f)
    with pytest.raises(CommandError):
        call_command("seed_taxonomy", "err-func", path=str(file_path))

    with open(file_path, "w") as f:
        yaml.dump({
            "role": {"code": "err", "label": "err"},
            "competency_areas": [{"activities": [{}]}]
        }, f)
    with pytest.raises(CommandError) as e:
        call_command("seed_taxonomy", "err-func", path=str(file_path))
    assert "missing 'code'" in str(e.value)
    
    with open(file_path, "w") as f:
        yaml.dump({
            "role": {"code": "err", "label": "err"},
            "competency_areas": [{"activities": [{"code": "a"}, {"code": "a"}]}]
        }, f)
    with pytest.raises(CommandError) as e:
        call_command("seed_taxonomy", "err-func", path=str(file_path))
    assert "duplicate activity code" in str(e.value)

    with open(file_path, "w") as f:
        yaml.dump({
            "role": {"code": "err", "label": "err"},
            "competency_areas": [{"activities": [{"code": "a", "claim_type": "invalid"}]}]
        }, f)
    with pytest.raises(CommandError) as e:
        call_command("seed_taxonomy", "err-func", path=str(file_path))
    assert "invalid claim_type" in str(e.value)

    with open(file_path, "w") as f:
        yaml.dump({
            "role": {"code": "err", "label": "err"},
            "competency_areas": [{"activities": [{"code": "a", "seniority_hint": "invalid"}]}]
        }, f)
    with pytest.raises(CommandError) as e:
        call_command("seed_taxonomy", "err-func", path=str(file_path))
    assert "invalid seniority_hint" in str(e.value)

    with open(file_path, "w") as f:
        yaml.dump({
            "role": {"code": "err", "label": "err"},
            "competency_areas": [{"activities": [{"code": "a", "variants": "not-a-list"}]}]
        }, f)
    with pytest.raises(CommandError) as e:
        call_command("seed_taxonomy", "err-func", path=str(file_path))
    assert "variants must be a list" in str(e.value)

def test_missing_file():
    with pytest.raises(CommandError) as e:
        call_command("seed_taxonomy", "no-such-file", path="/does/not/exist.yaml")
    assert "Seed file not found" in str(e.value)
