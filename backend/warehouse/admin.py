from django.contrib import admin
from warehouse.models import (
    User, Firm, UserWarehouseAccess,
    Category, Product, ProductCost, ProductPhoto,
    VariantAttribute, AttributeValue, ProductVariant,
    Location, StockEntry, StockMovement,
    Sale, SaleLine,
    DamageReport,
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ["email", "name", "is_active"]
    search_fields = ["email", "name"]


@admin.register(Firm)
class FirmAdmin(admin.ModelAdmin):
    list_display = ["name", "warehouse_mode"]


@admin.register(UserWarehouseAccess)
class AccessAdmin(admin.ModelAdmin):
    list_display = ["user", "firm", "level"]


class ProductCostInline(admin.StackedInline):
    model = ProductCost
    extra = 0


class ProductPhotoInline(admin.TabularInline):
    model = ProductPhoto
    extra = 0


class VariantAttributeInline(admin.TabularInline):
    model = VariantAttribute
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "firm", "item_type", "base_price", "is_active"]
    list_filter = ["item_type", "is_active", "firm"]
    search_fields = ["name"]
    inlines = [ProductCostInline, ProductPhotoInline, VariantAttributeInline]


@admin.register(ProductVariant)
class VariantAdmin(admin.ModelAdmin):
    list_display = ["__str__", "sku", "price_delta", "is_active", "total_stock"]
    list_filter = ["is_active", "product__firm"]
    search_fields = ["sku", "product__name"]


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ["name", "firm", "is_default", "is_active"]


@admin.register(StockEntry)
class StockEntryAdmin(admin.ModelAdmin):
    list_display = ["variant", "location", "quantity"]
    list_filter = ["location"]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ["movement_type", "variant", "location", "quantity_delta", "movement_date", "created_by"]
    list_filter = ["movement_type", "location"]
    readonly_fields = ["created_at"]


class SaleLineInline(admin.TabularInline):
    model = SaleLine
    extra = 0
    readonly_fields = ["line_total", "line_cost", "line_profit"]


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ["id", "status", "customer_label", "total", "profit", "finalized_at"]
    list_filter = ["status", "firm"]
    readonly_fields = ["subtotal", "discount_total", "total", "cost_total", "profit"]
    inlines = [SaleLineInline]


@admin.register(DamageReport)
class DamageReportAdmin(admin.ModelAdmin):
    list_display = ["variant", "location", "quantity", "estimated_value_lost", "report_date"]
    list_filter = ["location"]
    readonly_fields = ["created_at"]
