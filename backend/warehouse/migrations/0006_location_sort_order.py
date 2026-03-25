from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("warehouse", "0005_fulfilled_movement_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="location",
            name="sort_order",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterModelOptions(
            name="location",
            options={"ordering": ["sort_order", "created_at"]},
        ),
    ]
