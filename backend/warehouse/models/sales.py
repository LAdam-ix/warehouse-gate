import uuid
from decimal import Decimal
from django.db import models
from .base import AuditModel


class Sale(AuditModel):
    """
    A sale transaction.
    - draft: being built in the main warehouse UI
    - pending_review: created by POS terminal, stock deducted, editable for 5 days
    - finalized: confirmed, stock deducted, immutable
    - voided/discarded/refunded: reversed states

    invoice_id / credit_note_id are nullable UUIDs pointing to fakturuj si documents.
    Setting credit_note_id on a finalized sale triggers stock return.
    """
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_REVIEW = "pending_review", "Pending Review"
        FINALIZED = "finalized", "Finalized"
        VOIDED = "voided", "Voided"
        DISCARDED = "discarded", "Discarded"
        REFUNDED = "refunded", "Refunded"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    firm = models.ForeignKey("warehouse.Firm", on_delete=models.CASCADE, related_name="sales")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    note = models.TextField(blank=True)
    # TODO: Remove customer_label — customer will come from the linked fakturuj si
    # invoice (via invoice_id) or a shared Customer model. Not displayed in the UI.
    customer_label = models.CharField(max_length=255, blank=True)

    # POS terminal fields
    source = models.CharField(
        max_length=20, default="web", blank=True,
        help_text="Origin: 'web' for main UI, 'pos' for POS terminal",
    )
    device_created_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When the sale was created on the POS device (may differ from created_at due to offline sync delay)",
    )
    auto_confirm_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When pending_review sales auto-confirm (5 days after sync/upload)",
    )

    # fakturuj si integration hooks (nullable until connected)
    invoice_id = models.UUIDField(null=True, blank=True, help_text="fakturuj si Invoice UUID")
    credit_note_id = models.UUIDField(
        null=True, blank=True, help_text="fakturuj si CreditNote UUID — triggers stock return"
    )

    # Order-level discount (applied after line discounts)
    discount_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0.00")
    )
    discount_fixed = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )

    finalized_at = models.DateTimeField(null=True, blank=True)

    # Cached totals — recalculated by Sale.recalculate_totals()
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    cost_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    profit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    def recalculate_totals(self):
        lines = self.lines.all()
        subtotal = sum(l.line_subtotal for l in lines)
        line_discounts = sum(l.discount_amount for l in lines)

        # Order-level discount
        order_discount = Decimal("0.00")
        if self.discount_percentage:
            order_discount += subtotal * (self.discount_percentage / Decimal("100"))
        order_discount += self.discount_fixed

        discount_total = line_discounts + order_discount
        total = subtotal - discount_total
        cost_total = sum(l.line_cost for l in lines)
        profit = total - cost_total

        self.subtotal = subtotal
        self.discount_total = discount_total
        self.total = total
        self.cost_total = cost_total
        self.profit = profit

    def __str__(self):
        label = self.customer_label or "—"
        return f"Sale {self.id} [{self.status}] {label}"

    class Meta:
        ordering = ["-created_at"]


class SaleLine(AuditModel):
    """
    One line in a sale. unit_price is an editable snapshot (not live from variant).
    For hourly services, total = hours × unit_price − discount.
    For physical/flat items, total = quantity × unit_price − discount.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="lines")
    # Nullable for ad-hoc / manual lines not tied to a warehouse item
    variant = models.ForeignKey(
        "warehouse.ProductVariant",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sale_lines",
    )
    # Location from which stock will be (or was) deducted for this line.
    # Set at line-creation time or at finalization; used by void/credit-note to return stock to the right place.
    location = models.ForeignKey(
        "warehouse.Location",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sale_lines",
    )
    # Editable snapshot — prefilled from variant but user can change
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=Decimal("1.000"))
    # For hourly services — if set, overrides quantity for price calc
    hours = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    # Line-level discount (e.g. "1 free item", freebie, manual adjustment)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    discount_note = models.CharField(max_length=255, blank=True)

    sort_order = models.PositiveIntegerField(default=0)

    @property
    def line_subtotal(self):
        """Price before discount."""
        if self.hours is not None:
            return self.hours * self.unit_price
        return self.quantity * self.unit_price

    @property
    def line_total(self):
        return self.line_subtotal - self.discount_amount

    @property
    def line_cost(self):
        if self.variant:
            return self.variant.effective_cost * self.quantity
        return Decimal("0.00")

    @property
    def line_profit(self):
        return self.line_total - self.line_cost

    def __str__(self):
        return f"{self.description} × {self.quantity} = {self.line_total}"

    class Meta:
        ordering = ["sort_order", "created_at"]
