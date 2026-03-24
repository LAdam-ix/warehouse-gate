import { useState } from "react";
import {
  Box, Card, CardContent, Chip, CircularProgress, Divider,
  Grid, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { useDashboard } from "../../api/hooks";
import { useNavigate } from "react-router-dom";
import type { DashboardPeriod } from "../../types/api";
import { useTranslation } from "react-i18next";

function StatCard({
  title, value, sub, color, small,
}: {
  title: string;
  value: string | number;
  sub?: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
        <Typography variant={small ? "h6" : "h5"} fontWeight="bold" color={color ?? "text.primary"}>
          {value}
        </Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const { data, isLoading } = useDashboard(period);
  const navigate = useNavigate();

  const PERIOD_LABELS: Record<DashboardPeriod, string> = {
    week: t("dashboard.period.thisWeek"),
    month: t("dashboard.period.last30Days"),
    year: t("dashboard.period.thisYear"),
    all: t("dashboard.period.allTime"),
  };

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (!data) return null;

  const { catalog, salesPeriod, salesAllTime, damagePeriod, recentSales } = data;
  const marginPct = salesPeriod.revenue > 0
    ? ((salesPeriod.profit / salesPeriod.revenue) * 100).toFixed(1)
    : "—";
  const netMarginPct = salesPeriod.revenue > 0
    ? ((salesPeriod.netProfit / salesPeriod.revenue) * 100).toFixed(1)
    : "—";
  const allTimeMargin = salesAllTime.revenue > 0
    ? ((salesAllTime.profit / salesAllTime.revenue) * 100).toFixed(1)
    : "—";

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight="bold">{t("dashboard.title")}</Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={period}
          onChange={(_, v: DashboardPeriod) => { if (v) setPeriod(v); }}
        >
          {(["week", "month", "year", "all"] as DashboardPeriod[]).map((p) => (
            <ToggleButton key={p} value={p} sx={{ px: 1.5, py: 0.5, fontSize: "0.8rem", textTransform: "none" }}>
              {p === "week" ? t("dashboard.period.week") : p === "month" ? t("dashboard.period.month") : p === "year" ? t("dashboard.period.year") : t("dashboard.period.allTime")}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {/* ── Inventory ── */}
      <Box>
        <Typography variant="overline" color="text.secondary">{t("dashboard.inventory")}</Typography>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title={t("dashboard.products")} value={catalog.totalProducts} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title={t("dashboard.skusVariants")} value={catalog.totalVariants} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title={t("dashboard.unitsInStock")} value={catalog.totalStockUnits} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              title={t("dashboard.stockValueCost")}
              value={`€${catalog.stockValue.toFixed(2)}`}
              color="info.main"
              sub={t("dashboard.stockValueSub")}
            />
          </Grid>
        </Grid>
        {catalog.lowStockVariants > 0 && (
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1 }}>
            <WarningAmberIcon color="warning" fontSize="small" />
            <Typography variant="caption" color="warning.main">
              {t(catalog.lowStockVariants !== 1 ? "dashboard.lowStockWarning_other" : "dashboard.lowStockWarning_one", { count: catalog.lowStockVariants })}
            </Typography>
          </Stack>
        )}
      </Box>

      <Divider />

      {/* ── Sales period ── */}
      <Box>
        <Typography variant="overline" color="text.secondary">
          {t("dashboard.salesPeriod", { period: PERIOD_LABELS[period] })}
        </Typography>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title={t("dashboard.salesCount")} value={salesPeriod.count} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title={t("dashboard.revenue")} value={`€${salesPeriod.revenue.toFixed(2)}`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              title={t("dashboard.grossProfit")}
              value={`€${salesPeriod.profit.toFixed(2)}`}
              sub={t("dashboard.marginPct", { value: marginPct })}
              color={salesPeriod.profit >= 0 ? "success.main" : "error.main"}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              title={t("dashboard.netProfit")}
              value={`€${salesPeriod.netProfit.toFixed(2)}`}
              sub={t("dashboard.netMarginPct", { value: netMarginPct })}
              color={salesPeriod.netProfit >= 0 ? "success.main" : "error.main"}
              small
            />
          </Grid>
        </Grid>

        {/* Cost + loss breakdown */}
        <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mt: 1.5 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">{t("dashboard.productionCost")}</Typography>
            <Typography variant="body2" fontWeight="medium">€{salesPeriod.cost.toFixed(2)}</Typography>
          </Box>
          {damagePeriod.count > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <TrendingDownIcon sx={{ fontSize: 14, color: "error.main" }} />
                <Typography variant="caption" color="error.main">
                  {t(damagePeriod.count !== 1 ? "dashboard.writeOffLosses_other" : "dashboard.writeOffLosses_one", { count: damagePeriod.count })}
                </Typography>
              </Stack>
              <Typography variant="body2" fontWeight="medium" color="error.main">
                −€{damagePeriod.estimatedValueLost.toFixed(2)}
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      <Divider />

      {/* ── All-time summary ── */}
      <Box>
        <Typography variant="overline" color="text.secondary">{t("dashboard.allTime")}</Typography>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <StatCard title={t("dashboard.totalRevenue")} value={`€${salesAllTime.revenue.toFixed(2)}`} small />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <StatCard
              title={t("dashboard.totalProfit")}
              value={`€${salesAllTime.profit.toFixed(2)}`}
              sub={t("dashboard.marginPct", { value: allTimeMargin })}
              color={salesAllTime.profit >= 0 ? "success.main" : "error.main"}
              small
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ height: "100%", bgcolor: salesPeriod.netProfit >= 0 ? "success.50" : "error.50" }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {salesAllTime.profit >= 0
                    ? <TrendingUpIcon color="success" fontSize="small" />
                    : <TrendingDownIcon color="error" fontSize="small" />}
                  <Typography variant="body2" color="text.secondary">{t("dashboard.businessHealth")}</Typography>
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Stock worth <strong>€{catalog.stockValue.toFixed(2)}</strong> + all-time profit{" "}
                  <strong style={{ color: salesAllTime.profit >= 0 ? "inherit" : "red" }}>
                    €{salesAllTime.profit.toFixed(2)}
                  </strong>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      <Divider />

      {/* ── Recent sales ── */}
      <Box>
        <Typography variant="overline" color="text.secondary">{t("dashboard.recentSales")}</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {recentSales.length === 0 && (
            <Typography variant="body2" color="text.secondary">{t("dashboard.noSalesYet")}</Typography>
          )}
          {recentSales.map((s) => (
            <Card
              key={s.id}
              variant="outlined"
              sx={{ cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
              onClick={() => navigate(`/sales/${s.id}`)}
            >
              <CardContent sx={{ py: 1, "&:last-child": { pb: 1 }, display: "flex", alignItems: "center", gap: 2 }}>
                <Chip
                  label={s.status}
                  size="small"
                  color={s.status === "finalized" ? "success" : s.status === "voided" ? "default" : "warning"}
                />
                <Typography variant="body2" sx={{ flex: 1 }}>{s.customerLabel || "—"}</Typography>
                <Typography variant="body2" fontWeight="bold">€{s.total.toFixed(2)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(s.createdAt).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
