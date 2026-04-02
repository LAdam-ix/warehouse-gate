import { useState } from "react";
import {
  Box, Button, Chip, CircularProgress, Collapse, Divider, IconButton,
  InputAdornment, Paper, Stack, TextField, Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InventoryIcon from "@mui/icons-material/Inventory2";
import SearchIcon from "@mui/icons-material/Search";
import { useProducts, useProduct, useCategories, useLocations } from "../api/hooks";
import { variantLabel, sortVariants } from "../utils/variantLabel";
import type { Product, ProductVariant } from "../types/api";
import { useTranslation } from "react-i18next";

export type ProductPickerSelectFn = (
  variant: ProductVariant,
  label: string,
  product: { itemType: string; servicePricing: string | null; hourlyRate: string | null },
  quantity?: number,
) => void;

// ─── Expanded variant list (inside a multi-variant product row) ───────────────

export function StockChips({ variant, locations, chipColor, onLocationClick }: {
  variant: { totalStock: number; stockByLocation?: Record<string, number>; isLowStock?: boolean };
  locations: { id: string; name: string }[];
  chipColor?: "default" | "error" | "warning" | "success";
  onLocationClick?: (locationId: string) => void;
}) {
  const locsWithStock = locations.filter((loc) => (variant.stockByLocation?.[loc.id] ?? 0) > 0);
  const actualTotal = locsWithStock.reduce((s, loc) => s + (variant.stockByLocation?.[loc.id] ?? 0), 0);
  const displayTotal = actualTotal || variant.totalStock;
  const color = chipColor ?? (displayTotal === 0 ? "error" : "default");
  if (displayTotal === 0 || locsWithStock.length === 0) {
    return <Chip label={`${displayTotal}`} size="small" color={displayTotal === 0 ? "error" : color} variant="outlined" />;
  }
  const clickProps = (locId: string) => onLocationClick ? {
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onLocationClick(locId); },
    sx: { cursor: "pointer", "&:hover": { borderColor: "primary.main" } },
  } : {};
  if (locsWithStock.length === 0 || locsWithStock.length > 5) {
    return (
      <Chip label={`${variant.totalStock}`} size="small" color={color} variant="outlined" />
    );
  }
  if (locsWithStock.length === 1) {
    return (
      <Chip label={`${locsWithStock[0].name}: ${variant.stockByLocation![locsWithStock[0].id]}`}
        size="small" color={color} variant="outlined" {...clickProps(locsWithStock[0].id)} />
    );
  }
  return (
    <Stack direction="row" spacing={0.25} flexWrap="wrap">
      {locsWithStock.map((loc) => (
        <Chip key={loc.id} label={`${loc.name}: ${variant.stockByLocation![loc.id]}`}
          size="small" color={color} variant="outlined" sx={{ fontSize: "0.65rem", height: 20, ...(onLocationClick ? { cursor: "pointer", "&:hover": { borderColor: "primary.main" } } : {}) }}
          {...(onLocationClick ? { onClick: (e: React.MouseEvent) => { e.stopPropagation(); onLocationClick(loc.id); } } : {})} />
      ))}
      {locsWithStock.length > 1 && (
        <Chip label={`Σ ${variant.totalStock}`} size="small" color={color} sx={{ fontSize: "0.65rem", height: 20 }} />
      )}
    </Stack>
  );
}

function VariantRows({
  productId,
  productName,
  product,
  showStock,
  hideZeroStock,
  quickAmounts,
  locations,
  variantLimit,
  variantSort,
  onSelect,
}: {
  productId: string;
  productName: string;
  product: { itemType: string; servicePricing: string | null; hourlyRate: string | null };
  showStock: boolean;
  hideZeroStock: boolean;
  quickAmounts?: number[];
  locations: { id: string; name: string }[];
  variantLimit?: number;
  variantSort?: "stockAsc";
  onSelect: ProductPickerSelectFn;
}) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useProduct(productId);
  const [showAll, setShowAll] = useState(false);

  if (isLoading) return <Box sx={{ p: 1.5 }}><CircularProgress size={16} /></Box>;
  if (!detail) return null;

  const filtered = detail.variants.filter((v) => v.isActive && (!hideZeroStock || v.totalStock > 0));
  const active = variantSort === "stockAsc"
    ? [...filtered].sort((a, b) => a.totalStock - b.totalStock)
    : sortVariants(filtered);

  if (active.length === 0 && hideZeroStock) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t("writeoffs.newPage.noStockAvailable")}
        </Typography>
      </Box>
    );
  }

  const visible = variantLimit && !showAll && active.length > variantLimit ? active.slice(0, variantLimit) : active;
  const hidden = active.length - visible.length;

  return (
    <Stack divider={<Divider />}>
      {visible.map((v) => {
        const label = v.isDefault
          ? productName
          : `${productName} — ${variantLabel(v.attributeValues)}`;
        const photoUrl = v.galleryPhotoUrl ?? v.photo ?? null;
        const colorHex = v.attributeValues.find((av) => av.colorHex)?.colorHex ?? null;
        return (
          <Stack
            key={v.id}
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ py: 0.75, px: 2, ...(!quickAmounts ? { cursor: "pointer", "&:hover": { bgcolor: "action.hover" } } : {}) }}
            onClick={!quickAmounts ? () => onSelect(v, label, product) : undefined}
          >
            {photoUrl && (
              <Box component="img" src={photoUrl}
                sx={{ width: 32, height: 32, borderRadius: "3px", objectFit: "cover" }} />
            )}
            {!photoUrl && colorHex && (
              <Box sx={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, bgcolor: colorHex }} />
            )}
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>
              {v.isDefault ? t("variants.default") : variantLabel(v.attributeValues)}
            </Typography>
            {showStock && (
              <StockChips variant={v} locations={locations} />
            )}
            {quickAmounts ? (
              <Stack direction="row" spacing={0.5}>
                {quickAmounts.map((n) => (
                  <Button key={n} size="small" variant="outlined" sx={{ minWidth: 36, px: 0.5 }}
                    onClick={() => onSelect(v, label, product, n)}>+{n}</Button>
                ))}
              </Stack>
            ) : (
              <Typography variant="caption" color="primary">{t("common.add")}</Typography>
            )}
          </Stack>
        );
      })}
      {hidden > 0 && (
        <Button size="small" sx={{ mx: 2, my: 0.5, alignSelf: "flex-start", textTransform: "none" }}
          onClick={() => setShowAll(true)}>
          +{hidden} more
        </Button>
      )}
    </Stack>
  );
}

// ─── Single product row (handles single- and multi-variant) ──────────────────

function ProductRow({
  product,
  showStock,
  hideZeroStock,
  quickAmounts,
  locations,
  autoExpandThreshold,
  variantLimit,
  variantSort,
  onSelect,
  onLocationStockClick,
}: {
  product: Product;
  showStock: boolean;
  hideZeroStock: boolean;
  quickAmounts?: number[];
  locations: { id: string; name: string }[];
  autoExpandThreshold?: number;
  variantLimit?: number;
  variantSort?: "stockAsc";
  onSelect: ProductPickerSelectFn;
  onLocationStockClick?: (product: Product, locationId: string, variants: ProductVariant[]) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(
    !!(autoExpandThreshold && product.variantCount > 1 && product.variantCount <= autoExpandThreshold)
  );
  const { data: detail } = useProduct(product.id);
  const isSingle = product.variantCount <= 1;
  const productMeta = {
    itemType: product.itemType,
    servicePricing: product.servicePricing,
    hourlyRate: product.hourlyRate,
  };

  const handleSingleClick = (qty?: number) => {
    const v = detail?.variants.find((v) => v.isActive && (!hideZeroStock || v.totalStock > 0));
    if (v) onSelect(v, product.name, productMeta, qty);
  };

  return (
    <Paper variant="outlined">
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ p: 1.5, ...(!(isSingle && quickAmounts) ? { cursor: "pointer", "&:hover": { bgcolor: "action.hover" } } : {}) }}
        onClick={isSingle && !quickAmounts ? () => handleSingleClick() : !isSingle ? () => setOpen((v) => !v) : undefined}
      >
        {product.primaryPhoto ? (
          <Box component="img" src={product.primaryPhoto}
            sx={{ width: 48, height: 48, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <Box sx={{ width: 48, height: 48, bgcolor: "grey.100", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <InventoryIcon sx={{ fontSize: 24, color: "grey.400" }} />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap fontWeight="medium">{product.name}</Typography>
          {product.categoryNames?.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.25} sx={{ mt: 0.25 }}>
              {product.categoryNames.map((n) => (
                <Chip key={n} label={n} size="small" variant="outlined" sx={{ height: 16, fontSize: "0.6rem" }} />
              ))}
            </Stack>
          )}
        </Box>
        {showStock && (() => {
          // Aggregate stockByLocation across all active variants
          const activeVars = detail?.variants.filter((v) => v.isActive) ?? [];
          if (activeVars.length > 0 && activeVars.some((v) => v.stockByLocation)) {
            const aggregated: Record<string, number> = {};
            for (const v of activeVars) {
              for (const [locId, qty] of Object.entries(v.stockByLocation ?? {})) {
                aggregated[locId] = (aggregated[locId] ?? 0) + qty;
              }
            }
            return <StockChips variant={{ totalStock: product.totalStock, stockByLocation: aggregated }} locations={locations} onLocationClick={onLocationStockClick ? (locId) => onLocationStockClick(product, locId, activeVars) : undefined} />;
          }
          return <Chip label={`${product.totalStock}`} size="small" variant="outlined" />;
        })()}
        {!isSingle && (
          <>
            <Chip label={t("production.variants", { count: product.variantCount })} size="small" variant="outlined" />
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
              {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </>
        )}
        {isSingle && quickAmounts ? (
          <Stack direction="row" spacing={0.5}>
            {quickAmounts.map((n) => (
              <Button key={n} size="small" variant="outlined" sx={{ minWidth: 36, px: 0.5 }}
                onClick={(e) => { e.stopPropagation(); handleSingleClick(n); }}>+{n}</Button>
            ))}
          </Stack>
        ) : isSingle ? (
          <Typography variant="caption" color="primary">{t("common.add")} →</Typography>
        ) : null}
      </Stack>
      {!isSingle && (
        <Collapse in={open}>
          <Divider />
          <VariantRows
            productId={product.id}
            productName={product.name}
            product={productMeta}
            showStock={showStock}
            hideZeroStock={hideZeroStock}
            quickAmounts={quickAmounts}
            locations={locations}
            variantLimit={variantLimit}
            variantSort={variantSort}
            onSelect={onSelect}
          />
        </Collapse>
      )}
    </Paper>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface ProductPickerPanelProps {
  onSelect: ProductPickerSelectFn;
  /** Extra params forwarded to useProducts (e.g. item_type, has_stock) */
  queryParams?: Record<string, unknown>;
  /** Show stock count chips on product/variant rows */
  showStock?: boolean;
  /** Hide variants with zero stock from expanded variant lists */
  hideZeroStock?: boolean;
  /** Show quick-add buttons (e.g. [1, 5, 10]) instead of click-to-add */
  quickAmounts?: number[];
  /** Auto-expand multi-variant products with ≤ this many variants */
  autoExpandThreshold?: number;
  /** Show "more" button after this many variants in expanded list */
  variantLimit?: number;
  /** Sort variants inside expanded rows */
  variantSort?: "stockAsc";
  /** Additional client-side filter applied after category filtering */
  filterFn?: (product: Product) => boolean;
  autoFocus?: boolean;
  /** Message when the product list is empty (no results at all) */
  emptyMessage?: string;
  /** Message when category filter reduces the list to zero */
  noMatchMessage?: string;
  /** Called when a location stock chip is clicked (e.g. transfer: add all variants from this location) */
  onLocationStockClick?: (product: Product, locationId: string, variants: ProductVariant[]) => void;
}

export default function ProductPickerPanel({
  onSelect,
  queryParams = {},
  showStock = false,
  hideZeroStock = false,
  quickAmounts,
  autoExpandThreshold,
  variantLimit,
  variantSort,
  filterFn,
  autoFocus = false,
  emptyMessage,
  noMatchMessage,
  onLocationStockClick,
}: ProductPickerPanelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [catMode, setCatMode] = useState<"or" | "and">("or");

  const { data: productsData, isLoading } = useProducts({
    search: search || undefined,
    is_active: true,
    ...queryParams,
  });
  const { data: categories } = useCategories();
  const { data: allLocations } = useLocations();
  const locations = (allLocations ?? []).filter((l) => l.isActive).map((l) => ({ id: l.id, name: l.name }));

  const allProducts = productsData?.results ?? [];
  const products = allProducts.filter((p) => {
    if (selectedCategories.length > 0) {
      const catMatch = catMode === "or"
        ? selectedCategories.some((id) => p.categories.includes(id))
        : selectedCategories.every((id) => p.categories.includes(id));
      if (!catMatch) return false;
    }
    if (filterFn && !filterFn(p)) return false;
    return true;
  });

  return (
    <Stack spacing={1}>
      <TextField
        placeholder={t("catalog.searchProducts")}
        size="small"
        fullWidth
        autoFocus={autoFocus}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{
          input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
        }}
      />

      {categories && categories.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
          <Typography variant="caption" color="text.secondary">{t("common.tags")}</Typography>
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              size="small"
              onClick={() => setSelectedCategories((prev) =>
                prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
              )}
              color={selectedCategories.includes(c.id) ? "primary" : "default"}
              variant={selectedCategories.includes(c.id) ? "filled" : "outlined"}
            />
          ))}
          {selectedCategories.length > 1 && (
            <Chip
              label={catMode === "or" ? "OR" : "AND"}
              size="small"
              color="secondary"
              variant="outlined"
              onClick={() => setCatMode((m) => m === "or" ? "and" : "or")}
              title={t("catalog.tagOrAndTitle")}
            />
          )}
          {selectedCategories.length > 0 && (
            <Chip label="×" size="small" onClick={() => setSelectedCategories([])} />
          )}
        </Stack>
      )}

      {isLoading && <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>}
      {!isLoading && products.length === 0 && (emptyMessage || noMatchMessage) && (
        <Typography color="text.secondary" variant="body2">
          {allProducts.length === 0 ? (emptyMessage ?? "") : (noMatchMessage ?? emptyMessage ?? "")}
        </Typography>
      )}

      <Stack spacing={0.75}>
        {products.map((p) => (
          <ProductRow key={p.id} product={p} showStock={showStock} hideZeroStock={hideZeroStock} quickAmounts={quickAmounts} locations={locations} autoExpandThreshold={autoExpandThreshold} variantLimit={variantLimit} variantSort={variantSort} onSelect={onSelect} onLocationStockClick={onLocationStockClick} />
        ))}
      </Stack>
    </Stack>
  );
}
