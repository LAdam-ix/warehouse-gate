"""
CurrentUserMiddleware — injects request.wh_user and request.wh_firm.

DEV_MODE=True (local.py): always injects the dev user/firm from settings,
creating them on first run. No JWT required.

When merging into fakturuj si: replace this middleware with JWT parsing
that maps request.user (fakturuj si User) → wh_user and active firm → wh_firm.
All warehouse views use request.wh_user / request.wh_firm — nothing else changes.
"""
from django.conf import settings


class CurrentUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self._dev_bootstrapped = False

    def __call__(self, request):
        if getattr(settings, "DEV_MODE", False):
            request.wh_user, request.wh_firm = self._get_dev_context()
        else:
            request.wh_user, request.wh_firm = self._get_jwt_context(request)
        return self.get_response(request)

    def _get_dev_context(self):
        from warehouse.models import User, Firm, UserWarehouseAccess

        email = getattr(settings, "DEV_USER_EMAIL", "dev@warehouse.local")
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={"name": "Dev User"},
        )
        firm_id = getattr(settings, "DEV_FIRM_ID", None)
        if firm_id:
            firm = Firm.objects.filter(id=firm_id).first()
        else:
            firm = Firm.objects.filter(warehouse_access__user=user).first()

        if not firm:
            firm = Firm.objects.create(name="My Workshop")
            UserWarehouseAccess.objects.get_or_create(
                user=user,
                firm=firm,
                defaults={"level": UserWarehouseAccess.Level.EDIT},
            )
            # Create default location
            from warehouse.models import Location
            Location.objects.get_or_create(
                firm=firm,
                name="Default",
                defaults={"is_default": True},
            )

        return user, firm

    def _get_jwt_context(self, request):
        """
        Production / merged path.
        TODO: parse JWT, look up User + active Firm, return them.
        For now returns (None, None) which will cause 401s on all views.
        """
        return None, None
