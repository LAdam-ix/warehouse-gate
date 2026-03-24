from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from warehouse.models import Location, StockEntry, StockMovement, ProductVariant
from warehouse.serializers.stock import (
    LocationSerializer,
    StockEntrySerializer,
    StockMovementSerializer,
    AddStockSerializer,
    AdjustStockSerializer,
    TransferStockSerializer,
)
from warehouse.services.stock import add_stock, adjust_stock, transfer_stock
from .base import FirmScopedMixin


class LocationViewSet(FirmScopedMixin, viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer

    @action(detail=True, methods=["post"])
    def set_default(self, request, pk=None):
        location = self.get_object()
        location.is_default = True
        location.save()
        return Response(LocationSerializer(location).data)


class StockEntryViewSet(FirmScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only — stock entries are modified via stock action endpoints."""
    serializer_class = StockEntrySerializer

    def get_queryset(self):
        qs = StockEntry.objects.select_related(
            "variant__product", "location"
        ).filter(variant__product__firm=self.get_firm())
        variant_id = self.request.query_params.get("variant")
        location_id = self.request.query_params.get("location")
        if variant_id:
            qs = qs.filter(variant_id=variant_id)
        if location_id:
            qs = qs.filter(location_id=location_id)
        return qs


class StockMovementViewSet(FirmScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Immutable log — read-only."""
    serializer_class = StockMovementSerializer

    def get_queryset(self):
        qs = StockMovement.objects.select_related(
            "variant__product", "location", "created_by"
        ).filter(variant__product__firm=self.get_firm())
        variant_id = self.request.query_params.get("variant")
        location_id = self.request.query_params.get("location")
        movement_type = self.request.query_params.get("movement_type")
        if variant_id:
            qs = qs.filter(variant_id=variant_id)
        if location_id:
            qs = qs.filter(location_id=location_id)
        if movement_type:
            qs = qs.filter(movement_type=movement_type)
        return qs


class AddStockView(APIView):
    """
    Bulk 'add stock' screen — select multiple variants, set quantities.
    POST /api/v1/stock/add/
    """
    permission_classes = [__import__("warehouse.permissions", fromlist=["CanEditWarehouse"]).CanEditWarehouse]

    def post(self, request):
        serializer = AddStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        firm = request.wh_firm
        user = request.wh_user

        # Resolve top-level fallback location
        default_location_id = data.get("location_id")
        if default_location_id:
            default_location = Location.objects.filter(firm=firm, id=default_location_id).first()
            if not default_location:
                return Response({"detail": "Location not found."}, status=404)
        else:
            default_location = Location.objects.filter(firm=firm, is_default=True).first()
            if not default_location:
                default_location = Location.objects.filter(firm=firm).first()
            if not default_location:
                return Response({"detail": "No location found for this firm."}, status=400)

        movements = []
        errors = []
        for line in data["lines"]:
            variant = ProductVariant.objects.filter(
                id=line["variant_id"], product__firm=firm
            ).first()
            if not variant:
                errors.append({"variant_id": str(line["variant_id"]), "error": "Not found"})
                continue
            # Use per-line location if provided, else fall back to top-level
            line_location_id = line.get("location_id")
            if line_location_id:
                line_location = Location.objects.filter(firm=firm, id=line_location_id).first()
                if not line_location:
                    errors.append({"variant_id": str(line["variant_id"]), "error": "Location not found"})
                    continue
            else:
                line_location = default_location
            movement = add_stock(
                variant=variant,
                location=line_location,
                quantity=line["quantity"],
                note=data["note"],
                movement_date=data.get("movement_date"),
                user=user,
            )
            movements.append(movement)

        return Response({
            "movements_created": len(movements),
            "errors": errors,
        }, status=201)


class AdjustStockView(APIView):
    """
    Set a variant's stock at a location to an exact number.
    POST /api/v1/stock/adjust/
    """
    permission_classes = [__import__("warehouse.permissions", fromlist=["CanEditWarehouse"]).CanEditWarehouse]

    def post(self, request):
        serializer = AdjustStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        firm = request.wh_firm

        variant = ProductVariant.objects.filter(id=data["variant_id"], product__firm=firm).first()
        if not variant:
            return Response({"detail": "Variant not found."}, status=404)

        location = Location.objects.filter(id=data["location_id"], firm=firm).first()
        if not location:
            return Response({"detail": "Location not found."}, status=404)

        movement = adjust_stock(
            variant=variant,
            location=location,
            new_quantity=data["new_quantity"],
            note=data.get("note", ""),
            movement_date=data.get("movement_date"),
            user=request.wh_user,
        )
        return Response(StockMovementSerializer(movement).data, status=200)


class TransferStockView(APIView):
    """
    Move stock between locations.
    POST /api/v1/stock/transfer/
    """
    permission_classes = [__import__("warehouse.permissions", fromlist=["CanEditWarehouse"]).CanEditWarehouse]

    def post(self, request):
        serializer = TransferStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        firm = request.wh_firm

        variant = ProductVariant.objects.filter(id=data["variant_id"], product__firm=firm).first()
        if not variant:
            return Response({"detail": "Variant not found."}, status=404)

        from_loc = Location.objects.filter(id=data["from_location_id"], firm=firm).first()
        to_loc = Location.objects.filter(id=data["to_location_id"], firm=firm).first()
        if not from_loc or not to_loc:
            return Response({"detail": "Location not found."}, status=404)

        from warehouse.services.stock import InsufficientStockError
        try:
            out_mv, in_mv = transfer_stock(
                variant=variant,
                from_location=from_loc,
                to_location=to_loc,
                quantity=data["quantity"],
                note=data.get("note", ""),
                movement_date=data.get("movement_date"),
                user=request.wh_user,
            )
        except InsufficientStockError as e:
            return Response({"detail": str(e)}, status=400)

        return Response({
            "out": StockMovementSerializer(out_mv).data,
            "in": StockMovementSerializer(in_mv).data,
        }, status=200)
