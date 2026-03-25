from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers as nested_routers

from warehouse.views.catalog import (
    CategoryViewSet,
    ProductViewSet,
    ProductVariantViewSet,
    VariantAttributeViewSet,
    AttributeValueViewSet,
)
from warehouse.views.stock import (
    LocationViewSet,
    StockEntryViewSet,
    StockMovementViewSet,
    AddStockView,
    AdjustStockView,
    TransferStockView,
    BatchTransferView,
)
from warehouse.views.sales import SaleViewSet, SaleLineViewSet
from warehouse.views.damage import DamageReportViewSet
from warehouse.views.dashboard import DashboardView
from warehouse.views.firm import FirmSettingsView, WarehouseSettingsView
from warehouse.views.production import ProductionRequestViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("products", ProductViewSet, basename="product")
router.register("variants", ProductVariantViewSet, basename="variant")
router.register("attributes", VariantAttributeViewSet, basename="attribute")
router.register("attribute-values", AttributeValueViewSet, basename="attribute-value")
router.register("locations", LocationViewSet, basename="location")
router.register("stock-entries", StockEntryViewSet, basename="stock-entry")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")
router.register("sales", SaleViewSet, basename="sale")
router.register("damage-reports", DamageReportViewSet, basename="damage-report")
router.register("production-requests", ProductionRequestViewSet, basename="production-request")

# Nested: /sales/{sale_pk}/lines/
sales_router = nested_routers.NestedDefaultRouter(router, "sales", lookup="sale")
sales_router.register("lines", SaleLineViewSet, basename="sale-lines")

urlpatterns = [
    path("", include(router.urls)),
    path("", include(sales_router.urls)),
    path("stock/add/", AddStockView.as_view(), name="stock-add"),
    path("stock/adjust/", AdjustStockView.as_view(), name="stock-adjust"),
    path("stock/transfer/", TransferStockView.as_view(), name="stock-transfer"),
    path("stock/batch-transfer/", BatchTransferView.as_view(), name="stock-batch-transfer"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("firm/", FirmSettingsView.as_view(), name="firm-settings"),
    path("settings/", WarehouseSettingsView.as_view(), name="warehouse-settings"),
]
