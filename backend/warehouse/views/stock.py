import uuid
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView

from warehouse.models import Location, StockEntry, StockMovement, ProductVariant
from warehouse.serializers.stock import (
    LocationSerializer,
    StockEntrySerializer,
    StockMovementSerializer,
    AddStockSerializer,
    AdjustStockSerializer,
    TransferStockSerializer,
    BatchTransferSerializer,
)
from warehouse.services.stock import add_stock, adjust_stock, transfer_stock, revert_movement, redistribute_stock, REVERTABLE_TYPES
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

    @action(detail=True, methods=["post"], url_path="move-up")
    def move_up(self, request, pk=None):
        return self._move_location(request, "up")

    @action(detail=True, methods=["post"], url_path="move-down")
    def move_down(self, request, pk=None):
        return self._move_location(request, "down")

    def _move_location(self, request, direction):
        loc = self.get_object()
        firm_locs = list(Location.objects.filter(firm=loc.firm).order_by("sort_order", "created_at"))
        idx = next((i for i, l in enumerate(firm_locs) if l.pk == loc.pk), None)
        if idx is None:
            return Response(status=404)
        swap_idx = idx - 1 if direction == "up" else idx + 1
        if swap_idx < 0 or swap_idx >= len(firm_locs):
            return Response({"detail": "Already at edge."}, status=400)
        other = firm_locs[swap_idx]
        loc.sort_order, other.sort_order = other.sort_order, loc.sort_order
        loc.save(update_fields=["sort_order"])
        other.save(update_fields=["sort_order"])
        return Response(LocationSerializer(Location.objects.filter(firm=loc.firm).order_by("sort_order", "created_at"), many=True).data)


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
    """
    Immutable stock log — read-only.

    Returns movements grouped by batch_id. Each entry in the paginated list is
    either a single movement (no batch) or a group of movements sharing a batch_id.
    Pagination counts groups, not individual rows — a batch of 20 items = 1 entry.

    Response format:
        { count, next, previous, results: [ { batchId, movements: [...] }, ... ] }
    """
    serializer_class = StockMovementSerializer

    def _base_queryset(self):
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

    def get_queryset(self):
        return self._base_queryset()

    def list(self, request, *args, **kwargs):
        """Custom list: paginate by logical groups (batch or single), not raw rows."""
        from django.db.models import Max, Count
        from collections import OrderedDict

        qs = self._base_queryset()

        # Get distinct group keys with their latest timestamp for ordering.
        # Each group is either a batch_id or a single movement id (for non-batch).
        # We query the distinct batch_ids + individual movement ids, ordered by newest first.
        batch_groups = (
            qs.filter(batch_id__isnull=False)
            .values("batch_id")
            .annotate(latest=Max("created_at"), count=Count("id"))
            .order_by("-latest")
        )
        single_movements = (
            qs.filter(batch_id__isnull=True)
            .values("id", "created_at")
            .order_by("-created_at")
        )

        # Build unified ordered list of group keys: (timestamp, type, key)
        group_keys = []
        for bg in batch_groups:
            group_keys.append((bg["latest"], "batch", bg["batch_id"]))
        for sm in single_movements:
            group_keys.append((sm["created_at"], "single", sm["id"]))
        group_keys.sort(key=lambda x: x[0], reverse=True)

        # Paginate the group keys
        page_size = int(request.query_params.get("page_size", 50))
        page_size = min(max(page_size, 1), 500)
        page_num = int(request.query_params.get("page", 1))
        total_groups = len(group_keys)
        start = (page_num - 1) * page_size
        end = start + page_size
        page_keys = group_keys[start:end]

        # Fetch all movements for this page's groups in one query
        batch_ids = [k[2] for k in page_keys if k[1] == "batch"]
        single_ids = [k[2] for k in page_keys if k[1] == "single"]

        from django.db.models import Q
        if batch_ids and single_ids:
            page_movements = qs.filter(Q(batch_id__in=batch_ids) | Q(id__in=single_ids))
        elif batch_ids:
            page_movements = qs.filter(batch_id__in=batch_ids)
        elif single_ids:
            page_movements = qs.filter(id__in=single_ids)
        else:
            page_movements = qs.none()

        serializer = self.get_serializer(page_movements, many=True)
        movement_data = serializer.data

        # Group serialized data by batch_id, preserving page order
        batch_map = OrderedDict()
        singles = {}
        for m in movement_data:
            bid = m.get("batch_id") or m.get("batchId")
            mid = m.get("id")
            if bid:
                batch_map.setdefault(bid, []).append(m)
            else:
                singles[mid] = m

        # Build result in the same order as page_keys
        results = []
        for _, gtype, key in page_keys:
            if gtype == "batch" and str(key) in batch_map:
                results.append({"batchId": str(key), "movements": batch_map[str(key)]})
            elif gtype == "single" and str(key) in singles:
                results.append({"batchId": None, "movements": [singles[str(key)]]})

        # Build pagination URLs
        base_url = request.build_absolute_uri(request.path)
        params = request.query_params.copy()

        def page_url(p):
            params["page"] = str(p)
            return f"{base_url}?{'&'.join(f'{k}={v}' for k, v in params.items())}"

        return Response({
            "count": total_groups,
            "next": page_url(page_num + 1) if end < total_groups else None,
            "previous": page_url(page_num - 1) if page_num > 1 else None,
            "results": results,
        })

    @action(detail=True, methods=["post"])
    def revert(self, request, pk=None):
        """Revert a manual stock movement. Only the most recent movement can be reverted."""
        movement = self.get_object()

        if movement.movement_type not in REVERTABLE_TYPES:
            return Response(
                {"detail": f"Cannot revert {movement.movement_type} movements."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check it's the latest movement for this variant+location
        newer = StockMovement.objects.filter(
            variant=movement.variant,
            location=movement.location,
            created_at__gt=movement.created_at,
        ).exists()
        if newer:
            return Response(
                {"detail": "Can only revert the most recent movement for this variant/location."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from warehouse.services.stock import InsufficientStockError
        try:
            revert_movement(movement=movement, user=request.wh_user)
        except (ValueError, InsufficientStockError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_204_NO_CONTENT)


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

        shared_batch_id = uuid.uuid4()

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
                batch_id=shared_batch_id,
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


class BatchTransferView(APIView):
    """
    Bulk transfer — move multiple items to one destination.
    POST /api/v1/stock/batch-transfer/
    """
    permission_classes = [__import__("warehouse.permissions", fromlist=["CanEditWarehouse"]).CanEditWarehouse]

    def post(self, request):
        serializer = BatchTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        firm = request.wh_firm

        to_loc = Location.objects.filter(id=data["to_location_id"], firm=firm).first()
        if not to_loc:
            return Response({"detail": "Destination location not found."}, status=404)

        from warehouse.services.stock import InsufficientStockError

        batch_id = uuid.uuid4()
        results = []
        errors = []

        for line in data["lines"]:
            variant = ProductVariant.objects.filter(id=line["variant_id"], product__firm=firm).first()
            if not variant:
                errors.append({"variantId": str(line["variant_id"]), "error": "Not found"})
                continue

            from_loc = Location.objects.filter(id=line["from_location_id"], firm=firm).first()
            if not from_loc:
                errors.append({"variantId": str(line["variant_id"]), "error": "Source location not found"})
                continue

            try:
                out_mv, in_mv = transfer_stock(
                    variant=variant,
                    from_location=from_loc,
                    to_location=to_loc,
                    quantity=line["quantity"],
                    note=data.get("note", ""),
                    movement_date=data.get("movement_date"),
                    user=request.wh_user,
                )
                # stamp batch_id on both movements
                StockMovement.objects.filter(id__in=[out_mv.id, in_mv.id]).update(batch_id=batch_id)
                results.append({"variantId": str(variant.id), "quantity": line["quantity"]})
            except InsufficientStockError as e:
                errors.append({"variantId": str(line["variant_id"]), "error": str(e)})

        return Response({
            "transfersCompleted": len(results),
            "errors": errors,
            "batchId": str(batch_id),
        }, status=201)


class RedistributeStockView(APIView):
    """
    Redistribute stock between variants of the same product at one location.
    POST /api/v1/stock/redistribute/
    Body: { locationId, note?, lines: [{ variantId, delta }] }
    Deltas must sum to 0.
    """
    permission_classes = [__import__("warehouse.permissions", fromlist=["CanEditWarehouse"]).CanEditWarehouse]

    def post(self, request):
        from rest_framework import serializers as ser

        class LineSerializer(ser.Serializer):
            variant_id = ser.UUIDField()
            delta = ser.IntegerField()

        class InputSerializer(ser.Serializer):
            location_id = ser.UUIDField()
            lines = LineSerializer(many=True)
            note = ser.CharField(required=False, default="")

        serializer = InputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        firm = request.wh_firm

        location = Location.objects.filter(id=data["location_id"], firm=firm).first()
        if not location:
            return Response({"detail": "Location not found."}, status=404)

        from warehouse.services.stock import InsufficientStockError
        try:
            movements, batch_id = redistribute_stock(
                lines=data["lines"],
                location=location,
                note=data.get("note", ""),
                user=request.wh_user,
            )
        except (ValueError, InsufficientStockError) as e:
            return Response({"detail": str(e)}, status=400)

        return Response({
            "movementsCreated": len(movements),
            "batchId": str(batch_id),
        }, status=201)
