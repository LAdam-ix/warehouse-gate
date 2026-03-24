import { useState, useEffect } from "react";
import { variantLabel } from "../../utils/variantLabel";
import { useNavigate } from "react-router-dom";
import {
  Box, Button, Chip, CircularProgress, Collapse, Divider,
  FormControl, Grid, IconButton, InputAdornment, InputLabel,
  MenuItem, Paper, Select, Stack, TextField, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InventoryIcon from "@mui/icons-material/Inventory2";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import { toast } from "react-toastify";
import { useProducts, useProduct, useLocations, useCreateDamageReport, useCategories } from "../../api/hooks";
import type { Product, ProductVariant } from "../../types/api";
import { useTranslation } from "react-i18next";

// ─── Variant picker rows (lazy-fetched) ───────────────────────────────────────

function VariantPickerRows({
  productId,
  productName,
  onSelect,
}: {
  productId: string;
  productName: string;
  onSelect: (v: ProductVariant, label: string) => void;
}) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useProduct(productId);

  if (isLoading) return <Box sx={{ p: 1.5 }}><CircularProgress size={16} /></Box>;
  if (!detail) return null;

  const active = detail.variants.filter((v) => v.isActive && v.totalStock > 0);
  if (active.length === 0) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary">{t("writeoffs.newPage.noStockAvailable")}</Typography>
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
            onClick={() => onSelect(v, label)}
          >
            {photoUrl && (
              <Box component="img" src={photoUrl} sx={{ width: 28, height: 28, borderRadius: 0.5, objectFit: "cover" }} />
            )}
            {!photoUrl && colorHex && (
              <Box sx={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, bgcolor: colorHex }} />
            )}
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>
              {v.isDefault ? t("common.default") : variantLabel(v.attributeValues)}
            </Typography>
            <Chip label={t("writeoffs.newPage.inStock", { count: v.totalStock })} size="small" color="default" variant="outlined" />
            <Typography variant="caption" color="primary">{t("common.select")}</Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

// ─── Single-variant product row (inline select) ───────────────────────────────

function SingleVariantProductRow({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: (v: ProductVariant, label: string) => void;
}) {
  const { t } = useTranslation();
  const { data: detail } = useProduct(product.id);

  const handleClick = () => {
    const variant = detail?.variants.find((v) => v.isActive && v.totalStock > 0);
    if (variant) onSelect(variant, product.name);
  };

  return (
    <Paper variant="outlined">
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ p: 1.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
        onClick={handleClick}
      >
        {product.primaryPhoto ? (
          <Box component="img" src={product.primaryPhoto}
            sx={{ width: 40, height: 40, borderRadius: 1, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <Box sx={{ width: 40, height: 40, bgcolor: "grey.100", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <InventoryIcon sx={{ fontSize: 20, color: "grey.400" }} />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight="medium" noWrap>{product.name}</Typography>
          {product.categoryNames.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.25} sx={{ mt: 0.25 }}>
              {product.categoryNames.map((n) => (
                <Chip key={n} label={n} size="small" variant="outlined" sx={{ height: 16, fontSize: "0.6rem" }} />
              ))}
            </Stack>
          )}
        </Box>
        <Chip label={t("writeoffs.newPage.inStock", { count: product.totalStock })} size="small" variant="outlined" />
        <Typography variant="caption" color="primary">{t("common.select")}</Typography>
      </Stack>
    </Paper>
  );
}

// ─── Multi-variant product row ────────────────────────────────────────────────

function ProductRow({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: (v: ProductVariant, label: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (product.variantCount <= 1) {
    return <SingleVariantProductRow product={product} onSelect={onSelect} />;
  }

  return (
    <Paper variant="outlined">
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ p: 1.5, cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}
      >
        {product.primaryPhoto ? (
          <Box component="img" src={product.primaryPhoto}
            sx={{ width: 40, height: 40, borderRadius: 1, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <Box sx={{ width: 40, height: 40, bgcolor: "grey.100", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <InventoryIcon sx={{ fontSize: 20, color: "grey.400" }} />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight="medium" noWrap>{product.name}</Typography>
          {product.categoryNames.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.25} sx={{ mt: 0.25 }}>
              {product.categoryNames.map((n) => (
                <Chip key={n} label={n} size="small" variant="outlined" sx={{ height: 16, fontSize: "0.6rem" }} />
              ))}
            </Stack>
          )}
        </Box>
        <Chip label={`${product.totalStock} in stock`} size="small" variant="outlined" />
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Stack>

      <Collapse in={open}>
        <Divider />
        <VariantPickerRows productId={product.id} productName={product.name} onSelect={onSelect} />
      </Collapse>
    </Paper>
  );
}

// ─── Write-off new page ───────────────────────────────────────────────────────

export default function WriteOffNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [catMode, setCatMode] = useState<"or" | "and">("or");
  const [selected, setSelected] = useState<{ variant: ProductVariant; label: string } | null>(null);

  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [estimatedValueLost, setEstimatedValueLost] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 16));

  const { data: productsData, isLoading } = useProducts({
    search: search || undefined,
    item_type: "physical",
    is_active: true,
    has_stock: true,
  });
  const { data: categories } = useCategories();
  const { data: locations } = useLocations();
  const create = useCreateDamageReport();

  const REASONS = [
    t("writeoffs.newPage.reasons.printFailure"),
    t("writeoffs.newPage.reasons.damagedHandling"),
    t("writeoffs.newPage.reasons.lostMissing"),
    t("writeoffs.newPage.reasons.qualityReject"),
    t("writeoffs.newPage.reasons.expiredUnusable"),
    t("writeoffs.newPage.reasons.sampleGiveaway"),
    t("writeoffs.newPage.reasons.other"),
  ];

  // Auto-fill location when there's only one
  useEffect(() => {
    if (locations?.length === 1) setLocationId(locations[0].id);
  }, [locations]);

  const toggleCategory = (id: string) =>
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );

  const allProducts = productsData?.results ?? [];
  const products = allProducts.filter((p) => {
    if (selectedCategories.length === 0) return true;
    if (catMode === "or") return selectedCategories.some((id) => p.categories.includes(id));
    return selectedCategories.every((id) => p.categories.includes(id));
  });

  const handleSubmit = async () => {
    const finalReason = reason === t("writeoffs.newPage.reasons.other") ? customReason : reason;
    if (!selected || !locationId || !finalReason) {
      toast.error(t("writeoffs.newPage.fillRequired"));
      return;
    }
    await create.mutateAsync({
      variant: selected.variant.id,
      location: locationId,
      quantity: Number(quantity),
      reason: finalReason,
      estimatedValueLost: estimatedValueLost || undefined,
      reportDate: new Date(reportDate).toISOString(),
    });
    toast.success(t("writeoffs.newPage.recorded"));
    navigate("/writeoffs");
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate("/writeoffs")}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" fontWeight="bold" sx={{ flex: 1 }}>{t("writeoffs.newPage.title")}</Typography>
      </Stack>

      <Grid container spacing={2}>
        {/* Left — catalog picker */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={1.5}>
            <TextField
              placeholder={t("writeoffs.newPage.searchProducts")}
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              fullWidth
              autoFocus
            />

            {categories && categories.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
                <Typography variant="caption" color="text.secondary">{t("common.tags")}</Typography>
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    size="small"
                    onClick={() => toggleCategory(c.id)}
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
                    title="Click to toggle OR / AND logic"
                  />
                )}
                {selectedCategories.length > 0 && (
                  <Chip label="×" size="small" onClick={() => setSelectedCategories([])} />
                )}
              </Stack>
            )}

            {isLoading && <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>}
            {!isLoading && products.length === 0 && (
              <Typography color="text.secondary" variant="body2">
                {allProducts.length === 0 ? t("writeoffs.newPage.noPhysicalItems") : t("writeoffs.newPage.noProductsMatch")}
              </Typography>
            )}

            <Stack spacing={0.75}>
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onSelect={(v, label) => setSelected({ variant: v, label })}
                />
              ))}
            </Stack>
          </Stack>
        </Grid>

        {/* Right — form */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper variant="outlined" sx={{ p: 2, position: "sticky", top: 16 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>{t("writeoffs.newPage.writeOffDetails")}</Typography>

            {!selected ? (
              <Typography variant="body2" color="text.secondary">
                {t("writeoffs.newPage.selectVariant")}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "error.50" }}>
                  <Typography variant="body2" fontWeight="medium" noWrap>{selected.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selected.variant.totalStock} in stock · {selected.variant.sku || t("writeoffs.newPage.noSku")}
                  </Typography>
                  <Button
                    size="small"
                    sx={{ mt: 0.5, display: "block", p: 0, minWidth: 0, textTransform: "none" }}
                    onClick={() => setSelected(null)}
                  >
                    {t("writeoffs.newPage.change")}
                  </Button>
                </Paper>

                <Divider />

                {locations && locations.length > 0 && (
                  <FormControl size="small" fullWidth required>
                    <InputLabel>{t("writeoffs.newPage.locationRequired")}</InputLabel>
                    <Select label={t("writeoffs.newPage.locationRequired")} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                      {locations.map((l) => (
                        <MenuItem key={l.id} value={l.id}>{l.name}{l.isDefault ? t("common.locationDefault") : ""}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <TextField
                  label={t("writeoffs.newPage.quantityRequired")}
                  type="number"
                  size="small"
                  fullWidth
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  slotProps={{ htmlInput: { min: 1, max: selected.variant.totalStock } }}
                  helperText={t("writeoffs.newPage.maxQuantity", { max: selected.variant.totalStock })}
                />

                <FormControl size="small" fullWidth required>
                  <InputLabel>{t("writeoffs.newPage.reasonRequired")}</InputLabel>
                  <Select label={t("writeoffs.newPage.reasonRequired")} value={reason} onChange={(e) => setReason(e.target.value)}>
                    {REASONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                </FormControl>

                {reason === t("writeoffs.newPage.reasons.other") && (
                  <TextField
                    label={t("writeoffs.newPage.describeReason")}
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                  />
                )}

                <TextField
                  label={t("writeoffs.newPage.estimatedValueLost")}
                  type="number"
                  size="small"
                  fullWidth
                  value={estimatedValueLost}
                  onChange={(e) => setEstimatedValueLost(e.target.value)}
                  helperText={t("writeoffs.newPage.estimatedValueHelper")}
                  slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                />

                <TextField
                  label={t("writeoffs.newPage.date")}
                  type="datetime-local"
                  size="small"
                  fullWidth
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />

                <Button
                  variant="contained"
                  color="error"
                  startIcon={<CheckIcon />}
                  onClick={handleSubmit}
                  disabled={!locationId || !reason || create.isPending}
                  fullWidth
                >
                  {t("writeoffs.newPage.recordButton")}
                </Button>
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
