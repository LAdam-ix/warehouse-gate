from rest_framework import serializers
from django.utils import timezone
from warehouse.models import Location, StockEntry, StockMovement


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = [
            "id", "name", "description", "is_default", "is_active",
            "sort_order", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StockEntrySerializer(serializers.ModelSerializer):
    variant_name = serializers.SerializerMethodField()
    location_name = serializers.CharField(source="location.name", read_only=True)
    product_name = serializers.CharField(source="variant.product.name", read_only=True)

    class Meta:
        model = StockEntry
        fields = [
            "id", "variant", "variant_name", "product_name",
            "location", "location_name", "quantity",
        ]
        read_only_fields = ["id"]

    def get_variant_name(self, obj):
        return str(obj.variant)


class StockMovementSerializer(serializers.ModelSerializer):
    variant_name = serializers.SerializerMethodField()
    location_name = serializers.CharField(source="location.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)
    is_revertable = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "variant",
            "variant_name",
            "location",
            "location_name",
            "movement_type",
            "quantity_delta",
            "note",
            "movement_date",
            "batch_id",
            "sale_line",
            "damage_report",
            "is_revertable",
            "created_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = [
            "id", "created_at", "created_by", "sale_line", "damage_report", "batch_id",
        ]

    def get_variant_name(self, obj):
        return str(obj.variant)

    def get_is_revertable(self, obj):
        from warehouse.services.stock import REVERTABLE_TYPES
        if obj.movement_type not in REVERTABLE_TYPES:
            return False
        return not StockMovement.objects.filter(
            variant=obj.variant,
            location=obj.location,
            created_at__gt=obj.created_at,
        ).exists()


class AddStockSerializer(serializers.Serializer):
    """Input for the 'add stock' bulk screen."""
    class AddStockLineSerializer(serializers.Serializer):
        variant_id = serializers.UUIDField()
        quantity = serializers.IntegerField(min_value=1)
        # Optional per-line override; falls back to top-level location_id
        location_id = serializers.UUIDField(required=False, allow_null=True)

    lines = AddStockLineSerializer(many=True)
    location_id = serializers.UUIDField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")
    movement_date = serializers.DateTimeField(required=False, default=timezone.now)


class AdjustStockSerializer(serializers.Serializer):
    variant_id = serializers.UUIDField()
    location_id = serializers.UUIDField()
    new_quantity = serializers.IntegerField()
    note = serializers.CharField(required=False, allow_blank=True, default="")
    movement_date = serializers.DateTimeField(required=False, default=timezone.now)


class TransferStockSerializer(serializers.Serializer):
    variant_id = serializers.UUIDField()
    from_location_id = serializers.UUIDField()
    to_location_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)
    note = serializers.CharField(required=False, allow_blank=True, default="")
    movement_date = serializers.DateTimeField(required=False, default=timezone.now)


class BatchTransferSerializer(serializers.Serializer):
    """Input for bulk transfer — many items to one destination."""
    class TransferLineSerializer(serializers.Serializer):
        variant_id = serializers.UUIDField()
        from_location_id = serializers.UUIDField()
        quantity = serializers.IntegerField(min_value=1)

    lines = TransferLineSerializer(many=True)
    to_location_id = serializers.UUIDField()
    note = serializers.CharField(required=False, allow_blank=True, default="")
    movement_date = serializers.DateTimeField(required=False, default=timezone.now)
