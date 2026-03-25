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
    movement_type: str = StockMovement.MovementType.PRODUCED,
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
        movement_type=movement_type,
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


# Movement types that can be reverted (manual operations only)
REVERTABLE_TYPES = {
    StockMovement.MovementType.PRODUCED,
    StockMovement.MovementType.ADJUSTMENT,
    StockMovement.MovementType.TRANSFER_OUT,
    StockMovement.MovementType.TRANSFER_IN,
}


@transaction.atomic
def revert_movement(*, movement: StockMovement, user=None):
    """
    Revert the most recent manual stock movement.
    Reverses the quantity delta on the stock entry, then deletes the movement.
    For transfers, also finds and reverts the paired movement.
    In strict mode, refuses if reverting would make stock negative.
    """
    if movement.movement_type not in REVERTABLE_TYPES:
        raise ValueError(f"Cannot revert movement of type '{movement.movement_type}'")

    firm = movement.variant.product.firm

    def _undo(mv):
        entry = _get_or_create_entry(mv.variant, mv.location)
        new_qty = entry.quantity - mv.quantity_delta
        # In strict mode, block if reverting would make stock negative
        if firm.warehouse_mode == Firm.WarehouseMode.STRICT and new_qty < 0:
            raise InsufficientStockError(mv.variant, entry.quantity, mv.quantity_delta)
        entry.quantity = new_qty
        entry.save(update_fields=["quantity"])
        mv.delete()

    # For transfers, find the paired movement (same note + timestamp, opposite type)
    if movement.movement_type in (
        StockMovement.MovementType.TRANSFER_OUT,
        StockMovement.MovementType.TRANSFER_IN,
    ):
        paired_type = (
            StockMovement.MovementType.TRANSFER_IN
            if movement.movement_type == StockMovement.MovementType.TRANSFER_OUT
            else StockMovement.MovementType.TRANSFER_OUT
        )
        paired = StockMovement.objects.filter(
            variant=movement.variant,
            movement_type=paired_type,
            movement_date=movement.movement_date,
        ).first()
        if paired:
            _undo(paired)

    _undo(movement)
