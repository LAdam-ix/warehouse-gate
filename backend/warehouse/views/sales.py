from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.core.exceptions import ValidationError

from warehouse.models import Sale, SaleLine
from warehouse.serializers.sales import (
    SaleSerializer,
    SaleListSerializer,
    SaleUpdateSerializer,
    SaleLineSerializer,
    SaleLineCreateSerializer,
)
from warehouse.services.sales import finalize_sale, void_sale, apply_credit_note
from .base import FirmScopedMixin


class SaleViewSet(FirmScopedMixin, viewsets.ModelViewSet):
    queryset = Sale.objects.prefetch_related("lines__variant__product")
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status"]
    search_fields = ["customer_label", "note"]
    ordering_fields = ["created_at", "finalized_at", "total"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return SaleListSerializer
        if self.action in ("update", "partial_update"):
            return SaleUpdateSerializer
        return SaleSerializer

    def update(self, request, *args, **kwargs):
        sale = self.get_object()
        if sale.status != Sale.Status.DRAFT:
            return Response(
                {"detail": "Only draft sales can be edited."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def finalize(self, request, pk=None):
        sale = self.get_object()
        try:
            sale = finalize_sale(sale, user=self.get_user())
        except ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(SaleSerializer(sale, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        sale = self.get_object()
        try:
            sale = void_sale(sale, user=self.get_user())
        except ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(SaleSerializer(sale, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="credit-note")
    def credit_note(self, request, pk=None):
        """
        Link a fakturuj si credit note and return stock.
        Body: { "credit_note_id": "<uuid>" }
        """
        sale = self.get_object()
        credit_note_id = request.data.get("credit_note_id")
        if not credit_note_id:
            return Response({"detail": "credit_note_id is required."}, status=400)
        try:
            sale = apply_credit_note(sale, credit_note_id, user=self.get_user())
        except ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(SaleSerializer(sale, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="recalculate")
    def recalculate(self, request, pk=None):
        """Recalculate and save totals for a draft sale."""
        sale = self.get_object()
        sale.recalculate_totals()
        sale.save()
        return Response(SaleSerializer(sale, context={"request": request}).data)


class SaleLineViewSet(FirmScopedMixin, viewsets.ModelViewSet):
    queryset = SaleLine.objects.select_related("variant__product", "sale")

    def get_queryset(self):
        qs = SaleLine.objects.select_related("variant__product", "sale").filter(
            sale__firm=self.get_firm()
        )
        sale_id = self.kwargs.get("sale_pk") or self.request.query_params.get("sale")
        if sale_id:
            qs = qs.filter(sale_id=sale_id)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return SaleLineCreateSerializer
        return SaleLineSerializer

    def _get_sale(self, sale_id=None):
        sid = sale_id or self.kwargs.get("sale_pk")
        return Sale.objects.filter(id=sid, firm=self.get_firm()).first()

    def perform_create(self, serializer):
        sale_id = self.kwargs.get("sale_pk") or self.request.data.get("sale")
        sale = self._get_sale(sale_id)
        if not sale:
            from rest_framework.exceptions import NotFound
            raise NotFound("Sale not found.")
        if sale.status != Sale.Status.DRAFT:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Cannot add lines to a non-draft sale.")
        line = serializer.save(
            sale=sale,
            created_by=self.get_user(),
            updated_by=self.get_user(),
        )
        # Recalculate sale totals
        sale.recalculate_totals()
        sale.save()

    def perform_update(self, serializer):
        line = serializer.save(updated_by=self.get_user())
        sale = line.sale
        if sale.status == Sale.Status.DRAFT:
            sale.recalculate_totals()
            sale.save()

    def perform_destroy(self, instance):
        sale = instance.sale
        instance.delete()
        if sale.status == Sale.Status.DRAFT:
            sale.recalculate_totals()
            sale.save()
