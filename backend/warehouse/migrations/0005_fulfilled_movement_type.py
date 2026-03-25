from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warehouse", "0004_default_energy_rate"),
    ]

    operations = [
        migrations.AlterField(
            model_name="stockmovement",
            name="movement_type",
            field=models.CharField(
                choices=[
                    ("produced", "Produced / Received"),
                    ("fulfilled", "Production Fulfilled"),
                    ("sold", "Sold"),
                    ("damaged", "Damaged / Lost"),
                    ("adjustment", "Manual Adjustment"),
                    ("returned", "Returned from Sale"),
                    ("refund_return", "Refund Return"),
                    ("transfer_out", "Transfer Out"),
                    ("transfer_in", "Transfer In"),
                ],
                max_length=20,
            ),
        ),
    ]
