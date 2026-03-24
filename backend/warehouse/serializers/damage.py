from rest_framework import serializers
from django.utils import timezone
from warehouse.models import DamageReport


class DamageReportSerializer(serializers.ModelSerializer):
    variant_name = serializers.SerializerMethodField()
    location_name = serializers.CharField(source="location.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)

    class Meta:
        model = DamageReport
        fields = [
            "id",
            "variant",
            "variant_name",
            "location",
            "location_name",
            "quantity",
            "reason",
            "estimated_value_lost",
            "report_date",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = [
            "id", "created_at", "updated_at", "created_by",
        ]

    def get_variant_name(self, obj):
        return str(obj.variant)

    def validate_report_date(self, value):
        if value is None:
            return timezone.now()
        return value
