from django.contrib import admin

from .models import ActivityClaim, BuilderProgress, CandidateFunction, CandidateProfile


class CandidateFunctionInline(admin.TabularInline):
    model = CandidateFunction
    extra = 0


class ActivityClaimInline(admin.TabularInline):
    model = ActivityClaim
    extra = 0
    fields = ("activity", "proficiency", "years_experience", "last_used_year", "variants")


@admin.register(CandidateProfile)
class CandidateProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "headline", "location_country", "is_searchable", "open_to_opportunities")
    list_filter = ("is_searchable", "open_to_opportunities")
    search_fields = ("user__email", "headline")
    inlines = [CandidateFunctionInline, ActivityClaimInline]


@admin.register(ActivityClaim)
class ActivityClaimAdmin(admin.ModelAdmin):
    list_display = ("profile", "activity", "proficiency", "last_used_year")
    list_filter = ("proficiency",)
    search_fields = ("profile__user__email", "activity__code")


@admin.register(BuilderProgress)
class BuilderProgressAdmin(admin.ModelAdmin):
    list_display = ("profile", "function", "last_area_code", "completed_at")
    search_fields = ("profile__user__email",)