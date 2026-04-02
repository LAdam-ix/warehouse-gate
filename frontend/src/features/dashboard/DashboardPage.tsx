import { useState } from "react";
import {
  Box, Card, CardContent, Chip, CircularProgress, Divider,
  Grid, IconButton, Popover, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { useDashboard } from "../../api/hooks";
import { useNavigate } from "react-router-dom";
import type { DashboardPeriod } from "../../types/api";
import { useTranslation } from "react-i18next";
import { navLinkProps } from "../../utils/navLink";

function StatCard({
  title, value, sub, color, small, compact,
}: {
  title: string;
  value: string | number;
  sub?: string;
  color?: string;
  small?: boolean;
  compact?: boolean;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent sx={compact ? { p: 1.5, "&:last-child": { pb: 1.5 } } : undefined}>
        <Typography variant={compact ? "caption" : "body2"} color="text.secondary" gutterBottom display="block">
          {title}
        </Typography>
        <Typography variant={compact ? "h6" : small ? "h6" : "h5"} fontWeight="bold" color={color ?? "text.primary"}>
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
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | undefined>();
  const [rangeAnchor, setRangeAnchor] = useState<HTMLElement | null>(null);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const { data, isLoading } = useDashboard(period, dateRange);
  const navigate = useNavigate();

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
        <Stack direction="row" spacing={0.5} alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={period}
            onChange={(_, v: DashboardPeriod) => { if (v) { setPeriod(v); setDateRange(undefined); } }}
          >
            {(["today", "week", "month", "year", "all"] as DashboardPeriod[]).map((p) => (
              <ToggleButton key={p} value={p} sx={{ px: 1.5, py: 0.5, fontSize: "0.8rem", textTransform: "none" }}>
                {t(`dashboard.period.${p}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton
            size="small"
            color={period === "custom" ? "primary" : "default"}
            onClick={(e) => {
              setRangeFrom(dateRange?.from ?? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
              setRangeTo(dateRange?.to ?? new Date().toISOString().slice(0, 10));
              setRangeAnchor(e.currentTarget);
            }}
          >
            <CalendarMonthIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Popover
            open={!!rangeAnchor}
            anchorEl={rangeAnchor}
            onClose={() => setRangeAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Stack spacing={1.5} sx={{ p: 2, minWidth: 220 }}>
              <Typography variant="subtitle2" fontWeight="bold">{t("dashboard.period.customRange")}</Typography>
              <TextField label={t("dashboard.period.from")} type="date" size="small" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label={t("dashboard.period.to")} type="date" size="small" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <ToggleButton
                value="apply"
                selected={false}
                size="small"
                sx={{ textTransform: "none" }}
                onClick={() => {
                  if (rangeFrom && rangeTo) {
                    setPeriod("custom");
                    setDateRange({ from: rangeFrom, to: rangeTo });
                    setRangeAnchor(null);
                  }
                }}
              >
                {t("dashboard.period.apply")}
              </ToggleButton>
            </Stack>
          </Popover>
        </Stack>
      </Stack>

      {/* ── Inventory ── */}
      <Box>
        <Typography variant="overline" color="text.secondary">{t("dashboard.inventory")}</Typography>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 4, sm: 2 }}>
            <StatCard title={t("dashboard.products")} value={catalog.totalProducts} compact />
          </Grid>
          <Grid size={{ xs: 4, sm: 2 }}>
            <StatCard title={t("dashboard.variantsSKUs")} value={catalog.totalVariants} compact />
          </Grid>
          <Grid size={{ xs: 4, sm: 2 }}>
            <StatCard title={t("dashboard.unitsInStock")} value={catalog.totalStockUnits} compact />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              title={t("dashboard.stockValueCost")}
              value={`€${catalog.stockValue.toFixed(2)}`}
              color="info.main"
              sub={t("dashboard.stockValueSub")}
              small
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              title={t("dashboard.stockPotentialProfit")}
              value={`€${catalog.stockPotentialProfit.toFixed(2)}`}
              color={catalog.stockPotentialProfit >= 0 ? "success.main" : "error.main"}
              sub={t("dashboard.stockPotentialProfitSub")}
              small
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
          {t("dashboard.salesPeriod", { period: t(`dashboard.period.${period}`) })}
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
              {...navLinkProps(`/sales/${s.id}`, navigate)}
              sx={{ cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
            >
              <CardContent sx={{ py: 1, "&:last-child": { pb: 1 }, display: "flex", alignItems: "center", gap: 2 }}>
                <Chip
                  label={s.status}
                  size="small"
                  color={s.status === "finalized" ? "success" : s.status === "voided" ? "error" : s.status === "refunded" ? "info" : s.status === "discarded" ? "default" : "warning"}
                />
                <Typography variant="body2" noWrap sx={{ flex: 1 }}>{s.note || "—"}</Typography>
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
