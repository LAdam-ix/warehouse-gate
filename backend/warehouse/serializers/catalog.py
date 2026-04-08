from rest_framework import serializers
from warehouse.models import (
    Category,
    Product,
    ProductCost,
    ProductPhoto,
    VariantAttribute,
    AttributeValue,
    ProductVariant,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProductCostSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    def to_internal_value(self, data):
        # Coerce empty strings to "0" so the form can send blank fields
        decimal_fields = ["material", "energy_kwh", "energy_rate", "labor_hours", "labor_rate", "other"]
        data = {**data}  # copy so we don't mutate the original
        for field in decimal_fields:
            if data.get(field) == "":
                data[field] = "0"
        return super().to_internal_value(data)

    class Meta:
        model = ProductCost
        fields = [
            "material",
            "energy_kwh",
            "energy_rate",
            "labor_hours",
            "labor_rate",
            "other",
            "notes",
            "total",
        ]


class ProductPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductPhoto
        fields = ["id", "image", "sort_order", "is_primary", "created_at"]
        read_only_fields = ["id", "created_at"]


class AttributeValueSerializer(serializers.ModelSerializer):
    # Write-only FK: required when creating via /attribute-values/, not present on reads
    attribute = serializers.PrimaryKeyRelatedField(
        queryset=VariantAttribute.objects.all(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = AttributeValue
        fields = ["id", "value", "color_hex", "sort_order", "price_delta", "cost_delta", "weight_delta", "attribute"]
        read_only_fields = ["id"]


class VariantAttributeSerializer(serializers.ModelSerializer):
    values = AttributeValueSerializer(many=True, read_only=True)
    # Write-only FK: required when creating via /attributes/, not present on reads
    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = VariantAttribute
        fields = ["id", "name", "attribute_type", "sort_order", "values", "product"]
        read_only_fields = ["id"]


class ProductVariantSerializer(serializers.ModelSerializer):
    effective_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    effective_cost = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    effective_weight = serializers.DecimalField(
        max_digits=10, decimal_places=3, read_only=True, allow_null=True
    )
    total_stock = serializers.IntegerField(read_only=True)
    stock_by_location = serializers.SerializerMethodField()
    is_low_stock = serializers.BooleanField(read_only=True)
    attribute_values = serializers.SerializerMethodField()
    attribute_value_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=AttributeValue.objects.all(),
        write_only=True,
        source="attribute_values",
        required=False,
    )

    def get_stock_by_location(self, obj):
        """Returns {location_id: quantity} for entries with non-zero stock."""
        entries = obj.stock_entries.exclude(quantity=0).select_related("location")
        return {str(e.location_id): e.quantity for e in entries}

    def get_attribute_values(self, obj):
        # Order by parent attribute's sort_order first, then value's own sort_order.
        # attribute__id is the tiebreaker so equal sort_orders are still deterministic
        # (handles products created before sort_order was populated).
        qs = obj.attribute_values.select_related("attribute").order_by(
            "attribute__sort_order", "attribute__id", "sort_order"
        )
        return AttributeValueSerializer(qs, many=True).data
    gallery_photo_url = serializers.SerializerMethodField()

    def get_gallery_photo_url(self, obj):
        if obj.gallery_photo_id:
            request = self.context.get("request")
            url = obj.gallery_photo.image.url
            return request.build_absolute_uri(url) if request else url
        if obj.photo:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url
        return None

    def update(self, instance, validated_data):
        # Handle M2M separately (DRF doesn't do it automatically in all versions)
        attribute_values = validated_data.pop("attribute_values", None)
        instance = super().update(instance, validated_data)
        if attribute_values is not None:
            instance.attribute_values.set(attribute_values)
        return instance

    class Meta:
        model = ProductVariant
        fields = [
            "id",
            "product",
            "attribute_values",
            "attribute_value_ids",
            "sku",
            "price_delta",
            "cost_delta",
            "price_override",
            "cost_override",
            "weight",
            "photo",
            "gallery_photo",
            "gallery_photo_url",
            "low_stock_threshold",
            "is_active",
            "is_default",
            "effective_price",
            "effective_cost",
            "effective_weight",
            "total_stock",
            "stock_by_location",
            "is_low_stock",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "gallery_photo_url"]


class ProductListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views."""
    category_names = serializers.SerializerMethodField()
    variant_count = serializers.SerializerMethodField()
    total_stock = serializers.SerializerMethodField()
    primary_photo = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "categories",
            "category_names",
            "item_type",
            "service_pricing",
            "base_price",
            "base_weight",
            "hourly_rate",
            "low_stock_threshold",
            "is_active",
            "variant_count",
            "total_stock",
            "primary_photo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_category_names(self, obj):
        return list(obj.categories.values_list("name", flat=True))

    def get_variant_count(self, obj):
        return obj.variants.filter(is_active=True).count()

    def get_total_stock(self, obj):
        from django.db.models import Sum
        result = obj.variants.filter(is_active=True).aggregate(total=Sum("stock_entries__quantity"))
        return result["total"] or 0

    def get_primary_photo(self, obj):
        photo = obj.photos.filter(is_primary=True).first() or obj.photos.first()
        if photo:
            request = self.context.get("request")
            return request.build_absolute_uri(photo.image.url) if request else photo.image.url
        return None


class ProductDetailSerializer(serializers.ModelSerializer):
    """Full serializer for detail/create/update views."""
    cost = ProductCostSerializer(required=False)
    photos = ProductPhotoSerializer(many=True, read_only=True)
    primary_photo = serializers.SerializerMethodField()
    attributes = VariantAttributeSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    category_names = serializers.SerializerMethodField()
    categories = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Category.objects.all(),
        required=False,
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "categories",
            "category_names",
            "item_type",
            "service_pricing",
            "base_price",
            "base_weight",
            "hourly_rate",
            "low_stock_threshold",
            "is_active",
            "cost",
            "photos",
            "primary_photo",
            "attributes",
            "variants",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_primary_photo(self, obj):
        photo = obj.photos.filter(is_primary=True).first() or obj.photos.first()
        if photo:
            request = self.context.get("request")
            return request.build_absolute_uri(photo.image.url) if request else photo.image.url
        return None

    def get_category_names(self, obj):
        return list(obj.categories.values_list("name", flat=True))

    def create(self, validated_data):
        cost_data = validated_data.pop("cost", None)
        categories = validated_data.pop("categories", None)
        product = super().create(validated_data)
        if categories is not None:
            product.categories.set(categories)
        if cost_data:
            ProductCost.objects.create(product=product, **cost_data)
        return product

    def update(self, instance, validated_data):
        cost_data = validated_data.pop("cost", None)
        categories = validated_data.pop("categories", None)
        product = super().update(instance, validated_data)
        if categories is not None:
            product.categories.set(categories)
        if cost_data is not None:
            ProductCost.objects.update_or_create(
                product=product, defaults=cost_data
            )
        return product
