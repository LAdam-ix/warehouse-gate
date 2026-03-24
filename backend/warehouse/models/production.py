import uuid
from django.db import models
from django.utils import timezone
from .base import AuditModel


class ProductionRequest(AuditModel):
    """
    A request to produce/restock a variant.
    Can be triggered automatically (low stock threshold crossed) or manually.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        FULFILLED = "fulfilled", "Fulfilled"
        CANCELLED = "cancelled", "Cancelled"

    class Trigger(models.TextChoices):
        AUTO = "auto", "Auto (low stock)"
        MANUAL = "manual", "Manual"
        SEASONAL = "seasonal", "Seasonal / Planned"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.ForeignKey(
        "warehouse.ProductVariant",
        on_delete=models.CASCADE,
        related_name="production_requests",
    )
    quantity_requested = models.PositiveIntegerField(
        help_text="How many units to produce."
    )
    quantity_target = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Target stock level after fulfilment (optional context).",
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    trigger = models.CharField(
        max_length=20, choices=Trigger.choices, default=Trigger.MANUAL
    )
    note = models.TextField(blank=True)

    fulfilled_at = models.DateTimeField(null=True, blank=True)
    fulfilled_by = models.ForeignKey(
        "warehouse.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="fulfilled_production_requests",
    )

    def __str__(self):
        return f"{self.trigger} request — {self.variant} ×{self.quantity_requested} [{self.status}]"

    class Meta:
        ordering = ["-created_at"]
