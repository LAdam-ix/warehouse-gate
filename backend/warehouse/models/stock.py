import uuid
from django.db import models
from django.utils import timezone
from .base import AuditModel


class Location(AuditModel):
    """
    Storage location. A default location is auto-created at startup.
    If only one location exists, the UI never shows a location picker.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    firm = models.ForeignKey("warehouse.Firm", on_delete=models.CASCADE, related_name="locations")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Ensure only one default per firm
        if self.is_default:
            Location.objects.filter(firm=self.firm, is_default=True).exclude(pk=self.pk).update(
                is_default=False
            )
        super().save(*args, **kwargs)

    class Meta:
        unique_together = ("firm", "name")
        ordering = ["-is_default", "name"]


class StockEntry(models.Model):
    """
    Current stock level for a variant at a location.
    Rebuilt from StockMovement — do not edit directly, use services.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.ForeignKey(
        "warehouse.ProductVariant", on_delete=models.CASCADE, related_name="stock_entries"
    )
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="stock_entries")
    quantity = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.variant} @ {self.location}: {self.quantity}"

    class Meta:
        unique_together = ("variant", "location")


class StockMovement(models.Model):
    """
    Immutable audit log of every stock change.
    Source of truth — StockEntry is derived from this.
    movement_date is user-editable (defaults to now) so batches can be back-dated.
    """
    class MovementType(models.TextChoices):
        PRODUCED = "produced", "Produced / Received"
        SOLD = "sold", "Sold"
        DAMAGED = "damaged", "Damaged / Lost"
        ADJUSTMENT = "adjustment", "Manual Adjustment"
        RETURNED = "returned", "Returned from Sale"
        REFUND_RETURN = "refund_return", "Refund Return"
        TRANSFER_OUT = "transfer_out", "Transfer Out"
        TRANSFER_IN = "transfer_in", "Transfer In"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.ForeignKey(
        "warehouse.ProductVariant", on_delete=models.CASCADE, related_name="movements"
    )
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="movements")
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    # Positive = stock added, negative = stock removed
    quantity_delta = models.IntegerField()
    note = models.TextField(blank=True)
    # User-editable date (defaults to now, can be back-dated)
    movement_date = models.DateTimeField(default=timezone.now)
    batch_id = models.UUIDField(
        null=True, blank=True, db_index=True,
        help_text="Groups movements created in the same operation (e.g. one add-stock session)"
    )

    # Optional references
    sale_line = models.ForeignKey(
        "warehouse.SaleLine",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movements",
    )
    damage_report = models.ForeignKey(
        "warehouse.DamageReport",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movements",
    )

    # Audit (immutable — no updated_by)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        "warehouse.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_movements",
    )

    def __str__(self):
        sign = "+" if self.quantity_delta >= 0 else ""
        return f"{self.movement_type} {sign}{self.quantity_delta} × {self.variant}"

    class Meta:
        ordering = ["-movement_date", "-created_at"]
