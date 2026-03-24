import uuid
from decimal import Decimal
from django.db import models
from .base import AuditModel


class Category(AuditModel):
    """Optional tag/label for grouping products."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    firm = models.ForeignKey("warehouse.Firm", on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

    class Meta:
        unique_together = ("firm", "name")
        verbose_name_plural = "categories"
        ordering = ["name"]


class Product(AuditModel):
    class ItemType(models.TextChoices):
        PHYSICAL = "physical", "Physical"
        SERVICE = "service", "Service"

    class ServicePricing(models.TextChoices):
        FLAT = "flat", "Flat Price"
        HOURLY = "hourly", "Hourly Rate"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    firm = models.ForeignKey("warehouse.Firm", on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    categories = models.ManyToManyField(Category, blank=True, related_name="products")
    item_type = models.CharField(max_length=20, choices=ItemType.choices, default=ItemType.PHYSICAL)
    # Service-only fields
    service_pricing = models.CharField(
        max_length=20, choices=ServicePricing.choices, null=True, blank=True
    )
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    hourly_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    low_stock_threshold = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Alert when any variant's stock falls to or below this number. Variants can override."
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    @property
    def has_variants(self):
        return self.attributes.exists()

    class Meta:
        ordering = ["name"]


class ProductCost(AuditModel):
    """
    Cost breakdown for a product (primarily for 3D printing but general enough).
    Total cost = material + (energy_kwh × energy_rate) + (labor_hours × labor_rate) + other
    """
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name="cost")
    # Material cost (filament, resin, raw materials)
    material = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    # Energy cost (electricity)
    energy_kwh = models.DecimalField(max_digits=10, decimal_places=3, default=Decimal("0.000"))
    energy_rate = models.DecimalField(
        max_digits=10, decimal_places=4, default=Decimal("0.0000"),
        help_text="€ per kWh"
    )
    # Labor cost
    labor_hours = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    labor_rate = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00"),
        help_text="€ per hour"
    )
    # Catch-all
    other = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    notes = models.TextField(blank=True)

    @property
    def total(self):
        energy = self.energy_kwh * self.energy_rate
        labor = self.labor_hours * self.labor_rate
        return self.material + energy + labor + self.other

    def __str__(self):
        return f"Cost for {self.product.name}: {self.total:.2f}"


def product_photo_upload_path(instance, filename):
    return f"firms/{instance.product.firm_id}/products/{instance.product_id}/{filename}"


class ProductPhoto(AuditModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to=product_photo_upload_path, max_length=500)
    sort_order = models.PositiveIntegerField(default=0)
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["sort_order", "created_at"]


class VariantAttribute(AuditModel):
    """
    Defines an attribute dimension for a product (e.g. 'Color', 'Size').
    A product with no attributes gets one implicit default variant.
    """
    class AttributeType(models.TextChoices):
        TEXT = "text", "Text"
        COLOR = "color", "Color"
        NUMBER = "number", "Number"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="attributes")
    name = models.CharField(max_length=100)
    attribute_type = models.CharField(
        max_length=20, choices=AttributeType.choices, default=AttributeType.TEXT
    )
    sort_order = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.product.name} → {self.name}"

    class Meta:
        ordering = ["sort_order"]
        unique_together = ("product", "name")


class AttributeValue(AuditModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attribute = models.ForeignKey(
        VariantAttribute, on_delete=models.CASCADE, related_name="values"
    )
    value = models.CharField(max_length=255)
    color_hex = models.CharField(max_length=7, null=True, blank=True, help_text="#RRGGBB")
    sort_order = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.attribute.name}: {self.value}"

    class Meta:
        ordering = ["sort_order"]
        unique_together = ("attribute", "value")


def variant_photo_upload_path(instance, filename):
    return f"firms/{instance.product.firm_id}/products/{instance.product_id}/variants/{instance.id}/{filename}"


class ProductVariant(AuditModel):
    """
    A specific SKU — one combination of attribute values for a product.
    If the product has no attributes, one default variant is created automatically.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    attribute_values = models.ManyToManyField(AttributeValue, blank=True, related_name="variants")
    sku = models.CharField(max_length=100, blank=True)
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    cost_delta = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    photo = models.ImageField(upload_to=variant_photo_upload_path, null=True, blank=True, max_length=500)
    gallery_photo = models.ForeignKey(
        "ProductPhoto",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="variant_assignments",
        help_text="Points to one of the product's gallery photos. Multiple variants can share the same photo.",
    )
    low_stock_threshold = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(
        default=False, help_text="True for the auto-created variant on attribute-less products"
    )

    def __str__(self):
        values = ", ".join(str(v) for v in self.attribute_values.all())
        return f"{self.product.name}" + (f" ({values})" if values else "")

    @property
    def effective_price(self):
        return self.product.base_price + self.price_delta

    @property
    def effective_cost(self):
        try:
            return self.product.cost.total + self.cost_delta
        except ProductCost.DoesNotExist:
            return Decimal("0.00")

    @property
    def total_stock(self):
        result = self.stock_entries.aggregate(total=models.Sum("quantity"))
        return result["total"] or 0

    @property
    def effective_low_stock_threshold(self):
        """Variant's own threshold if set, otherwise falls back to the product default."""
        if self.low_stock_threshold is not None:
            return self.low_stock_threshold
        return self.product.low_stock_threshold

    @property
    def is_low_stock(self):
        threshold = self.effective_low_stock_threshold
        if threshold is None:
            return False
        return self.total_stock <= threshold

    class Meta:
        ordering = ["product__name"]
