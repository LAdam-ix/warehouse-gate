"""
Zero out variant price_delta and cost_delta for variants that have attribute values,
since effective_price now computes the sum from attribute value deltas live.
The old behavior pre-summed attribute deltas into variant.price_delta at generation time,
causing double-counting after the formula change.
"""
from django.db import migrations


def zero_deltas(apps, schema_editor):
    ProductVariant = apps.get_model("warehouse", "ProductVariant")
    # Only zero variants that have attribute values (generated variants).
    # Default/manual variants with no attribute values keep their delta as a manual adjustment.
    variants_with_attrs = ProductVariant.objects.filter(attribute_values__isnull=False).distinct()
    variants_with_attrs.update(price_delta=0, cost_delta=0)


class Migration(migrations.Migration):
    dependencies = [
        ("warehouse", "0010_move_warehouse_mode_to_settings"),
    ]

    operations = [
        migrations.RunPython(zero_deltas, migrations.RunPython.noop),
    ]
