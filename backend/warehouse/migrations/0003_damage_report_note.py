from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warehouse", "0002_attr_value_deltas"),
    ]

    operations = [
        migrations.AddField(
            model_name="damagereport",
            name="note",
            field=models.TextField(blank=True, default=""),
            preserve_default=False,
        ),
    ]
