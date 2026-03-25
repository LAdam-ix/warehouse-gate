import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from .base import AuditModel


class DamageReport(AuditModel):
    """
    Records damaged, lost or written-off items.
    Automatically creates a StockMovement(type=damaged) on save.
    Tracked separately from sales — shows as loss, not revenue.
    report_date is user-editable (can be back-dated).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    firm = models.ForeignKey(
        "warehouse.Firm", on_delete=models.CASCADE, related_name="damage_reports"
    )
    variant = models.ForeignKey(
        "warehouse.ProductVariant",
        on_delete=models.CASCADE,
        related_name="damage_reports",
    )
    location = models.ForeignKey(
        "warehouse.Location",
        on_delete=models.CASCADE,
        related_name="damage_reports",
    )
    quantity = models.PositiveIntegerField()
    reason = models.TextField()
    note = models.TextField(blank=True)
    estimated_value_lost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Estimated loss at cost value",
    )
    report_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Damage: {self.quantity} × {self.variant} — {self.reason[:50]}"

    class Meta:
        ordering = ["-report_date"]
