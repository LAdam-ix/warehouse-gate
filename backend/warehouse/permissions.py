"""
Warehouse permission classes for DRF views.
All views use FirmScopedMixin which automatically filters by request.wh_firm.
"""
from rest_framework.permissions import BasePermission
from warehouse.models import UserWarehouseAccess


def _get_access_level(user, firm) -> str:
    if user is None or firm is None:
        return UserWarehouseAccess.Level.NONE
    access = UserWarehouseAccess.objects.filter(user=user, firm=firm).first()
    return access.level if access else UserWarehouseAccess.Level.NONE


class CanViewWarehouse(BasePermission):
    """Allows GET requests for users with view or edit access."""
    message = "You do not have view access to this firm's warehouse."

    def has_permission(self, request, view):
        level = _get_access_level(request.wh_user, request.wh_firm)
        return level in (UserWarehouseAccess.Level.VIEW, UserWarehouseAccess.Level.EDIT)


class CanEditWarehouse(BasePermission):
    """Allows all methods for users with edit access."""
    message = "You do not have edit access to this firm's warehouse."

    def has_permission(self, request, view):
        from rest_framework.request import Request
        level = _get_access_level(request.wh_user, request.wh_firm)
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return level in (UserWarehouseAccess.Level.VIEW, UserWarehouseAccess.Level.EDIT)
        return level == UserWarehouseAccess.Level.EDIT
