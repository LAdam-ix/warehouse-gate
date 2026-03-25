"""
Stock service — all stock mutations go through here.
Never modify StockEntry.quantity directly outside this module.
"""
import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from warehouse.models import (
    Firm,
    ProductVariant,
    Location,
    StockEntry,
    StockMovement,
)


class InsufficientStockError(Exception):
    def __init__(self, variant, available, requested):
        self.variant = variant
        self.available = available
        self.requested = requested
        super().__init__(
            f"Insufficient stock for {variant}: requested {requested}, available {available}"
        )


def _get_or_create_entry(variant: ProductVariant, location: Location) -> StockEntry:
    entry, _ = StockEntry.objects.get_or_create(
        variant=variant, location=location, defaults={"quantity": 0}
    )
    return entry


def _check_stock(firm: Firm, variant: ProductVariant, quantity: int, location: Location):
    """Raise InsufficientStockError if strict mode and not enough stock."""
    mode = firm.warehouse_mode
    if mode == Firm.WarehouseMode.DISABLED:
        return
    if mode == Firm.WarehouseMode.STRICT:
        entry = _get_or_create_entry(variant, location)
        if entry.quantity < quantity:
            raise InsufficientStockError(variant, entry.quantity, quantity)
    # SOFT mode: allow, just proceed


@transaction.atomic
def add_stock(
    *,
    variant: ProductVariant,
    location: Location,
    quantity: int,
    note: str = "",
    movement_date=None,
    user=None,
    batch_id=None,
) -> StockMovement:
    """Add produced/received stock. quantity must be positive."""
    if quantity <= 0:
        raise ValueError("quantity must be positive for add_stock")

    if batch_id is None:
        batch_id = uuid.uuid4()

    entry = _get_or_create_entry(variant, location)
    entry.quantity += quantity
    entry.save(update_fields=["quantity"])

    movement = StockMovement.objects.create(
        variant=variant,
        location=location,
        movement_type=StockMovement.MovementType.PRODUCED,
        quantity_delta=quantity,
        note=note,
        movement_date=movement_date or timezone.now(),
        created_by=user,
        batch_id=batch_id,
    )
    return movement


@transaction.atomic
def deduct_stock(
    *,
    variant: ProductVariant,
    location: Location,
    quantity: int,
    movement_type: str = StockMovement.MovementType.SOLD,
    note: str = "",
    movement_date=None,
    user=None,
    sale_line=None,
) -> StockMovement:
    """
    Remove stock. Checks firm's warehouse_mode before deducting.
    quantity should be positive (stored as negative delta internally).
    """
    if quantity <= 0:
        raise ValueError("quantity must be positive for deduct_stock")

    firm = variant.product.firm
    _check_stock(firm, variant, quantity, location)

    entry = _get_or_create_entry(variant, location)
    entry.quantity -= quantity
    entry.save(update_fields=["quantity"])

    movement = StockMovement.objects.create(
        variant=variant,
        location=location,
        movement_type=movement_type,
        quantity_delta=-quantity,
        note=note,
        movement_date=movement_date or timezone.now(),
        created_by=user,
        sale_line=sale_line,
    )
    return movement


@transaction.atomic
def return_stock(
    *,
    variant: ProductVariant,
    location: Location,
    quantity: int,
    note: str = "",
    movement_date=None,
    user=None,
    sale_line=None,
    movement_type: str = StockMovement.MovementType.RETURNED,
) -> StockMovement:
    """Return items to stock (from voided sale or refund)."""
    if quantity <= 0:
        raise ValueError("quantity must be positive for return_stock")

    entry = _get_or_create_entry(variant, location)
    entry.quantity += quantity
    entry.save(update_fields=["quantity"])

    movement = StockMovement.objects.create(
        variant=variant,
        location=location,
        movement_type=movement_type,
        quantity_delta=quantity,
        note=note,
        movement_date=movement_date or timezone.now(),
        created_by=user,
        sale_line=sale_line,
    )
    return movement


@transaction.atomic
def adjust_stock(
    *,
    variant: ProductVariant,
    location: Location,
    new_quantity: int,
    note: str = "",
    movement_date=None,
    user=None,
) -> StockMovement:
    """Set stock to an absolute value (manual correction)."""
    entry = _get_or_create_entry(variant, location)
    delta = new_quantity - entry.quantity
    entry.quantity = new_quantity
    entry.save(update_fields=["quantity"])

    movement = StockMovement.objects.create(
        variant=variant,
        location=location,
        movement_type=StockMovement.MovementType.ADJUSTMENT,
        quantity_delta=delta,
        note=note,
        movement_date=movement_date or timezone.now(),
        created_by=user,
    )
    return movement


@transaction.atomic
def transfer_stock(
    *,
    variant: ProductVariant,
    from_location: Location,
    to_location: Location,
    quantity: int,
    note: str = "",
    movement_date=None,
    user=None,
):
    """Move stock between locations. Returns (out_movement, in_movement)."""
    if quantity <= 0:
        raise ValueError("quantity must be positive for transfer_stock")

    firm = variant.product.firm
    _check_stock(firm, variant, quantity, from_location)

    from_entry = _get_or_create_entry(variant, from_location)
    from_entry.quantity -= quantity
    from_entry.save(update_fields=["quantity"])

    to_entry = _get_or_create_entry(variant, to_location)
    to_entry.quantity += quantity
    to_entry.save(update_fields=["quantity"])

    ts = movement_date or timezone.now()
    transfer_note = note or f"Transfer from {from_location.name} to {to_location.name}"

    out_movement = StockMovement.objects.create(
        variant=variant,
        location=from_location,
        movement_type=StockMovement.MovementType.TRANSFER_OUT,
        quantity_delta=-quantity,
        note=transfer_note,
        movement_date=ts,
        created_by=user,
    )
    in_movement = StockMovement.objects.create(
        variant=variant,
        location=to_location,
        movement_type=StockMovement.MovementType.TRANSFER_IN,
        quantity_delta=quantity,
        note=transfer_note,
        movement_date=ts,
        created_by=user,
    )
    return out_movement, in_movement
