import { useState } from "react";
import {
  Box, Chip, CircularProgress, Collapse, Divider, IconButton,
  InputAdornment, Paper, Stack, TextField, Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InventoryIcon from "@mui/icons-material/Inventory2";
import SearchIcon from "@mui/icons-material/Search";
import { useProducts, useProduct, useCategories } from "../api/hooks";
import { variantLabel } from "../utils/variantLabel";
import type { Product, ProductVariant } from "../types/api";
import { useTranslation } from "react-i18next";

export type ProductPickerSelectFn = (
  variant: ProductVariant,
  label: string,
  product: { itemType: string; servicePricing: string | null; hourlyRate: string | null },
) => void;

// ─── Expanded variant list (inside a multi-variant product row) ───────────────

function VariantRows({
  productId,
  productName,
  product,
  showStock,
  onSelect,
}: {
  productId: string;
  productName: string;
  product: { itemType: string; servicePricing: string | null; hourlyRate: string | null };
  showStock: boolean;
  onSelect: ProductPickerSelectFn;
}) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useProduct(productId);

  if (isLoading) return <Box sx={{ p: 1.5 }}><CircularProgress size={16} /></Box>;
  if (!detail) return null;

  const active = detail.variants.filter((v) => v.isActive && (!showStock || v.totalStock > 0));

  if (active.length === 0 && showStock) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t("writeoffs.newPage.noStockAvailable")}
        </Typography>
      </Box>
    );
  }

  return (
    <Stack divider={<Divider />}>
      {active.map((v) => {
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
            sx={{ py: 0.75, px: 2, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
            onClick={() => onSelect(v, label, product)}
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
              <Chip
                label={t("writeoffs.newPage.inStock", { count: v.totalStock })}
                size="small"
                color="default"
                variant="outlined"
              />
            )}
            <Typography variant="caption" color="primary">{t("common.add")}</Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

// ─── Single product row (handles single- and multi-variant) ──────────────────

function ProductRow({
  product,
  showStock,
  onSelect,
}: {
  product: Product;
  showStock: boolean;
  onSelect: ProductPickerSelectFn;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: detail } = useProduct(product.id);
  const isSingle = product.variantCount <= 1;
  const productMeta = {
    itemType: product.itemType,
    servicePricing: product.servicePricing,
    hourlyRate: product.hourlyRate,
  };

  const handleSingleClick = () => {
    const v = detail?.variants.find((v) => v.isActive && (!showStock || v.totalStock > 0));
    if (v) onSelect(v, product.name, productMeta);
  };

  return (
    <Paper variant="outlined">
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ p: 1.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
        onClick={isSingle ? handleSingleClick : () => setOpen((v) => !v)}
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
        {showStock && (
          <Chip
            label={t("writeoffs.newPage.inStock", { count: product.totalStock })}
            size="small"
            variant="outlined"
          />
        )}
        {!isSingle && (
          <>
            <Chip label={t("production.variants", { count: product.variantCount })} size="small" variant="outlined" />
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
              {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </>
        )}
        {isSingle && (
          <Typography variant="caption" color="primary">{t("common.add")} →</Typography>
        )}
      </Stack>
      {!isSingle && (
        <Collapse in={open}>
          <Divider />
          <VariantRows
            productId={product.id}
            productName={product.name}
            product={productMeta}
            showStock={showStock}
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
  /** Show stock count chips and hide zero-stock variants */
  showStock?: boolean;
  /** Additional client-side filter applied after category filtering */
  filterFn?: (product: Product) => boolean;
  autoFocus?: boolean;
  /** Message when the product list is empty (no results at all) */
  emptyMessage?: string;
  /** Message when category filter reduces the list to zero */
  noMatchMessage?: string;
}

export default function ProductPickerPanel({
  onSelect,
  queryParams = {},
  showStock = false,
  filterFn,
  autoFocus = false,
  emptyMessage,
  noMatchMessage,
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
          <ProductRow key={p.id} product={p} showStock={showStock} onSelect={onSelect} />
        ))}
      </Stack>
    </Stack>
  );
}
