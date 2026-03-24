from rest_framework import viewsets, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import django_filters

from warehouse.models import (
    Category, Product, ProductPhoto, ProductVariant,
    VariantAttribute, AttributeValue,
)
from warehouse.serializers.catalog import (
    CategorySerializer,
    ProductListSerializer,
    ProductDetailSerializer,
    ProductPhotoSerializer,
    ProductVariantSerializer,
    VariantAttributeSerializer,
    AttributeValueSerializer,
)
from .base import FirmScopedMixin


class ProductFilter(django_filters.FilterSet):
    category = django_filters.ModelMultipleChoiceFilter(
        field_name="categories",
        queryset=Category.objects.all(),
        to_field_name="id",
        conjoined=False,  # OR logic — show product if it has ANY of the selected categories
    )
    has_stock = django_filters.BooleanFilter(method="filter_has_stock")

    def filter_has_stock(self, queryset, name, value):
        from django.db.models import Sum
        qs = queryset.annotate(
            _total_stock=Sum("variants__stock_entries__quantity", default=0)
        )
        return qs.filter(_total_stock__gt=0) if value else qs.filter(_total_stock=0)

    class Meta:
        model = Product
        fields = ["item_type", "is_active"]


class CategoryViewSet(FirmScopedMixin, viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]


class ProductViewSet(FirmScopedMixin, viewsets.ModelViewSet):
    queryset = Product.objects.select_related("cost").prefetch_related(
        "categories", "photos", "attributes__values", "variants__attribute_values", "variants__stock_entries"
    )
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ProductFilter
    search_fields = ["name", "description", "variants__attribute_values__value"]
    ordering_fields = ["name", "base_price", "created_at"]
    ordering = ["name"]

    def get_serializer_class(self):
        if self.action == "list":
            return ProductListSerializer
        return ProductDetailSerializer

    @action(detail=True, methods=["post"], parser_classes=[parsers.MultiPartParser], url_path="upload-photo")
    def upload_photo(self, request, pk=None):
        product = self.get_object()
        serializer = ProductPhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        photo = serializer.save(
            product=product,
            created_by=self.get_user(),
            updated_by=self.get_user(),
        )
        # If first photo, mark as primary
        if product.photos.count() == 1:
            photo.is_primary = True
            photo.save(update_fields=["is_primary"])
        return Response(ProductPhotoSerializer(photo, context={"request": request}).data, status=201)

    @action(detail=True, methods=["delete"], url_path="photos/(?P<photo_id>[^/.]+)")
    def delete_photo(self, request, pk=None, photo_id=None):
        product = self.get_object()
        photo = product.photos.filter(id=photo_id).first()
        if not photo:
            return Response({"detail": "Not found."}, status=404)
        photo.image.delete(save=False)
        photo.delete()
        return Response(status=204)

    @action(detail=True, methods=["patch"], url_path="photos/(?P<photo_id>[^/.]+)/set-primary")
    def set_primary_photo(self, request, pk=None, photo_id=None):
        product = self.get_object()
        photo = product.photos.filter(id=photo_id).first()
        if not photo:
            return Response({"detail": "Not found."}, status=404)
        product.photos.update(is_primary=False)
        photo.is_primary = True
        photo.save(update_fields=["is_primary"])
        return Response(status=204)

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        mode = self.get_firm().warehouse_mode
        variants = list(product.variants.prefetch_related("stock_entries", "movements").all())

        if mode == "strict":
            for v in variants:
                total_stock = sum(e.quantity for e in v.stock_entries.all())
                if total_stock > 0:
                    return Response(
                        {"detail": f"Cannot delete: product has stock in warehouse. Write off or transfer all stock first, or archive the product."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if v.movements.exists():
                    return Response(
                        {"detail": "Cannot delete: product has stock movement history. Archive it to preserve the audit trail."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        elif mode == "soft":
            for v in variants:
                total_stock = sum(e.quantity for e in v.stock_entries.all())
                if total_stock > 0:
                    return Response(
                        {"detail": f"Cannot delete: product still has stock in warehouse. Remove the stock first."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        # "disabled" mode: no restrictions

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def tree(self, request, pk=None):
        """Returns product + all variants + stock entries per location."""
        product = self.get_object()
        from warehouse.models import Location
        locations = Location.objects.filter(firm=self.get_firm(), is_active=True)
        tree = {
            "product": ProductDetailSerializer(product, context={"request": request}).data,
            "locations": [{"id": str(l.id), "name": l.name} for l in locations],
            "variants": [],
        }
        for variant in product.variants.prefetch_related("stock_entries__location", "attribute_values").filter(is_active=True):
            stock_by_location = {
                str(e.location_id): e.quantity
                for e in variant.stock_entries.all()
            }
            tree["variants"].append({
                "variant": ProductVariantSerializer(variant, context={"request": request}).data,
                "stock_by_location": stock_by_location,
                "total_stock": variant.total_stock,
            })
        return Response(tree)


class ProductVariantViewSet(FirmScopedMixin, viewsets.ModelViewSet):
    queryset = ProductVariant.objects.select_related("product").prefetch_related(
        "attribute_values", "stock_entries"
    )
    serializer_class = ProductVariantSerializer

    def get_queryset(self):
        qs = ProductVariant.objects.select_related("product").prefetch_related(
            "attribute_values", "stock_entries"
        ).filter(product__firm=self.get_firm())
        product_id = self.request.query_params.get("product")
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def get_firm(self):
        return self.request.wh_firm

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.get_user(),
            updated_by=self.get_user(),
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.get_user())

    def destroy(self, request, *args, **kwargs):
        variant = self.get_object()
        mode = self.get_firm().warehouse_mode

        if mode == "strict":
            total_stock = sum(e.quantity for e in variant.stock_entries.all())
            if total_stock > 0:
                return Response(
                    {"detail": f"Cannot delete: variant has {total_stock} units in stock. Write off or transfer all stock first, or archive the variant."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if variant.movements.exists():
                return Response(
                    {"detail": "Cannot delete: variant has stock movement history. Archive or retire it to preserve the audit trail."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif mode == "soft":
            total_stock = sum(e.quantity for e in variant.stock_entries.all())
            if total_stock > 0:
                return Response(
                    {"detail": f"Cannot delete: variant still has {total_stock} units in stock. Remove the stock first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        # "disabled" mode: no restrictions

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], parser_classes=[parsers.MultiPartParser], url_path="upload-photo")
    def upload_photo(self, request, pk=None):
        variant = self.get_object()
        if "photo" not in request.FILES:
            return Response({"detail": "No photo provided."}, status=400)
        variant.photo = request.FILES["photo"]
        variant.save(update_fields=["photo", "updated_at"])
        return Response(ProductVariantSerializer(variant, context={"request": request}).data)


class VariantAttributeViewSet(FirmScopedMixin, viewsets.ModelViewSet):
    queryset = VariantAttribute.objects.select_related("product").prefetch_related("values")
    serializer_class = VariantAttributeSerializer

    def get_queryset(self):
        qs = VariantAttribute.objects.select_related("product").prefetch_related("values").filter(
            product__firm=self.get_firm()
        )
        product_id = self.request.query_params.get("product")
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def get_firm(self):
        return self.request.wh_firm

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.get_user(),
            updated_by=self.get_user(),
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.get_user())


class AttributeValueViewSet(FirmScopedMixin, viewsets.ModelViewSet):
    queryset = AttributeValue.objects.select_related("attribute__product")
    serializer_class = AttributeValueSerializer

    def get_queryset(self):
        qs = AttributeValue.objects.select_related("attribute__product").filter(
            attribute__product__firm=self.get_firm()
        )
        attribute_id = self.request.query_params.get("attribute")
        if attribute_id:
            qs = qs.filter(attribute_id=attribute_id)
        return qs

    def get_firm(self):
        return self.request.wh_firm

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.get_user(),
            updated_by=self.get_user(),
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.get_user())
