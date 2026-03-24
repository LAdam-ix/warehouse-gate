"""
Production request service.
"""
from django.utils import timezone
from warehouse.models import ProductionRequest, ProductVariant


def maybe_create_auto_request(variant: ProductVariant, user=None) -> ProductionRequest | None:
    """
    Create an auto production request if the variant is now low on stock
    and there isn't already a pending/in_progress request for it.
    Returns the created request or None.
    """
    if not variant.is_low_stock:
        return None

    already_open = ProductionRequest.objects.filter(
        variant=variant,
        status__in=[ProductionRequest.Status.PENDING, ProductionRequest.Status.IN_PROGRESS],
    ).exists()
    if already_open:
        return None

    threshold = variant.effective_low_stock_threshold or 0
    current = variant.total_stock
    # Request enough to bring stock back to 2× the threshold (or at least 1)
    quantity = max(1, threshold * 2 - current)

    req = ProductionRequest.objects.create(
        variant=variant,
        quantity_requested=quantity,
        quantity_target=threshold * 2 or None,
        status=ProductionRequest.Status.PENDING,
        trigger=ProductionRequest.Trigger.AUTO,
        note=f"Auto-created: stock fell to {current} (threshold: {threshold}).",
        created_by=user,
        updated_by=user,
    )
    return req
