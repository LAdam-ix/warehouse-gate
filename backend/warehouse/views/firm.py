from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import serializers

from warehouse.models import WarehouseSettings
from warehouse.permissions import CanEditWarehouse


class FirmSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    warehouseMode = serializers.ChoiceField(
        choices=["strict", "soft", "disabled"],
        source="warehouse_mode",
    )


class FirmSettingsView(APIView):
    """
    GET  /api/v1/firm/  — return current firm settings
    PATCH /api/v1/firm/  — update editable settings (warehouse_mode)
    """
    permission_classes = [CanEditWarehouse]

    def get(self, request):
        firm = request.wh_firm
        return Response(FirmSerializer(firm).data)

    def patch(self, request):
        firm = request.wh_firm
        serializer = FirmSerializer(firm, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_mode = serializer.validated_data.get("warehouse_mode")
        if new_mode:
            firm.warehouse_mode = new_mode
            firm.save(update_fields=["warehouse_mode"])
        return Response(FirmSerializer(firm).data)


class WarehouseSettingsSerializer(serializers.Serializer):
    show_sku = serializers.BooleanField(required=False)
    skip_confirm = serializers.BooleanField(required=False)
    default_energy_rate = serializers.DecimalField(
        max_digits=10, decimal_places=4, required=False, allow_null=True
    )


class WarehouseSettingsView(APIView):
    """
    GET  /api/v1/settings/  — return warehouse UI settings
    PATCH /api/v1/settings/  — update warehouse UI settings
    """
    permission_classes = [CanEditWarehouse]

    def _get_settings(self, request):
        return WarehouseSettings.for_firm(request.wh_firm)

    def get(self, request):
        return Response(WarehouseSettingsSerializer(self._get_settings(request)).data)

    def patch(self, request):
        settings_obj = self._get_settings(request)
        serializer = WarehouseSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_fields = []
        if "show_sku" in serializer.validated_data:
            settings_obj.show_sku = serializer.validated_data["show_sku"]
            update_fields.append("show_sku")
        if "skip_confirm" in serializer.validated_data:
            settings_obj.skip_confirm = serializer.validated_data["skip_confirm"]
            update_fields.append("skip_confirm")
        if "default_energy_rate" in serializer.validated_data:
            settings_obj.default_energy_rate = serializer.validated_data["default_energy_rate"]
            update_fields.append("default_energy_rate")
        if update_fields:
            settings_obj.save(update_fields=update_fields)
        return Response(WarehouseSettingsSerializer(settings_obj).data)
