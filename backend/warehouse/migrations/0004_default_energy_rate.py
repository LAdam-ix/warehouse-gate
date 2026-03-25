from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warehouse", "0003_damage_report_note"),
    ]

    operations = [
        migrations.AddField(
            model_name="warehousesettings",
            name="default_energy_rate",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text="Default energy cost per kWh (€). Pre-filled in production cost forms.",
                max_digits=10,
                null=True,
            ),
        ),
    ]
