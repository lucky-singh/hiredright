"""Serializers for the profile builder and recruiter search.

The builder fetches its entire working set in one request (see `BuilderView`) so
that no interaction inside the flow blocks on the network. These serializers
therefore optimise for a single dense payload rather than chatty endpoints.

Validation lives here rather than relying on model `clean()`: the write path
upserts with `update_or_create`, which does not call `full_clean()`, so anything
not checked at this layer reaches the database unchecked.
"""

from django.utils import timezone
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


class FunctionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Function
        fields = ("code", "label", "description")


class SkillAreaSerializer(serializers.ModelSerializer):
    """Where a skill lives — carried on the skill itself, not the other way round.

    The search UI needs a heading for each chip group and, for a cross-function
    query, a label saying which function a hit came from.
    """

    function_code = serializers.CharField(source="function.code", read_only=True)
    function_label = serializers.CharField(source="function.label", read_only=True)

    class Meta:
        model = CompetencyArea
        fields = ("code", "label", "sort_order", "function_code", "function_label")


class SkillSerializer(serializers.ModelSerializer):
    """One searchable skill, flattened for the recruiter's chip list.

    `areas` is a list because `Activity.competency_areas` is many-to-many by
    design — an activity like ICH-GCP Compliance is deliberately reused across
    functions. Filtering by `function` narrows it to one entry; an unscoped `q`
    search relies on the full list to say where each hit came from.
    """

    areas = SkillAreaSerializer(source="competency_areas", many=True, read_only=True)

    class Meta:
        model = Activity
        fields = (
            "code",
            "label",
            "help_text",
            "claim_type",
            "seniority_hint",
            "variants",
            "areas",
        )


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

    def validate_last_used_year(self, value):
        """Upper bound is "now", which a static `max_value` cannot express."""
        if value is None:
            return value
        this_year = timezone.now().year
        if value > this_year:
            raise serializers.ValidationError(
                f"Cannot be in the future (this year is {this_year})."
            )
        return value

    def validate_variants(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Variants must be unique.")
        return value


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
    """Both directions of the resume state.

    `function_code` is writable and validated against the taxonomy: the view
    previously read it straight off `request.data`, so a missing or unknown code
    surfaced as a bare 404 with no indication of which field was at fault.
    """

    function_code = serializers.SlugRelatedField(
        source="function", slug_field="code", queryset=Function.objects.all()
    )

    class Meta:
        model = BuilderProgress
        fields = (
            "function_code",
            "completed_area_codes",
            "last_area_code",
            "completed_at",
        )
        read_only_fields = ("completed_at",)

    def validate_completed_area_codes(self, value):
        if not all(isinstance(code, str) for code in value):
            raise serializers.ValidationError("Must be a list of area code strings.")
        return value


class BuilderPayloadSerializer(serializers.Serializer):
    """The single fetch that powers the whole builder flow."""

    function = FunctionTreeSerializer()
    claims = ClaimSerializer(many=True)
    progress = BuilderProgressSerializer(allow_null=True)
    years_experience = serializers.DecimalField(
        max_digits=4, decimal_places=1, allow_null=True
    )


class CandidateSearchSerializer(serializers.Serializer):
    """A recruiter query.

    Validated rather than read off `request.data` directly so that a malformed
    `limit` or a `required_variants` key naming an activity nobody asked for
    comes back as a 400 naming the field, not a 500 or a silently ignored
    constraint.
    """

    required_activity_codes = serializers.ListField(
        child=serializers.SlugField(max_length=96), required=False, default=list
    )
    optional_activity_codes = serializers.ListField(
        child=serializers.SlugField(max_length=96), required=False, default=list
    )
    required_variants = serializers.DictField(
        child=serializers.ListField(
            child=serializers.CharField(max_length=64), allow_empty=False
        ),
        required=False,
        default=dict,
    )
    include_near_misses = serializers.BooleanField(default=False)
    limit = serializers.IntegerField(min_value=1, max_value=100, default=50)

    def validate(self, attrs):
        required = set(attrs["required_activity_codes"])
        optional = set(attrs["optional_activity_codes"])

        if not required and not optional:
            raise serializers.ValidationError(
                "Provide at least one required or optional activity code. An "
                "unconstrained search would return the entire candidate pool "
                "scored at zero."
            )

        # A variant constraint on a code that is not being searched is silently
        # inert, which reads as "we searched for SDTM IG 3.3" when nothing did.
        orphaned = sorted(set(attrs["required_variants"]) - required)
        if orphaned:
            raise serializers.ValidationError(
                {
                    "required_variants": (
                        "Only required_activity_codes can carry a variant "
                        f"constraint; not searched: {', '.join(orphaned)}."
                    )
                }
            )
        return attrs
