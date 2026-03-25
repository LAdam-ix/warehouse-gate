from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count, F, Q
from django.utils import timezone
from datetime import timedelta

from warehouse.models import Product, ProductVariant, Sale, DamageReport, StockEntry
from warehouse.permissions import CanViewWarehouse


class DashboardView(APIView):
    permission_classes = [CanViewWarehouse]

    def get(self, request):
        firm = request.wh_firm

        # --- Period filter ---
        period = request.query_params.get("period", "month")
        if period not in ("week", "month", "year", "all"):
            period = "month"

        period_days = {"week": 7, "month": 30, "year": 365}

        # --- Catalog stats ---
        total_products = Product.objects.filter(firm=firm, is_active=True).count()
        total_variants = ProductVariant.objects.filter(
            product__firm=firm, is_active=True
        ).count()

        # Stock value = sum(quantity × effective cost) across all entries
        stock_entries = StockEntry.objects.filter(
            variant__product__firm=firm
        ).select_related("variant__product")

        total_stock_units = 0
        stock_value = 0
        stock_retail_value = 0
        low_stock_variants = 0
        for entry in stock_entries:
            total_stock_units += entry.quantity
            stock_value += entry.quantity * float(entry.variant.effective_cost)
            stock_retail_value += entry.quantity * float(entry.variant.effective_price)
            if entry.variant.is_low_stock:
                low_stock_variants += 1

        # --- Sales stats (period) ---
        period_sales_qs = Sale.objects.filter(firm=firm, status=Sale.Status.FINALIZED)
        period_damage_qs = DamageReport.objects.filter(firm=firm)

        if period != "all":
            since = timezone.now() - timedelta(days=period_days[period])
            period_sales_qs = period_sales_qs.filter(finalized_at__gte=since)
            period_damage_qs = period_damage_qs.filter(report_date__gte=since)

        sales_count = period_sales_qs.count()
        revenue_period = period_sales_qs.aggregate(t=Sum("total"))["t"] or 0
        profit_period = period_sales_qs.aggregate(t=Sum("profit"))["t"] or 0
        cost_period = period_sales_qs.aggregate(t=Sum("cost_total"))["t"] or 0

        # --- Losses (period) ---
        damage_count = period_damage_qs.count()
        damage_value = period_damage_qs.aggregate(t=Sum("estimated_value_lost"))["t"] or 0

        net_profit = float(profit_period) - float(damage_value)

        # All time
        all_sales = Sale.objects.filter(firm=firm, status=Sale.Status.FINALIZED)
        revenue_all = all_sales.aggregate(t=Sum("total"))["t"] or 0
        profit_all = all_sales.aggregate(t=Sum("profit"))["t"] or 0

        # --- Recent activity ---
        recent_sales_list = Sale.objects.filter(
            firm=firm, status__in=[Sale.Status.FINALIZED, Sale.Status.DRAFT]
        ).order_by("-created_at")[:5]

        return Response({
            "period": period,
            "catalog": {
                "total_products": total_products,
                "total_variants": total_variants,
                "total_stock_units": total_stock_units,
                "stock_value": round(stock_value, 2),
                "stock_potential_profit": round(stock_retail_value - stock_value, 2),
                "low_stock_variants": low_stock_variants,
            },
            "sales_period": {
                "count": sales_count,
                "revenue": float(revenue_period),
                "cost": float(cost_period),
                "profit": float(profit_period),
                "net_profit": round(net_profit, 2),
            },
            "sales_all_time": {
                "revenue": float(revenue_all),
                "profit": float(profit_all),
            },
            "damage_period": {
                "count": damage_count,
                "estimated_value_lost": float(damage_value),
            },
            "recent_sales": [
                {
                    "id": str(s.id),
                    "status": s.status,
                    "customer_label": s.customer_label,
                    "total": float(s.total),
                    "created_at": s.created_at,
                }
                for s in recent_sales_list
            ],
        })
