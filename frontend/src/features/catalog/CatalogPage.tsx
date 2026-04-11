import { useState, createContext, useContext } from "react";
import {
  Box, Button, Chip, CircularProgress, Collapse, Divider,
  FormControl, IconButton, InputAdornment, InputLabel, MenuItem,
  Paper, Select, Stack, TextField, Tooltip, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import { AddStockDialog } from "../../components/AddStockDialog";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import InventoryIcon from "@mui/icons-material/Inventory2";
import ArchiveIcon from "@mui/icons-material/Archive";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  useProducts, useProduct, useCreateProduct, useCategories, useCreateCategory,
  useQuickSell, useWarehouseSettings, useLocations,
} from "../../api/hooks";
import { StockChips } from "../../components/ProductPickerPanel";
import type { Product, ProductVariant, ProductCreate, ProductCostWrite } from "../../types/api";
import CostFields from "../../components/CostFields";
import MathTextField from "../../components/MathTextField";
import { useTranslation } from "react-i18next";

// ─── Catalog display preferences context ──────────────────────────────────────

const CatalogPrefsContext = createContext({ showSku: false });

import { variantLabel, sortVariants } from "../../utils/variantLabel";
import { intQtyInputProps } from "../../utils/form";
import { navLinkProps } from "../../utils/navLink";

// ─── Quick sell dialog ────────────────────────────────────────────────────────

function QuickSellDialog({
  variant,
  productName,
  open,
  onClose,
}: {
  variant: ProductVariant;
  productName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const quickSell = useQuickSell();
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(variant.effectivePrice);
  const label = variantLabel(variant.attributeValues) || productName;

  const handleSubmit = async () => {
    await quickSell.mutateAsync({
      variantId: variant.id,
      description: label,
      quantity: String(qty),
      unitPrice: price,
    });
    toast.success(t("catalog.quickSellDialog.sold", { qty, label }));
    setQty(1);
    setPrice(variant.effectivePrice);
    onClose();
  };

  const isPending = quickSell.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("catalog.quickSellDialog.title", { label })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t("catalog.quickSellDialog.description")}
          </Typography>
          <TextField
            label={t("common.quantity")}
            type="number"
            size="small"
            fullWidth
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            slotProps={{ htmlInput: { ...intQtyInputProps, min: 1, max: variant.totalStock } }}
            helperText={t("catalog.quickSellDialog.inStock", { count: variant.totalStock })}
          />
          <TextField
            label={t("catalog.quickSellDialog.unitPrice")}
            type="number"
            size="small"
            fullWidth
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
          />
          <Typography variant="body2" color="text.secondary">
            {t("catalog.quickSellDialog.total", { amount: (qty * parseFloat(price || "0")).toFixed(2) })}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleSubmit}
          disabled={qty <= 0 || isPending}
          startIcon={isPending ? <CircularProgress size={16} /> : <ShoppingCartIcon />}
        >
          {t("catalog.quickSellDialog.sell")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function VariantActions({
  variant,
  productName,
  isService,
}: {
  variant: ProductVariant;
  productName: string;
  isService?: boolean;
}) {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  return (
    <>
      <Stack direction="row" spacing={0.5}>
        {!isService && (
          <Tooltip title={t("catalog.addStockTooltip")}>
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => { e.stopPropagation(); setAddOpen(true); }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={t("catalog.quickSell")}>
          <IconButton
            size="small"
            color="success"
            onClick={(e) => { e.stopPropagation(); setSellOpen(true); }}
            disabled={!isService && variant.totalStock === 0}
          >
            <ShoppingCartIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {!isService && (
        <AddStockDialog
          variant={variant}
          productName={productName}
          open={addOpen}
          onClose={() => setAddOpen(false)}
        />
      )}
      <QuickSellDialog
        variant={variant}
        productName={productName}
        open={sellOpen}
        onClose={() => setSellOpen(false)}
      />
    </>
  );
}

// ─── Expanded variant rows ────────────────────────────────────────────────────

const CATALOG_VARIANT_LIMIT = 5;

function ProductVariantStock({ productId, productName, isService }: { productId: string; productName: string; isService?: boolean }) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useProduct(productId);
  const { data: allLocs } = useLocations();
  const locations = (allLocs ?? []).filter((l: { isActive: boolean }) => l.isActive).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }));
  const { showSku } = useContext(CatalogPrefsContext);
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) return <Box sx={{ p: 1.5 }}><CircularProgress size={16} /></Box>;
  if (!detail) return null;

  const activeVariants = sortVariants(detail.variants.filter((v) => v.isActive));
  const isMulti = activeVariants.length > 1 || !activeVariants[0]?.isDefault;
  const visible = showAll || activeVariants.length <= CATALOG_VARIANT_LIMIT
    ? activeVariants
    : activeVariants.slice(0, CATALOG_VARIANT_LIMIT);
  const hidden = activeVariants.length - visible.length;

  return (
    <Stack divider={<Divider />}>
      {visible.map((v) => {
        const label = isMulti
          ? (variantLabel(v.attributeValues) || t("common.default"))
          : productName;
        const photoUrl = v.galleryPhotoUrl ?? v.photo ?? null;
        const colorHex = v.attributeValues.find((av) => av.colorHex)?.colorHex ?? null;
        const deltaNum = parseFloat(v.priceDelta);

        return (
          <Stack
            key={v.id}
            direction="row"
            alignItems="center"
            spacing={1.5}
            {...navLinkProps(`/catalog/${productId}`, navigate)}
            sx={{ px: 2, py: 0.75, cursor: "pointer", "&:hover": { bgcolor: "action.hover" }, textDecoration: "none", color: "inherit" }}
          >
            {/* Photo / swatch */}
            <Box sx={{ width: 28, flexShrink: 0 }}>
              {photoUrl
                ? <Box component="img" src={photoUrl} sx={{ width: 32, height: 32, borderRadius: "3px", objectFit: "cover" }} />
                : colorHex
                  ? <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: colorHex, border: "1px solid", borderColor: "divider" }} />
                  : null}
            </Box>

            {/* Label + SKU */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap>{label}</Typography>
              {showSku && v.sku && (
                <Typography variant="caption" color="text.secondary">{t("variants.sku", { sku: v.sku })}</Typography>
              )}
            </Box>

            {/* Stock (physical only) */}
            {!isService && <StockChips variant={v} locations={locations} />}

            {/* Price */}
            <Stack alignItems="flex-end" sx={{ minWidth: 64 }}>
              <Typography variant="body2">€{v.effectivePrice}</Typography>
              {deltaNum !== 0 && (
                <Typography variant="caption" color={deltaNum > 0 ? "warning.main" : "success.main"}>
                  {deltaNum > 0 ? "+" : ""}€{deltaNum.toFixed(2)}
                </Typography>
              )}
            </Stack>

            {/* Actions (stop propagation so clicks don't navigate) */}
            <Box onClick={(e) => e.stopPropagation()}>
              <VariantActions variant={v} productName={productName} isService={isService} />
            </Box>
          </Stack>
        );
      })}
      {hidden > 0 && (
        <Button
          size="small"
          sx={{ mx: 2, my: 0.5, alignSelf: "flex-start", textTransform: "none", color: "text.secondary" }}
          onClick={() => setShowAll(true)}
        >
          +{hidden} {t("catalog.moreVariants", { count: hidden })}
        </Button>
      )}
    </Stack>
  );
}

// ─── Product list row ─────────────────────────────────────────────────────────

function ProductRow({ product }: { product: Product }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const stockColor = product.totalStock === 0 ? "error" : product.totalStock < 5 ? "warning" : "success";
  const isPhysical = product.itemType === "physical";
  const isSingleVariant = product.variantCount <= 1;

  // For single-variant quick actions we need the variant from detail
  const { data: detail } = useProduct(product.id);
  const { data: allLocations } = useLocations();
  const locations = (allLocations ?? []).filter((l: { isActive: boolean }) => l.isActive).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }));
  const singleVariant = isSingleVariant ? detail?.variants.find((v) => v.isActive) : undefined;

  const handleRowClick = () => {
    if (isSingleVariant) {
      navigate(`/catalog/${product.id}`);
    } else {
      setOpen((v) => !v);
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{ opacity: product.isActive ? 1 : 0.65, mb: 0.5, overflow: "hidden" }}
    >
      <Stack direction="row" alignItems="stretch" sx={{ minHeight: 68 }}>
        {/* ── Hoverable clickable zone: photo + name + price + stock ── */}
        <Stack
          component="a"
          href={`/catalog/${product.id}`}
          direction="row"
          alignItems="center"
          spacing={0}
          sx={{ flex: 1, cursor: "pointer", "&:hover": { bgcolor: "action.hover" }, minWidth: 0, textDecoration: "none", color: "inherit" }}
          onClick={(e: React.MouseEvent) => {
            if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
              e.preventDefault();
              handleRowClick();
            }
          }}
        >
          {/* Photo + name */}
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, px: 1.5, py: 1, minWidth: 0 }}>
            {product.primaryPhoto ? (
              <Box
                component="img"
                src={product.primaryPhoto}
                sx={{ width: 52, height: 52, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <Box sx={{
                width: 52, height: 52, bgcolor: "grey.100", borderRadius: "4px",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <InventoryIcon sx={{ fontSize: 22, color: "grey.300" }} />
              </Box>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                <Typography
                  fontWeight="bold" noWrap
                  sx={{ fontSize: "0.9rem" }}
                >
                  {product.name}
                </Typography>
                {!product.isActive && <ArchiveIcon sx={{ fontSize: 14 }} color="disabled" />}
                {!isPhysical && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic", flexShrink: 0 }}>
                    {t("common.service")}
                  </Typography>
                )}
              </Stack>
              {product.categoryNames.length > 0 && (
                <Stack direction="row" flexWrap="wrap" gap={0.4}>
                  {product.categoryNames.map((n) => (
                    <Chip
                      key={n} label={n} size="small"
                      sx={{
                        height: 16, fontSize: "0.6rem",
                        bgcolor: "grey.100", color: "text.secondary",
                        border: "none",
                        "& .MuiChip-label": { px: 0.75 },
                      }}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>

          {/* Stock — per-location for physical, empty for services */}
          <Stack alignItems="flex-end" justifyContent="center" sx={{ minWidth: 52, flexShrink: 0, py: 1 }}>
            {isPhysical && (() => {
              const activeVars = detail?.variants.filter((v) => v.isActive) ?? [];
              if (activeVars.length > 0 && activeVars.some((v) => v.stockByLocation)) {
                const aggregated: Record<string, number> = {};
                for (const v of activeVars) {
                  for (const [locId, qty] of Object.entries(v.stockByLocation ?? {})) {
                    aggregated[locId] = (aggregated[locId] ?? 0) + qty;
                  }
                }
                return <StockChips variant={{ totalStock: product.totalStock, stockByLocation: aggregated }} locations={locations} />;
              }
              return <Chip label={product.totalStock} size="small" color={stockColor} variant="outlined" sx={{ minWidth: 36 }} />;
            })()}
          </Stack>

          {/* Price — fixed width column, right next to divider */}
          <Stack alignItems="flex-end" justifyContent="center" sx={{ width: 80, flexShrink: 0, pr: 1.5, py: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              €{product.basePrice}
            </Typography>
          </Stack>
        </Stack>

        {/* ── Action column — fixed width so divider is always at the same position ── */}
        <Divider orientation="vertical" flexItem />
        <Box
          sx={{ width: 76, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.stopPropagation()}
        >
          {isSingleVariant && singleVariant && (
            <VariantActions variant={singleVariant} productName={product.name} isService={!isPhysical} />
          )}
          {!isSingleVariant && (
            <Stack direction="row" alignItems="center" sx={{ width: "100%", justifyContent: "flex-end", pr: 0.5 }}>
              <Tooltip title={t("catalog.openProductPage")}>
                <IconButton
                  size="small"
                  {...navLinkProps(`/catalog/${product.id}`, navigate)}
                  sx={{ color: "text.secondary" }}
                >
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Stack
                alignItems="center"
                justifyContent="center"
                spacing={0.25}
                sx={{
                  width: 36, flexShrink: 0, cursor: "pointer", py: 0.5,
                  "&:hover": { bgcolor: "action.hover" },
                }}
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
                  {product.variantCount}
                </Typography>
                {open
                  ? <ExpandLessIcon fontSize="small" color="action" />
                  : <ExpandMoreIcon fontSize="small" color="action" />}
              </Stack>
            </Stack>
          )}
          {/* single service: no actions, column stays empty */}
        </Box>
      </Stack>

      {/* ── Expanded variant rows ── */}
      {!isSingleVariant && (
        <Collapse in={open}>
          <Divider />
          <ProductVariantStock productId={product.id} productName={product.name} isService={!isPhysical} />
        </Collapse>
      )}
    </Paper>
  );
}

// ─── Column header row ────────────────────────────────────────────────────────

function CatalogHeader() {
  const { t } = useTranslation();
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{ px: 1.5, pb: 0.5, borderBottom: "1px solid", borderColor: "divider" }}
    >
      <Box sx={{ width: 64, flexShrink: 0 }} />{/* photo (52) + gap (12) */}
      <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
        {t("catalog.product")}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ width: 52, textAlign: "center", flexShrink: 0 }}>
        {t("catalog.stock")}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ width: 80, textAlign: "right", pr: 1.5, flexShrink: 0 }}>
        {t("catalog.price")}
      </Typography>
      <Box sx={{ width: 77, flexShrink: 0 }} />{/* divider (1px) + actions (76) */}
    </Stack>
  );
}

// ─── Create product dialog ────────────────────────────────────────────────────

type CreateForm = {
  name: string;
  itemType: string;
  basePrice: string;
  baseWeight: string | null;
  categories: string[];
  cost: ProductCostWrite | null;
};

function CreateProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: categories } = useCategories();
  const { data: wSettings } = useWarehouseSettings();
  const createProduct = useCreateProduct();
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateForm>({
    name: "", itemType: "physical", basePrice: "0.00", baseWeight: null as string | null, categories: [], cost: null,
  });

  const handleSubmit = async () => {
    const payload: ProductCreate = {
      name: form.name,
      itemType: form.itemType as "physical" | "service",
      basePrice: form.basePrice,
      categories: form.categories,
      description: "",
      isActive: true,
      servicePricing: null,
      hourlyRate: null,
      lowStockThreshold: null,
      baseWeight: form.baseWeight,
    };
    const result = await createProduct.mutateAsync(
      form.cost ? { ...payload, cost: form.cost } as Parameters<typeof createProduct.mutateAsync>[0] : payload
    );
    setForm({ name: "", itemType: "physical", basePrice: "0.00", baseWeight: null, categories: [], cost: null });
    onClose();
    navigate(`/catalog/${result.id}`);
  };

  const toggleCategory = (id: string) =>
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id],
    }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("catalog.newProductDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label={t("common.name")} fullWidth value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          <FormControl fullWidth>
            <InputLabel>{t("catalog.newProductDialog.typePlaceholder")}</InputLabel>
            <Select label={t("catalog.newProductDialog.typePlaceholder")} value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value })}>
              <MenuItem value="physical">{t("catalog.newProductDialog.physicalHasStock")}</MenuItem>
              <MenuItem value="service">{t("catalog.newProductDialog.service")}</MenuItem>
            </Select>
          </FormControl>
          <MathTextField label={t("catalog.newProductDialog.basePrice")} fullWidth size="small" value={form.basePrice}
            onChange={(v) => setForm({ ...form, basePrice: v })} />

          {categories && categories.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                {t("catalog.newProductDialog.categoriesOptional")}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {categories.map((c) => (
                  <Chip key={c.id} label={c.name} size="small"
                    onClick={() => toggleCategory(c.id)}
                    color={form.categories.includes(c.id) ? "primary" : "default"}
                    variant={form.categories.includes(c.id) ? "filled" : "outlined"} />
                ))}
              </Stack>
            </Box>
          )}

          <CostFields cost={form.cost} onChange={(cost) => setForm({ ...form, cost })} defaultEnergyRate={wSettings?.defaultEnergyRate} weight={form.baseWeight} onWeightChange={(w) => setForm({ ...form, baseWeight: w })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!form.name || createProduct.isPending}>
          {t("common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Create category dialog ───────────────────────────────────────────────────

function CreateCategoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const createCategory = useCreateCategory();
  const [name, setName] = useState("");

  const handleSubmit = async () => {
    await createCategory.mutateAsync({ name });
    setName("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("catalog.newCategoryDialog.title")}</DialogTitle>
      <DialogContent>
        <TextField label={t("common.name")} fullWidth value={name}
          onChange={(e) => setName(e.target.value)} autoFocus sx={{ mt: 1 }}
          onKeyDown={(e) => { if (e.key === "Enter" && name) handleSubmit(); }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!name || createCategory.isPending}>
          {t("common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Catalog page ─────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  // item type: "physical" | "service" | null (null = show all)
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  // tags: 3 states per category — included, excluded, neither
  const [includedTags, setIncludedTags] = useState<string[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [catMode, setCatMode] = useState<"or" | "and">("or");
  // "active" = active only, "all" = both, "archived" = archived only
  const [archiveMode, setArchiveMode] = useState<"active" | "all" | "archived">("active");
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const { data: warehouseSettings } = useWarehouseSettings();
  const showSku = warehouseSettings?.showSku ?? false;

  const { data: categories } = useCategories();
  const { data: allLocations } = useLocations();
  const catalogLocations = (allLocations ?? []).filter((l: { isActive: boolean }) => l.isActive);
  const { data, isLoading } = useProducts({
    search: search || undefined,
    item_type: typeFilter ?? undefined,
    is_active: archiveMode === "active" ? true : archiveMode === "archived" ? false : undefined,
    stock_at_location: locationFilter ?? undefined,
  });

  // Cycle: unselected → included → excluded → unselected
  const cycleTag = (id: string) => {
    if (includedTags.includes(id)) {
      setIncludedTags((p) => p.filter((c) => c !== id));
      setExcludedTags((p) => [...p, id]);
    } else if (excludedTags.includes(id)) {
      setExcludedTags((p) => p.filter((c) => c !== id));
    } else {
      setIncludedTags((p) => [...p, id]);
    }
  };

  const clearTags = () => { setIncludedTags([]); setExcludedTags([]); };

  const products = data?.results?.filter((p) => {
    // Included tags (AND/OR)
    if (includedTags.length > 0) {
      if (catMode === "or" && !includedTags.some((id) => p.categories.includes(id))) return false;
      if (catMode === "and" && !includedTags.every((id) => p.categories.includes(id))) return false;
    }
    // Excluded tags
    if (excludedTags.some((id) => p.categories.includes(id))) return false;
    return true;
  }) ?? [];

  return (
    <CatalogPrefsContext.Provider value={{ showSku }}>
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" fontWeight="bold">{t("catalog.title")}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="outlined" size="small" color="success" startIcon={<AddIcon />} {...navLinkProps("/stock/add", navigate)}>
            {t("catalog.addStock")}
          </Button>
          <Button variant="outlined" size="small" onClick={() => setCatOpen(true)}>{t("catalog.addTag")}</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            {t("catalog.newProduct")}
          </Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Stack spacing={1}>
        <TextField
          placeholder={t("catalog.searchProducts")}
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          fullWidth
        />

        {/* Tag row: type chips + category chips + archived toggle */}
        <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
          {/* Type chips */}
          {["physical", "service"].map((type) => (
            <Chip
              key={type}
              label={type === "physical" ? t("catalog.physical") : t("catalog.service")}
              size="small"
              onClick={() => setTypeFilter((prev) => (prev === type ? null : type))}
              color={typeFilter === type ? "primary" : "default"}
              variant={typeFilter === type ? "filled" : "outlined"}
              sx={{ cursor: "pointer", textTransform: "capitalize" }}
            />
          ))}

          {/* Location chips */}
          {catalogLocations.length > 1 && catalogLocations.map((l: { id: string; name: string }) => (
            <Chip
              key={l.id}
              label={l.name}
              size="small"
              onClick={() => setLocationFilter((prev) => prev === l.id ? null : l.id)}
              color={locationFilter === l.id ? "info" : "default"}
              variant={locationFilter === l.id ? "filled" : "outlined"}
              sx={{ cursor: "pointer" }}
            />
          ))}

          {catalogLocations.length > 1 && <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />}

          {/* Category tag chips — 3 states */}
          {categories?.map((c) => {
            const isIncluded = includedTags.includes(c.id);
            const isExcluded = excludedTags.includes(c.id);
            return (
              <Chip
                key={c.id}
                label={isExcluded ? `−${c.name}` : c.name}
                size="small"
                onClick={() => cycleTag(c.id)}
                color={isIncluded ? "primary" : isExcluded ? "error" : "default"}
                variant={isIncluded || isExcluded ? "filled" : "outlined"}
                sx={{ cursor: "pointer" }}
                title={isIncluded ? t("catalog.includedClick") : isExcluded ? t("catalog.excludedClick") : "Click to include, double-click to exclude"}
              />
            );
          })}

          {/* AND/OR toggle (only when ≥2 included) */}
          {includedTags.length > 1 && (
            <Chip
              label={catMode === "or" ? "OR" : "AND"}
              size="small"
              color="secondary"
              variant="outlined"
              onClick={() => setCatMode((m) => m === "or" ? "and" : "or")}
              sx={{ cursor: "pointer" }}
              title={t("catalog.tagOrAndTitle")}
            />
          )}

          {/* Clear tag filters */}
          {(includedTags.length > 0 || excludedTags.length > 0) && (
            <Chip label="×" size="small" onClick={clearTags} title={t("catalog.clearTagFilters")} />
          )}

          {/* Archived toggle — visually separate from filter tags */}
          <Box
            onClick={() => setArchiveMode((m) => m === "active" ? "all" : m === "all" ? "archived" : "active")}
            sx={{
              ml: "auto",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 1,
              border: "1px solid",
              borderColor: archiveMode !== "active" ? "warning.main" : "divider",
              bgcolor: archiveMode !== "active" ? "warning.50" : "transparent",
              color: archiveMode !== "active" ? "warning.dark" : "text.secondary",
              fontSize: "0.7rem",
              userSelect: "none",
              "&:hover": { bgcolor: archiveMode !== "active" ? "warning.100" : "action.hover" },
            }}
          >
            <ArchiveIcon sx={{ fontSize: 12 }} />
            {archiveMode === "active" ? t("catalog.activeOnly") : archiveMode === "all" ? t("catalog.showingAll") : t("catalog.archivedOnly")}
          </Box>
        </Stack>
      </Stack>

      {isLoading && <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>}

      {!isLoading && products.length === 0 && (
        <Box sx={{ textAlign: "center", mt: 8 }}>
          <InventoryIcon sx={{ fontSize: 64, color: "grey.300" }} />
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {data?.results?.length === 0
              ? t("catalog.noProductsYet")
              : t("catalog.noProductsMatch")}
          </Typography>
        </Box>
      )}

      {products.length > 0 && (
        <Stack>
          <CatalogHeader />
          <Box sx={{ mt: 0.5 }}>
            {products.map((product) => <ProductRow key={product.id} product={product} />)}
          </Box>
        </Stack>
      )}

      <CreateProductDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <CreateCategoryDialog open={catOpen} onClose={() => setCatOpen(false)} />
    </Stack>
    </CatalogPrefsContext.Provider>
  );
}
