"""
FirmScopedMixin — automatically scopes all querysets to request.wh_firm.
All warehouse viewsets use this as a base.
"""
from warehouse.permissions import CanEditWarehouse


class FirmScopedMixin:
    permission_classes = [CanEditWarehouse]

    def get_firm(self):
        return self.request.wh_firm

    def get_user(self):
        return self.request.wh_user

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(firm=self.get_firm())

    def perform_create(self, serializer):
        serializer.save(
            firm=self.get_firm(),
            created_by=self.get_user(),
            updated_by=self.get_user(),
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.get_user())
