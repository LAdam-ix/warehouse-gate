import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Button, Chip, CircularProgress, Collapse, Divider,
  Grid, IconButton, InputAdornment, Paper, Stack, TextField, Typography,
  FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InventoryIcon from "@mui/icons-material/Inventory2";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { toast } from "react-toastify";
import { useProducts, useProduct, useLocations, useAddStock, useCategories, useCreateLocation } from "../../api/hooks";
import { variantLabel } from "../../utils/variantLabel";
import type { Product } from "../../types/api";
import { useTranslation } from "react-i18next";

const QUICK_AMOUNTS = [1, 5, 10, 50];

interface CartLine {
  id: string; // unique per line — same variant can appear multiple times for different locations
  variantId: string;
  variantLabel: string;
  quantity: number;
  locationId: string;
}

// ─── Quick-add buttons row for a single variant ───────────────────────────────

function VariantQuickAdd({
  variantId,
  variantLabel,
  totalStock,
  isLowStock,
  colorHex,
  photoUrl,
  label,
  onAdd,
}: {
  variantId: string;
  variantLabel: string;
  totalStock: number;
  isLowStock: boolean;
  colorHex?: string | null;
  photoUrl?: string | null;
  label: string;
  onAdd: (line: Omit<CartLine, "locationId">) => void;
}) {
  const { t } = useTranslation();
  const stockColor = totalStock === 0 ? "error" : isLowStock ? "warning" : "success";
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.75, px: 2 }}>
      {photoUrl && (
        <Box component="img" src={photoUrl} sx={{ width: 32, height: 32, borderRadius: "3px", objectFit: "cover" }} />
      )}
      {!photoUrl && colorHex && (
        <Box sx={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, bgcolor: colorHex }} />
      )}
      <Typography variant="body2" sx={{ flex: 1 }} noWrap>{label}</Typography>
      <Chip label={t("stock.addStockPage.inStock", { count: totalStock })} size="small" color={stockColor} variant="outlined" />
      <Stack direction="row" spacing={0.5}>
        {QUICK_AMOUNTS.map((n) => (
          <Button
            key={n}
            size="small"
            variant="outlined"
            sx={{ minWidth: 36, px: 0.5 }}
            onClick={() => onAdd({ id: crypto.randomUUID(), variantId, variantLabel, quantity: n })}
          >
            +{n}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}

// ─── Fetches product detail and renders variant rows ──────────────────────────

function VariantRows({
  productId,
  productName,
  onAdd,
}: {
  productId: string;
  productName: string;
  onAdd: (line: Omit<CartLine, "locationId">) => void;
}) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useProduct(productId);
  const [showAll, setShowAll] = useState(false);

  if (isLoading) return <Box sx={{ p: 1.5 }}><CircularProgress size={16} /></Box>;
  if (!detail) return null;

  const active = detail.variants.filter((v) => v.isActive);
  const visible = showAll || active.length <= 3 ? active : active.slice(0, 3);
  const hidden = active.length - visible.length;

  return (
    <Stack divider={<Divider />}>
      {visible.map((v) => {
        const vLabel = v.isDefault
          ? productName
          : `${productName} — ${variantLabel(v.attributeValues)}`;
        const rowLabel = v.isDefault ? t("variants.default") : variantLabel(v.attributeValues);
        const photoUrl = v.galleryPhotoUrl ?? v.photo ?? null;
        const colorHex = v.attributeValues.find((av) => av.colorHex)?.colorHex ?? null;

        return (
          <VariantQuickAdd
            key={v.id}
            variantId={v.id}
            variantLabel={vLabel}
            totalStock={v.totalStock}
            isLowStock={v.isLowStock}
            photoUrl={!photoUrl ? null : photoUrl}
            colorHex={!photoUrl ? colorHex : null}
            label={rowLabel}
            onAdd={onAdd}
          />
        );
      })}
      {hidden > 0 && (
        <Button
          size="small"
          sx={{ mx: 2, my: 0.5, alignSelf: "flex-start", textTransform: "none" }}
          onClick={() => setShowAll(true)}
        >
          {t(hidden > 1 ? "stock.addStockPage.moreVariants_other" : "stock.addStockPage.moreVariants_one", { count: hidden })}
        </Button>
      )}
    </Stack>
  );
}

// ─── Inline single-variant quick-add (no expand, fetches on mount) ────────────

function SingleVariantRow({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (line: Omit<CartLine, "locationId">) => void;
}) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useProduct(product.id);

  const v = detail?.variants.find((v) => v.isActive);
  const stockColor = (product.totalStock === 0) ? "error" : "default";

  return (
    <Paper variant="outlined">
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.5 }}>
        {product.primaryPhoto ? (
          <Box component="img" src={product.primaryPhoto}
            sx={{ width: 48, height: 48, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <Box sx={{ width: 48, height: 48, bgcolor: "grey.100", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <InventoryIcon sx={{ fontSize: 24, color: "grey.400" }} />
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

        {isLoading ? (
          <CircularProgress size={16} />
        ) : v ? (
          <>
            <Chip
              label={t("stock.addStockPage.inStock", { count: v.totalStock })}
              size="small"
              color={v.totalStock === 0 ? "error" : v.isLowStock ? "warning" : "success"}
              variant="outlined"
            />
            <Stack direction="row" spacing={0.5}>
              {QUICK_AMOUNTS.map((n) => (
                <Button
                  key={n}
                  size="small"
                  variant="outlined"
                  sx={{ minWidth: 36, px: 0.5 }}
                  onClick={() => onAdd({ id: crypto.randomUUID(), variantId: v.id, variantLabel: product.name, quantity: n })}
                >
                  +{n}
                </Button>
              ))}
            </Stack>
          </>
        ) : (
          <Chip label={t("stock.addStockPage.inStock", { count: product.totalStock })} size="small" color={stockColor} variant="outlined" />
        )}
      </Stack>
    </Paper>
  );
}

// ─── Multi-variant product row with expand ────────────────────────────────────

function MultiVariantRow({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (line: Omit<CartLine, "locationId">) => void;
}) {
  const { t } = useTranslation();
  // Auto-expand if ≤3 variants
  const [open, setOpen] = useState(product.variantCount <= 3);

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
            sx={{ width: 48, height: 48, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <Box sx={{ width: 48, height: 48, bgcolor: "grey.100", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <InventoryIcon sx={{ fontSize: 24, color: "grey.400" }} />
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
        <Chip
          label={t("stock.addStockPage.inStock", { count: product.totalStock })}
          size="small"
          color={product.totalStock === 0 ? "error" : "default"}
          variant="outlined"
        />
        <Chip label={t("stock.addStockPage.variants", { count: product.variantCount })} size="small" variant="outlined" />
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Stack>

      <Collapse in={open}>
        <Divider />
        <VariantRows productId={product.id} productName={product.name} onAdd={onAdd} />
      </Collapse>
    </Paper>
  );
}

// ─── Inline "add location" widget ────────────────────────────────────────────

function AddLocationButton({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = useCreateLocation();

  const handleCreate = async () => {
    if (!name.trim()) return;
    const loc = await create.mutateAsync({ name: name.trim(), description: "", isDefault: false, isActive: true });
    toast.success(t("settings.locations.locationCreatedName", { name: loc.name }));
    onCreated(loc.id);
    setName("");
    setOpen(false);
  };

  if (!open) {
    return (
      <IconButton size="small" onClick={() => setOpen(true)} title={t("stock.addStockPage.newLocation")}>
        <AddCircleOutlineIcon sx={{ fontSize: 16, color: "primary.main" }} />
      </IconButton>
    );
  }

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <TextField
        size="small"
        placeholder={t("stock.addStockPage.locationNamePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setOpen(false); }}
        autoFocus
        sx={{ width: 130, "& .MuiInputBase-root": { fontSize: "0.75rem" } }}
      />
      <Button size="small" onClick={handleCreate} disabled={!name.trim() || create.isPending}>{t("common.add")}</Button>
      <Button size="small" color="inherit" onClick={() => setOpen(false)}>✕</Button>
    </Stack>
  );
}

// ─── Add Stock page ───────────────────────────────────────────────────────────

export default function AddStockPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [catMode, setCatMode] = useState<"or" | "and">("or");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState("");
  const [note, setNote] = useState("");
  const [movementDate, setMovementDate] = useState(new Date().toISOString().slice(0, 16));

  const { data: productsData, isLoading } = useProducts({
    search: search || undefined,
    item_type: "physical",
    is_active: true,
  });
  const { data: categories } = useCategories();
  const { data: locations } = useLocations();
  const addStock = useAddStock();

  // Auto-select default location
  useEffect(() => {
    if (!defaultLocationId && locations && locations.length > 0) {
      const def = locations.find((l) => l.isDefault) ?? locations[0];
      setDefaultLocationId(def.id);
    }
  }, [locations, defaultLocationId]);

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

  const handleAdd = (line: Omit<CartLine, "id" | "locationId">) => {
    setCart((prev) => {
      // Merge into existing line only if same variant AND same location
      const idx = prev.findIndex(
        (l) => l.variantId === line.variantId && l.locationId === defaultLocationId
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity };
        return next;
      }
      return [...prev, { ...line, id: crypto.randomUUID(), locationId: defaultLocationId }];
    });
  };

  const updateLineLocation = (lineId: string, locationId: string) => {
    setCart((prev) => prev.map((l) => l.id === lineId ? { ...l, locationId } : l));
  };

  const adjustQty = (lineId: string, delta: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.id === lineId);
      if (idx < 0) return prev;
      const newQty = prev[idx].quantity + delta;
      if (newQty <= 0) return prev.filter((l) => l.id !== lineId);
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: newQty };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    await addStock.mutateAsync({
      lines: cart.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        locationId: l.locationId || undefined,
      })),
      note: note || undefined,
      movementDate: new Date(movementDate).toISOString(),
    });
    toast.success(t("stock.addStockPage.stockAdded", { count: cart.length }));
    navigate("/stock");
  };

  const totalUnits = cart.reduce((s, l) => s + l.quantity, 0);
  const showLocations = (locations?.length ?? 0) > 1;

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate("/stock")}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" fontWeight="bold" sx={{ flex: 1 }}>{t("stock.addStockPage.title")}</Typography>
      </Stack>

      <Grid container spacing={2}>
        {/* Left — product search */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={1.5}>
            <TextField
              placeholder={t("catalog.searchProducts")}
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              fullWidth
              autoFocus
            />

            {/* Category tag filter */}
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
              <Typography color="text.secondary" variant="body2">{t("common.noProductsFound")}</Typography>
            )}

            <Stack spacing={0.75}>
              {products.map((product) =>
                product.variantCount === 1 ? (
                  <SingleVariantRow key={product.id} product={product} onAdd={handleAdd} />
                ) : (
                  <MultiVariantRow key={product.id} product={product} onAdd={handleAdd} />
                )
              )}
            </Stack>
          </Stack>
        </Grid>

        {/* Right — cart */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper variant="outlined" sx={{ p: 2, position: "sticky", top: 16 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {t("stock.addStockPage.toAdd")}
              {totalUnits > 0 && <Chip label={t("stock.addStockPage.units", { count: totalUnits })} size="small" color="success" sx={{ ml: 1 }} />}
            </Typography>

            {cart.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("stock.addStockPage.clickToAdd")}
              </Typography>
            ) : (
              <Stack spacing={0.75} sx={{ mb: 2 }}>
                {cart.map((line) => (
                  <Stack key={line.id} direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                      {line.variantLabel}
                    </Typography>
                    {showLocations && (
                      <Select
                        size="small"
                        value={line.locationId}
                        onChange={(e) => updateLineLocation(line.id, e.target.value)}
                        sx={{ fontSize: "0.75rem", minWidth: 90, "& .MuiSelect-select": { py: 0.5 } }}
                      >
                        {locations!.map((l) => (
                          <MenuItem key={l.id} value={l.id} sx={{ fontSize: "0.75rem" }}>
                            {l.name}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                    <IconButton size="small" onClick={() => adjustQty(line.id, -1)}>
                      <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: "error.light" }} />
                    </IconButton>
                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 24, textAlign: "center" }}>
                      {line.quantity}
                    </Typography>
                    <IconButton size="small" onClick={() => adjustQty(line.id, 1)}>
                      <AddCircleOutlineIcon sx={{ fontSize: 18, color: "success.main" }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setCart((p) => p.filter((l) => l.id !== line.id))}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 1.5 }} />

            <Stack spacing={1.5}>
              {/* Location — always shown; when multiple locations this sets the default for new lines */}
              {locations && locations.length > 0 && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>{showLocations ? t("common.defaultLocation") : t("common.location")}</InputLabel>
                    <Select
                      label={showLocations ? t("common.defaultLocation") : t("common.location")}
                      value={defaultLocationId}
                      onChange={(e) => setDefaultLocationId(e.target.value)}
                    >
                      {locations.map((l) => (
                        <MenuItem key={l.id} value={l.id}>{l.name}{l.isDefault ? t("common.locationDefault") : ""}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <AddLocationButton onCreated={(id) => setDefaultLocationId(id)} />
                </Stack>
              )}
              <TextField
                label={t("common.date")}
                type="datetime-local"
                size="small"
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
                fullWidth
              />
              <TextField
                label={t("common.noteOptional")}
                size="small"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                fullWidth
                placeholder={t("stock.addStockPage.batchNotePlaceholder")}
              />
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckIcon />}
                onClick={handleSubmit}
                disabled={cart.length === 0 || addStock.isPending}
                fullWidth
              >
                {totalUnits !== 1
                  ? t("stock.addStockPage.confirmAdd_plural", { count: totalUnits })
                  : t("stock.addStockPage.confirmAdd", { count: totalUnits })}
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
