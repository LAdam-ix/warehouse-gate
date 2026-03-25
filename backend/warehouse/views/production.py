from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone

from warehouse.models import ProductionRequest
from warehouse.serializers.production import (
    ProductionRequestSerializer,
    ProductionRequestCreateSerializer,
)
from warehouse.services.stock import add_stock, InsufficientStockError
from warehouse.models import Location
from .base import FirmScopedMixin


class ProductionRequestViewSet(FirmScopedMixin, viewsets.ModelViewSet):
    queryset = ProductionRequest.objects.select_related(
        "variant__product", "created_by", "fulfilled_by"
    )
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "trigger", "variant", "variant__product"]
    search_fields = ["note", "variant__product__name"]
    ordering_fields = ["created_at", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # Scope by variant's product's firm (no direct firm FK on this model)
        return ProductionRequest.objects.select_related(
            "variant__product", "created_by", "fulfilled_by"
        ).filter(variant__product__firm=self.get_firm())

    def get_serializer_class(self):
        if self.action == "create":
            return ProductionRequestCreateSerializer
        return ProductionRequestSerializer

    def perform_create(self, serializer):
        # Validate that the variant belongs to this firm
        variant = serializer.validated_data["variant"]
        if variant.product.firm != self.get_firm():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Variant does not belong to this firm.")
        serializer.save(
            created_by=self.get_user(),
            updated_by=self.get_user(),
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.get_user())

    @action(detail=True, methods=["post"])
    def fulfill(self, request, pk=None):
        """
        Mark a request as fulfilled and optionally add stock.
        Body (optional): { "quantity": int, "location_id": uuid, "note": str }
        If quantity is provided, creates a stock movement.
        """
        prod_req = self.get_object()
        if prod_req.status == ProductionRequest.Status.FULFILLED:
            return Response({"detail": "Already fulfilled."}, status=400)
        if prod_req.status == ProductionRequest.Status.CANCELLED:
            return Response({"detail": "Cannot fulfill a cancelled request."}, status=400)

        quantity = request.data.get("quantity")
        location_id = request.data.get("locationId")
        note = request.data.get("note", "")
        user = self.get_user()

        if quantity:
            try:
                quantity = int(quantity)
            except (TypeError, ValueError):
                return Response({"detail": "quantity must be an integer."}, status=400)

            firm = self.get_firm()
            if location_id:
                location = Location.objects.filter(id=location_id, firm=firm).first()
                if not location:
                    return Response({"detail": "Location not found."}, status=400)
            else:
                location = Location.objects.filter(firm=firm, is_default=True, is_active=True).first()
                if not location:
                    location = Location.objects.filter(firm=firm, is_active=True).first()

            if not location:
                return Response({"detail": "No location available."}, status=400)

            from django.utils.timezone import localtime
            ts = localtime(timezone.now()).strftime("%Y-%m-%d %H:%M")
            requester = prod_req.created_by.name if prod_req.created_by else "—"
            auto_note = f"Fulfilled production request for {prod_req.variant} — requested by {requester} — {ts}"
            from warehouse.models import StockMovement
            add_stock(
                variant=prod_req.variant,
                location=location,
                quantity=quantity,
                note=note or auto_note,
                user=user,
                movement_type=StockMovement.MovementType.FULFILLED,
            )

        prod_req.status = ProductionRequest.Status.FULFILLED
        prod_req.fulfilled_at = timezone.now()
        prod_req.fulfilled_by = user
        prod_req.updated_by = user
        prod_req.save()
        return Response(ProductionRequestSerializer(prod_req, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        prod_req = self.get_object()
        if prod_req.status in (ProductionRequest.Status.FULFILLED, ProductionRequest.Status.CANCELLED):
            return Response({"detail": f"Cannot cancel a {prod_req.status} request."}, status=400)
        prod_req.status = ProductionRequest.Status.CANCELLED
        prod_req.updated_by = self.get_user()
        prod_req.save()
        return Response(ProductionRequestSerializer(prod_req, context={"request": request}).data)
