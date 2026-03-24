from decimal import Decimal
from rest_framework import serializers
from warehouse.models import Sale, SaleLine, ProductVariant


class SaleLineSerializer(serializers.ModelSerializer):
    line_subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    line_cost = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    line_profit = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    variant_name = serializers.SerializerMethodField()
    location_name = serializers.SerializerMethodField()

    class Meta:
        model = SaleLine
        fields = [
            "id",
            "sale",
            "variant",
            "variant_name",
            "location",
            "location_name",
            "description",
            "quantity",
            "hours",
            "unit_price",
            "discount_amount",
            "discount_note",
            "sort_order",
            "line_subtotal",
            "line_total",
            "line_cost",
            "line_profit",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "sale", "created_at", "updated_at"]

    def get_variant_name(self, obj):
        return str(obj.variant) if obj.variant else None

    def get_location_name(self, obj):
        return obj.location.name if obj.location_id else None

    def validate(self, attrs):
        variant = attrs.get("variant")
        if variant and not attrs.get("description"):
            attrs["description"] = str(variant)
        if not attrs.get("unit_price") and variant:
            attrs["unit_price"] = variant.effective_price
        return attrs


class SaleLineCreateSerializer(SaleLineSerializer):
    """Used when creating lines — allows variant lookup to prefill price."""
    variant = serializers.PrimaryKeyRelatedField(
        queryset=ProductVariant.objects.all(), required=False, allow_null=True
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "unit_price" not in attrs or attrs.get("unit_price") is None:
            variant = attrs.get("variant")
            if variant:
                attrs["unit_price"] = variant.effective_price
            else:
                attrs["unit_price"] = Decimal("0.00")
        return attrs


class SaleSerializer(serializers.ModelSerializer):
    lines = SaleLineSerializer(many=True, read_only=True)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id",
            "status",
            "note",
            "customer_label",
            "invoice_id",
            "credit_note_id",
            "discount_percentage",
            "discount_fixed",
            "finalized_at",
            "subtotal",
            "discount_total",
            "total",
            "cost_total",
            "profit",
            "lines",
            "line_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "status", "finalized_at",
            "subtotal", "discount_total", "total", "cost_total", "profit",
            "created_at", "updated_at",
        ]

    def get_line_count(self, obj):
        return obj.lines.count()


class SaleListSerializer(serializers.ModelSerializer):
    """Compact list view — no lines."""
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id", "status", "customer_label", "invoice_id", "credit_note_id",
            "total", "profit", "finalized_at", "line_count",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_line_count(self, obj):
        return obj.lines.count()


class SaleUpdateSerializer(serializers.ModelSerializer):
    """For PATCH on draft sales — only editable fields."""
    class Meta:
        model = Sale
        fields = [
            "note", "customer_label", "invoice_id",
            "discount_percentage", "discount_fixed",
        ]
