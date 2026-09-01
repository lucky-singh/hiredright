from django.contrib import admin

from .models import Activity, CompetencyArea, Role


class ActivityInline(admin.TabularInline):
    model = Activity.competency_areas.through
    extra = 0


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "sort_order", "is_active")
    search_fields = ("code", "label")


@admin.register(CompetencyArea)
class CompetencyAreaAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "role", "sort_order")
    list_filter = ("role",)
    search_fields = ("code", "label")
    inlines = [ActivityInline]


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "claim_type", "seniority_hint", "is_active")
    list_filter = ("claim_type", "seniority_hint", "is_active")
    search_fields = ("code", "label")