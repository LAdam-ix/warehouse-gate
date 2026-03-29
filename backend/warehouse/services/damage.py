"""
Damage report service.
Creates a DamageReport + corresponding StockMovement atomically.
"""
from django.db import transaction
from django.utils import timezone

from warehouse.models import DamageReport, Firm, Location, ProductVariant, StockMovement
from .stock import deduct_stock, InsufficientStockError
from django.core.exceptions import ValidationError


@transaction.atomic
def report_damage(
    *,
    firm: Firm,
    variant: ProductVariant,
    location: Location,
    quantity: int,
    reason: str,
    note: str = "",
    estimated_value_lost=None,
    report_date=None,
    batch_id=None,
    user=None,
) -> DamageReport:
    """
    Record damaged/lost items.
    Always deducts stock (even in soft mode — damage is always real).
    In disabled mode: skips stock deduction but still logs the report.
    """
    if quantity <= 0:
        raise ValidationError("quantity must be positive.")

    from warehouse.models import StockEntry
    entry, _ = StockEntry.objects.get_or_create(
        variant=variant, location=location, defaults={"quantity": 0}
    )

    if estimated_value_lost is None:
        estimated_value_lost = variant.effective_cost * quantity

    report = DamageReport.objects.create(
        firm=firm,
        variant=variant,
        location=location,
        quantity=quantity,
        reason=reason,
        note=note,
        estimated_value_lost=estimated_value_lost,
        report_date=report_date or timezone.now(),
        created_by=user,
        updated_by=user,
    )

    from warehouse.models import WarehouseSettings
    mode = WarehouseSettings.for_firm(firm).warehouse_mode
    if mode != "disabled":
        entry.quantity = max(0, entry.quantity - quantity) if mode == "strict" else entry.quantity - quantity
        entry.save(update_fields=["quantity"])

        StockMovement.objects.create(
            variant=variant,
            location=location,
            movement_type=StockMovement.MovementType.DAMAGED,
            quantity_delta=-quantity,
            note=reason,
            movement_date=report_date or timezone.now(),
            created_by=user,
            damage_report=report,
            batch_id=batch_id,
        )

    return report
