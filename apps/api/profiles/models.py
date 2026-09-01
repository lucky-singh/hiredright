"""Candidate profiles and the activity claims that constitute them."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from taxonomy.models import Activity, Role, TimestampedModel


class Proficiency(models.IntegerChoices):
    """Ordered so it can be used directly as a scoring multiplier input."""

    EXPOSED = 1, "Some exposure"
    WORKING = 2, "Working knowledge"
    PROFICIENT = 3, "Proficient"
    EXPERT = 4, "Expert / can lead others"


class CandidateProfile(TimestampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    headline = models.CharField(max_length=200, blank=True)
    location_country = models.CharField(max_length=2, blank=True, help_text="ISO 3166-1 alpha-2.")
    resume = models.FileField(upload_to="resumes/", null=True, blank=True)
    open_to_opportunities = models.BooleanField(default=True)
    is_searchable = models.BooleanField(
        default=True,
        help_text="Candidate-controlled. When false the profile is excluded from recruiter search.",
    )

    def __str__(self) -> str:
        return f"Profile<{self.user_id}>"


class CandidateRole(TimestampedModel):
    """Which functions the candidate works in, and for how long."""

    profile = models.ForeignKey(
        CandidateProfile, on_delete=models.CASCADE, related_name="roles"
    )
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="+")
    years_experience = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        validators=[MinValueValidator(0), MaxValueValidator(60)],
    )
    is_primary = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("profile", "role"), name="uniq_role_per_profile"
            )
        ]


class ActivityClaim(TimestampedModel):
    """A candidate asserting they have done a specific thing.

    Upserted by the builder's debounced autosave, so the (profile, activity)
    uniqueness constraint is doing real work — a double-fired PATCH must not
    create a duplicate row.
    """

    profile = models.ForeignKey(
        CandidateProfile, on_delete=models.CASCADE, related_name="claims"
    )
    activity = models.ForeignKey(Activity, on_delete=models.PROTECT, related_name="claims")
    proficiency = models.PositiveSmallIntegerField(
        choices=Proficiency.choices, null=True, blank=True
    )
    years_experience = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(60)],
    )
    is_ai_inferred = models.BooleanField(
        default=False,
        help_text="True if this claim was automatically extracted from a resume by AI"
    )
    last_used_year = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Drives recency decay in match scoring.",
    )
    variants = models.JSONField(
        default=list,
        blank=True,
        help_text="Subset of Activity.variants the candidate claims.",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("profile", "activity"), name="uniq_claim_per_profile_activity"
            )
        ]
        indexes = [
            # Recruiter search filters on activity then joins back to profiles.
            models.Index(fields=("activity", "profile")),
            models.Index(fields=("profile", "activity")),
        ]

    def __str__(self) -> str:
        return f"{self.profile_id} → {self.activity.code}"

    def clean(self) -> None:
        errors = {}

        if self.last_used_year is not None:
            current_year = timezone.now().year
            if not (1980 <= self.last_used_year <= current_year):
                errors["last_used_year"] = f"Must be between 1980 and {current_year}."

        if self.variants:
            allowed = set(self.activity.variants or [])
            if not allowed:
                errors["variants"] = "This activity does not define variants."
            else:
                unknown = sorted(set(self.variants) - allowed)
                if unknown:
                    errors["variants"] = f"Unknown variant(s): {', '.join(unknown)}."

        if errors:
            raise ValidationError(errors)


class BuilderProgress(TimestampedModel):
    """Where the candidate got to, so the builder can resume exactly.

    Stored server-side rather than in localStorage so progress survives a device
    change — the plan's "never lose work" requirement.
    """

    profile = models.OneToOneField(
        CandidateProfile, on_delete=models.CASCADE, related_name="builder_progress"
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="+")
    completed_area_codes = models.JSONField(default=list, blank=True)
    last_area_code = models.CharField(max_length=64, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
