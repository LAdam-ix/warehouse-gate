"""
Auto-confirm pending_review sales that have passed their auto_confirm_at deadline.
Run via cron or as part of the backend startup:
    python manage.py auto_confirm_sales
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from warehouse.models import Sale


class Command(BaseCommand):
    help = "Confirm pending_review sales past their auto-confirm deadline (default 5 days after sync)"

    def handle(self, *args, **options):
        now = timezone.now()
        expired = Sale.objects.filter(
            status=Sale.Status.PENDING_REVIEW,
            auto_confirm_at__lte=now,
        )
        count = expired.count()
        if count == 0:
            self.stdout.write("No sales to auto-confirm.")
            return

        expired.update(status=Sale.Status.FINALIZED, auto_confirm_at=None)
        self.stdout.write(self.style.SUCCESS(f"Auto-confirmed {count} sale(s)."))
