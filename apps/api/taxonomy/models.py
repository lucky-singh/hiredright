"""Taxonomy: Function → CompetencyArea → Activity.

Deliberately generic. Adding Data Management, Medical Writing or CRA later is a
seed-file change, not a migration, and Milestone 3 assessment items will attach
to `Activity` rows that already exist.
"""

from django.core.exceptions import ValidationError
from django.db import models


class ClaimType(models.TextChoices):
    """What kind of assertion an Activity represents.

    The distinction matters because only ACTIVITY and PROFICIENCY carry ranking
    signal. TRAIT items are self-reported dispositions that essentially every
    candidate claims, so including them in a match score would add noise and
    reward nothing. They are collected for the recruiter to read, not to sort by.
    """

    ACTIVITY = "activity", "Activity performed"
    PROFICIENCY = "proficiency", "Tool or technique proficiency"
    TRAIT = "trait", "Self-reported disposition"

    @classmethod
    def scorable(cls) -> list[str]:
        return [cls.ACTIVITY, cls.PROFICIENCY]


class SeniorityHint(models.TextChoices):
    """Drives the builder's "Suggested — confirm" prompts. Never auto-claims."""

    JUNIOR = "junior", "Junior"
    MID = "mid", "Mid-level"
    SENIOR = "senior", "Senior"
    LEAD = "lead", "Lead"


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Function(TimestampedModel):
    """A pharma job function, e.g. Statistical Programming."""

    code = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(
        default=True,
        help_text="Hide from the builder without deleting profile history.",
    )

    class Meta:
        ordering = ("sort_order", "label")

    def __str__(self) -> str:
        return self.label


class CompetencyArea(TimestampedModel):
    """One step of the profile builder. Roughly a dozen activities each."""

    function = models.ForeignKey(
        Function, on_delete=models.CASCADE, related_name="competency_areas"
    )
    code = models.SlugField(max_length=64)
    label = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("sort_order", "label")
        constraints = [
            models.UniqueConstraint(
                fields=("function", "code"), name="uniq_area_code_per_function"
            )
        ]

    def __str__(self) -> str:
        return f"{self.function.code} / {self.label}"


class Activity(TimestampedModel):
    """An atomic, tickable item — the unit a candidate claims and a recruiter
    searches on.

    `code` is the stable public API contract. Renaming a `label` is safe;
    changing a `code` is a breaking change for any recruiter integration.
    """

    competency_area = models.ForeignKey(
        CompetencyArea, on_delete=models.CASCADE, related_name="activities"
    )
    code = models.SlugField(max_length=96, unique=True)
    label = models.CharField(max_length=300)
    help_text = models.TextField(
        blank=True, help_text="Shown inline in the builder to disambiguate."
    )
    claim_type = models.CharField(
        max_length=16, choices=ClaimType.choices, default=ClaimType.ACTIVITY
    )
    seniority_hint = models.CharField(
        max_length=16, choices=SeniorityHint.choices, blank=True
    )
    variants = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "Optional version multi-select, e.g. SDTM IG ['3.1.2','3.2','3.3']. "
            "Empty list means a plain yes/no claim."
        ),
    )
    source_ref = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Item number in the source recruitment breakdown. Traceability only.",
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("sort_order", "label")
        indexes = [
            models.Index(fields=("claim_type",)),
            models.Index(fields=("competency_area", "sort_order")),
        ]

    def __str__(self) -> str:
        return self.label

    def clean(self) -> None:
        if not isinstance(self.variants, list):
            raise ValidationError({"variants": "Must be a list of strings."})
        if any(not isinstance(v, str) or not v.strip() for v in self.variants):
            raise ValidationError({"variants": "All variants must be non-empty strings."})
        if len(set(self.variants)) != len(self.variants):
            raise ValidationError({"variants": "Variants must be unique."})

    @property
    def is_scorable(self) -> bool:
        return self.claim_type in ClaimType.scorable()
