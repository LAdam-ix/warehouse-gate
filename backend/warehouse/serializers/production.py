from rest_framework import serializers
from warehouse.models import ProductionRequest


class ProductionRequestSerializer(serializers.ModelSerializer):
    variant_name = serializers.SerializerMethodField()
    product_name = serializers.CharField(source="variant.product.name", read_only=True)
    product_id = serializers.UUIDField(source="variant.product.id", read_only=True)
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)
    fulfilled_by_name = serializers.CharField(source="fulfilled_by.name", read_only=True)

    class Meta:
        model = ProductionRequest
        fields = [
            "id",
            "variant",
            "variant_name",
            "product_id",
            "product_name",
            "quantity_requested",
            "quantity_target",
            "status",
            "trigger",
            "note",
            "fulfilled_at",
            "fulfilled_by",
            "fulfilled_by_name",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = [
            "id", "created_at", "updated_at", "created_by",
            "fulfilled_at", "fulfilled_by",
        ]

    def get_variant_name(self, obj):
        return str(obj.variant)


class ProductionRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionRequest
        fields = [
            "variant",
            "quantity_requested",
            "quantity_target",
            "trigger",
            "note",
        ]
