"""Idempotently load a function taxonomy from YAML.

    python manage.py seed_taxonomy statistical-programming

Safe to re-run every time the taxonomy file changes — that is the whole point,
since the taxonomy is expected to be revised by domain reviewers rather than
frozen at launch.

Activities are never deleted. `ActivityClaim.activity` is PROTECT, so deleting a
row would either fail or destroy candidate history; instead, activities absent
from the file are deactivated with --prune and simply stop appearing in the
builder while existing claims stay intact and auditable.
"""

from pathlib import Path

import yaml
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from taxonomy.models import Activity, ClaimType, CompetencyArea, Function, SeniorityHint

DEFAULT_SEED_DIR = Path(__file__).resolve().parents[2] / "seed"

VALID_CLAIM_TYPES = {c for c, _ in ClaimType.choices}
VALID_SENIORITY = {s for s, _ in SeniorityHint.choices}


class Command(BaseCommand):
    help = "Load or refresh a function taxonomy from a YAML seed file."

    def add_arguments(self, parser):
        parser.add_argument(
            "function_code",
            help="Function code, e.g. statistical-programming. Also the default filename.",
        )
        parser.add_argument(
            "--path",
            default=None,
            help="Explicit path to the YAML file. Defaults to taxonomy/seed/<code>.yaml",
        )
        parser.add_argument(
            "--prune",
            action="store_true",
            help="Deactivate activities present in the DB but absent from the file.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing.",
        )

    def handle(self, *args, **options):
        code = options["function_code"]
        path = Path(options["path"]) if options["path"] else (
            DEFAULT_SEED_DIR / f"{code.replace('-', '_')}.yaml"
        )
        if not path.exists():
            raise CommandError(f"Seed file not found: {path}")

        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        self._validate(data, path)

        with transaction.atomic():
            function = self._upsert_function(data["function"])
            seen_activity_codes: set[str] = set()

            for area_order, area_data in enumerate(data["competency_areas"]):
                area = self._upsert_area(function, area_data, area_order)
                for act_order, act_data in enumerate(area_data.get("activities") or []):
                    activity = self._upsert_activity(area, act_data, act_order)
                    seen_activity_codes.add(activity.code)

            pruned = 0
            if options["prune"]:
                pruned = (
                    Activity.objects.filter(competency_area__function=function, is_active=True)
                    .exclude(code__in=seen_activity_codes)
                    .update(is_active=False)
                )

            if options["dry_run"]:
                transaction.set_rollback(True)

        verb = "Would seed" if options["dry_run"] else "Seeded"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {function.label}: "
                f"{len(data['competency_areas'])} areas, "
                f"{len(seen_activity_codes)} activities"
                + (f", {pruned} deactivated" if pruned else "")
            )
        )

    # -- validation -----------------------------------------------------------

    def _validate(self, data, path: Path) -> None:
        """Fail loudly and specifically. A typo'd claim_type would otherwise
        silently drop an item out of match scoring, which is very hard to notice
        later from the UI alone."""
        if not isinstance(data, dict) or "function" not in data:
            raise CommandError(f"{path}: expected a top-level 'function' key.")
        if "competency_areas" not in data:
            raise CommandError(f"{path}: expected a top-level 'competency_areas' key.")

        codes: set[str] = set()
        for area in data["competency_areas"]:
            for act in area.get("activities") or []:
                act_code = act.get("code")
                if not act_code:
                    raise CommandError(f"{path}: activity missing 'code' in area {area.get('code')}")
                if act_code in codes:
                    raise CommandError(f"{path}: duplicate activity code '{act_code}'")
                codes.add(act_code)

                claim_type = act.get("claim_type", ClaimType.ACTIVITY)
                if claim_type not in VALID_CLAIM_TYPES:
                    raise CommandError(
                        f"{path}: activity '{act_code}' has invalid claim_type "
                        f"'{claim_type}'. Expected one of {sorted(VALID_CLAIM_TYPES)}."
                    )

                seniority = act.get("seniority_hint", "")
                if seniority and seniority not in VALID_SENIORITY:
                    raise CommandError(
                        f"{path}: activity '{act_code}' has invalid seniority_hint "
                        f"'{seniority}'. Expected one of {sorted(VALID_SENIORITY)}."
                    )

                variants = act.get("variants") or []
                if not isinstance(variants, list) or any(not isinstance(v, str) for v in variants):
                    raise CommandError(
                        f"{path}: activity '{act_code}' variants must be a list of strings."
                    )

    # -- upserts --------------------------------------------------------------

    def _upsert_function(self, fn_data: dict) -> Function:
        function, _ = Function.objects.update_or_create(
            code=fn_data["code"],
            defaults={
                "label": fn_data["label"],
                "description": (fn_data.get("description") or "").strip(),
                "is_active": True,
            },
        )
        return function

    def _upsert_area(self, function: Function, area_data: dict, order: int) -> CompetencyArea:
        area, _ = CompetencyArea.objects.update_or_create(
            function=function,
            code=area_data["code"],
            defaults={
                "label": area_data["label"],
                "description": (area_data.get("description") or "").strip(),
                "sort_order": order,
            },
        )
        return area

    def _upsert_activity(self, area: CompetencyArea, act_data: dict, order: int) -> Activity:
        activity, _ = Activity.objects.update_or_create(
            code=act_data["code"],
            defaults={
                "competency_area": area,
                "label": act_data["label"],
                "help_text": (act_data.get("help_text") or "").strip(),
                "claim_type": act_data.get("claim_type", ClaimType.ACTIVITY),
                "seniority_hint": act_data.get("seniority_hint", ""),
                "variants": act_data.get("variants") or [],
                "source_ref": act_data.get("source_ref"),
                "sort_order": order,
                "is_active": True,
            },
        )
        return activity
