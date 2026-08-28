"""Serializers for the profile builder.

The builder fetches its entire working set in one request (see `BuilderView`) so
that no interaction inside the flow blocks on the network. These serializers
therefore optimise for a single dense payload rather than chatty endpoints.
"""

from rest_framework import serializers

from profiles.models import ActivityClaim, BuilderProgress, Proficiency
from taxonomy.models import Activity, CompetencyArea, Function


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = (
            "code",
            "label",
            "help_text",
            "claim_type",
            "seniority_hint",
            "variants",
        )


class CompetencyAreaSerializer(serializers.ModelSerializer):
    activities = ActivitySerializer(many=True, read_only=True)

    class Meta:
        model = CompetencyArea
        fields = ("code", "label", "description", "activities")


class FunctionTreeSerializer(serializers.ModelSerializer):
    competency_areas = CompetencyAreaSerializer(many=True, read_only=True)

    class Meta:
        model = Function
        fields = ("code", "label", "description", "competency_areas")


class ClaimSerializer(serializers.ModelSerializer):
    activity_code = serializers.SlugRelatedField(
        source="activity", slug_field="code", read_only=True
    )

    class Meta:
        model = ActivityClaim
        fields = (
            "activity_code",
            "proficiency",
            "years_experience",
            "last_used_year",
            "variants",
        )


class ClaimWriteSerializer(serializers.Serializer):
    """One claim delta from the builder's autosave.

    `claimed: false` is an explicit un-tick and deletes the row, which is why
    this is a plain Serializer rather than a ModelSerializer — the write is an
    upsert-or-delete, not a straightforward object save.
    """

    activity_code = serializers.SlugField()
    claimed = serializers.BooleanField(default=True)
    proficiency = serializers.ChoiceField(
        choices=Proficiency.choices, required=False, allow_null=True
    )
    years_experience = serializers.DecimalField(
        max_digits=4, decimal_places=1, min_value=0, max_value=60,
        required=False, allow_null=True,
    )
    last_used_year = serializers.IntegerField(
        min_value=1980, required=False, allow_null=True
    )
    variants = serializers.ListField(
        child=serializers.CharField(max_length=64), required=False, default=list
    )


class ClaimBatchSerializer(serializers.Serializer):
    """Autosave sends batches because the UI debounces rapid ticking.

    Capped at 200 — comfortably above the 107-item Statistical Programming
    taxonomy, so a legitimate "select all" of every area in one flush still fits,
    while an unbounded payload cannot be used to hammer the endpoint.
    """

    claims = ClaimWriteSerializer(many=True, allow_empty=True, max_length=200)

    def validate_claims(self, value):
        codes = [c["activity_code"] for c in value]
        if len(codes) != len(set(codes)):
            raise serializers.ValidationError("Duplicate activity_code in batch.")
        return value


class BuilderProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = BuilderProgress
        fields = ("completed_area_codes", "last_area_code", "completed_at")
        read_only_fields = ("completed_at",)


class BuilderPayloadSerializer(serializers.Serializer):
    """The single fetch that powers the whole builder flow."""

    function = FunctionTreeSerializer()
    claims = ClaimSerializer(many=True)
    progress = BuilderProgressSerializer(allow_null=True)
    years_experience = serializers.DecimalField(
        max_digits=4, decimal_places=1, allow_null=True
    )
