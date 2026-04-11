from rest_framework import serializers
from warehouse.models import ProductionRequest


class ProductionRequestSerializer(serializers.ModelSerializer):
    variant_name = serializers.SerializerMethodField()
    product_name = serializers.CharField(source="variant.product.name", read_only=True)
    product_id = serializers.UUIDField(source="variant.product.id", read_only=True)
    variant_photo_url = serializers.SerializerMethodField()
    variant_color_hex = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)
    fulfilled_by_name = serializers.CharField(source="fulfilled_by.name", read_only=True)

    class Meta:
        model = ProductionRequest
        fields = [
            "id",
            "variant",
            "variant_name",
            "variant_photo_url",
            "variant_color_hex",
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

    def get_variant_photo_url(self, obj):
        v = obj.variant
        # Gallery photo first, then variant's own photo, then product primary photo
        if v.gallery_photo_id:
            request = self.context.get("request")
            url = v.gallery_photo.image.url
            return request.build_absolute_uri(url) if request else url
        if v.photo:
            request = self.context.get("request")
            return request.build_absolute_uri(v.photo.url) if request else v.photo.url
        primary = v.product.photos.filter(is_primary=True).first()
        if primary:
            request = self.context.get("request")
            return request.build_absolute_uri(primary.image.url) if request else primary.image.url
        return None

    def get_variant_color_hex(self, obj):
        for av in obj.variant.attribute_values.all():
            if av.color_hex:
                return av.color_hex
        return None


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
