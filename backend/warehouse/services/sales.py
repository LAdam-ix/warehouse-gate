"""
Sale service — finalize, void, and credit-note handling.
All stock side-effects triggered here.
"""
import uuid
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from warehouse.models import Firm, Sale, SaleLine, Location, StockMovement
from .stock import deduct_stock, return_stock, InsufficientStockError
from .production import maybe_create_auto_request


def _get_default_location(firm: Firm) -> Location:
    loc = Location.objects.filter(firm=firm, is_default=True, is_active=True).first()
    if not loc:
        loc = Location.objects.filter(firm=firm, is_active=True).first()
    return loc


@transaction.atomic
def finalize_sale(sale: Sale, user=None) -> Sale:
    """
    Transition sale Draft → Finalized.
    Deducts stock for all physical lines (respects firm warehouse_mode).
    Recalculates and saves totals.
    """
    if sale.status != Sale.Status.DRAFT:
        raise ValidationError(f"Cannot finalize a sale with status '{sale.status}'.")

    firm = sale.firm
    lines = sale.lines.select_related("variant__product__firm", "variant__product").all()

    if not lines.exists():
        raise ValidationError("Cannot finalize an empty sale.")

    sale_batch_id = uuid.uuid4()
    for line in lines:
        if line.variant and line.variant.product.item_type == "physical":
            location = line.location or _get_default_location(firm)
            if location:
                qty = int(line.quantity)
                if qty > 0:
                    try:
                        deduct_stock(
                            variant=line.variant,
                            location=location,
                            quantity=qty,
                            movement_type=StockMovement.MovementType.SOLD,
                            note=f"Sale {sale.id}",
                            user=user,
                            sale_line=line,
                            batch_id=sale_batch_id,
                        )
                    except InsufficientStockError as e:
                        raise ValidationError(str(e))
                    else:
                        # Persist the resolved location so void/credit-note return to the right place
                        if not line.location_id:
                            line.location = location
                            line.save(update_fields=["location"])
                        # Refresh from DB so total_stock reflects the deduction
                        line.variant.refresh_from_db()
                        maybe_create_auto_request(line.variant, user=user)

    sale.recalculate_totals()
    sale.status = Sale.Status.FINALIZED
    sale.finalized_at = timezone.now()
    sale.updated_by = user
    sale.save()
    return sale


@transaction.atomic
def void_sale(sale: Sale, user=None) -> Sale:
    """
    Transition sale → Voided.
    Returns stock for all physical lines if sale was previously finalized.
    """
    if sale.status == Sale.Status.VOIDED:
        raise ValidationError("Sale is already voided.")

    was_finalized = sale.status == Sale.Status.FINALIZED

    if was_finalized:
        firm = sale.firm
        void_batch_id = uuid.uuid4()
        lines = sale.lines.select_related("variant__product", "location").all()
        for line in lines:
            if line.variant and line.variant.product.item_type == "physical":
                location = line.location or _get_default_location(firm)
                if location:
                    qty = int(line.quantity)
                    if qty > 0:
                        return_stock(
                            variant=line.variant,
                            location=location,
                            quantity=qty,
                            movement_type=StockMovement.MovementType.RETURNED,
                            note=f"Voided sale {sale.id}",
                            user=user,
                            sale_line=line,
                            batch_id=void_batch_id,
                        )

    sale.status = Sale.Status.VOIDED
    sale.updated_by = user
    sale.save(update_fields=["status", "updated_by", "updated_at"])
    return sale


@transaction.atomic
def apply_credit_note(sale: Sale, credit_note_id, user=None) -> Sale:
    """
    Link a fakturuj si credit note to a finalized sale.
    Returns stock back to warehouse as refund_return movements.
    """
    if sale.status != Sale.Status.FINALIZED:
        raise ValidationError("Credit notes can only be applied to finalized sales.")

    firm = sale.firm
    credit_batch_id = uuid.uuid4()
    lines = sale.lines.select_related("variant__product", "location").all()
    for line in lines:
        if line.variant and line.variant.product.item_type == "physical":
            location = line.location or _get_default_location(firm)
            if location:
                qty = int(line.quantity)
                if qty > 0:
                    return_stock(
                        variant=line.variant,
                        location=location,
                        quantity=qty,
                        movement_type=StockMovement.MovementType.REFUND_RETURN,
                        note=f"Credit note {credit_note_id} for sale {sale.id}",
                        user=user,
                        sale_line=line,
                        batch_id=credit_batch_id,
                    )

    sale.credit_note_id = credit_note_id
    sale.updated_by = user
    sale.save(update_fields=["credit_note_id", "updated_by", "updated_at"])
    return sale
