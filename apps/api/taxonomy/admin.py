from django.contrib import admin

from .models import Activity, CompetencyArea, Function


class ActivityInline(admin.TabularInline):
    model = Activity
    extra = 0
    fields = ("code", "label", "claim_type", "seniority_hint", "sort_order", "is_active")


@admin.register(Function)
class FunctionAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "sort_order", "is_active")
    search_fields = ("code", "label")


@admin.register(CompetencyArea)
class CompetencyAreaAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "function", "sort_order")
    list_filter = ("function",)
    search_fields = ("code", "label")
    inlines = [ActivityInline]


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "claim_type", "seniority_hint", "is_active")
    list_filter = ("claim_type", "seniority_hint", "is_active")
    search_fields = ("code", "label")