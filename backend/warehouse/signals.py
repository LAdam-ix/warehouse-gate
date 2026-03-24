"""
Auto-create a default ProductVariant when a Product is saved with no attributes.
Auto-set updated_by on AuditModel saves (requires thread-local user, set by middleware).
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="warehouse.Product")
def ensure_default_variant(sender, instance, created, **kwargs):
    """
    If a product has no variant attributes, ensure one default variant exists.
    Called after every product save to handle the case where all attributes are removed.
    """
    if not instance.attributes.exists():
        from warehouse.models import ProductVariant
        ProductVariant.objects.get_or_create(
            product=instance,
            is_default=True,
            defaults={"sku": "", "is_active": True},
        )
