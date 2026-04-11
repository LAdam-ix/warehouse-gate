"""Backfill sort_key for all existing ProductVariants."""
from django.db import migrations


def backfill_sort_keys(apps, schema_editor):
    ProductVariant = apps.get_model("warehouse", "ProductVariant")
    for variant in ProductVariant.objects.prefetch_related("attribute_values__attribute").all():
        avs = variant.attribute_values.select_related("attribute").order_by(
            "attribute__sort_order", "attribute__id", "sort_order"
        )
        key = "-".join(f"{av.sort_order:04d}" for av in avs)
        if key != variant.sort_key:
            variant.sort_key = key
            variant.save(update_fields=["sort_key"])


class Migration(migrations.Migration):
    dependencies = [
        ("warehouse", "0017_variant_sort_key"),
    ]

    operations = [
        migrations.RunPython(backfill_sort_keys, migrations.RunPython.noop),
    ]
