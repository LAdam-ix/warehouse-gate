from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from warehouse.models import DamageReport
from warehouse.serializers.damage import DamageReportSerializer
from warehouse.services.damage import report_damage
from .base import FirmScopedMixin


class DamageReportViewSet(FirmScopedMixin, viewsets.ModelViewSet):
    queryset = DamageReport.objects.select_related("variant__product", "location", "created_by")
    serializer_class = DamageReportSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["variant", "location"]
    search_fields = ["reason"]
    ordering_fields = ["report_date", "quantity", "estimated_value_lost"]
    ordering = ["-report_date"]

    def perform_create(self, serializer):
        data = serializer.validated_data
        report = report_damage(
            firm=self.get_firm(),
            variant=data["variant"],
            location=data["location"],
            quantity=data["quantity"],
            reason=data["reason"],
            note=data.get("note", ""),
            estimated_value_lost=data.get("estimated_value_lost"),
            report_date=data.get("report_date"),
            batch_id=data.get("batch_id"),
            user=self.get_user(),
        )
        # Attach instance so serializer can return it
        serializer.instance = report

    def perform_update(self, serializer):
        # Updates only affect metadata (reason, notes) — not quantity/stock
        # Stock was already moved at creation time
        serializer.save(updated_by=self.get_user())
