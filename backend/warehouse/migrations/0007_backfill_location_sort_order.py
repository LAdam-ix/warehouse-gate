from django.db import migrations


def backfill_sort_order(apps, schema_editor):
    Location = apps.get_model("warehouse", "Location")
    # Group by firm, assign incrementing sort_order by created_at
    for firm_id in Location.objects.values_list("firm_id", flat=True).distinct():
        for i, loc in enumerate(Location.objects.filter(firm_id=firm_id).order_by("created_at"), start=1):
            if loc.sort_order == 0:
                loc.sort_order = i
                loc.save(update_fields=["sort_order"])


class Migration(migrations.Migration):

    dependencies = [
        ("warehouse", "0006_location_sort_order"),
    ]

    operations = [
        migrations.RunPython(backfill_sort_order, migrations.RunPython.noop),
    ]
