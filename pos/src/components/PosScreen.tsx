import { useState, useEffect, useCallback } from "react";
import {
  AppBar, Badge, Box, Button, Chip, Divider, IconButton, InputAdornment, MenuItem,
  Paper, Select, Stack, Tab, Tabs, TextField, Toolbar, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SyncIcon from "@mui/icons-material/Sync";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import HistoryIcon from "@mui/icons-material/History";
import CloseIcon from "@mui/icons-material/Close";
import {
  getCachedProducts, getLocalStock, deductLocalStock,
  addPendingSale, getPendingSales, removePendingSale, updatePendingSale,
  addPendingProduction, getPendingProductions, updatePendingProduction, removePendingProduction,
  type PosProduct, type PosVariant, type PosConfig, type PendingSale, type PendingProduction,
} from "../lib/db";
import { autoSync, pushPendingSales, pushPendingProductions, syncProducts } from "../lib/sync";
import { isOnline, fetchLocations, type ApiLocation } from "../lib/api";

// ─── Cart types ──────────────────────────────────────────────────────────────

interface CartLine {
  id: string;
  variantId: string;
  label: string;
  unitPrice: string;
  quantity: number;
  photo: string | null;
  discountAmount: string;
  discountNote: string;
}

// ─── Cart line row with tappable qty + collapsible discount ─────────────────

function CartLineRow({ line, setCart, adjustCartQty }: {
  line: CartLine;
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  adjustCartQty: (lineId: string, delta: number) => void;
}) {
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState("");
  const [discountOpen, setDiscountOpen] = useState(parseFloat(line.discountAmount || "0") > 0);

  const lineDiscount = parseFloat(line.discountAmount || "0");
  const lineTotal = (parseFloat(line.unitPrice) - lineDiscount) * line.quantity;

  const commitQty = () => {
    const n = parseInt(qtyInput);
    if (n > 0) {
      setCart((p) => p.map((l) => l.id === line.id ? { ...l, quantity: n } : l));
    } else if (n === 0 || qtyInput === "") {
      setCart((p) => p.filter((l) => l.id !== line.id));
    }
    setEditingQty(false);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap fontWeight="medium">{line.label}</Typography>
          <Typography variant="caption" color="text.secondary">
            €{line.unitPrice}{lineDiscount > 0 ? ` -€${line.discountAmount}` : ""} × {line.quantity} = €{lineTotal.toFixed(2)}
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => adjustCartQty(line.id, -1)}>
          <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: "error.light" }} />
        </IconButton>
        {editingQty ? (
          <TextField
            size="small"
            type="number"
            autoFocus
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            onBlur={commitQty}
            onKeyDown={(e) => { if (e.key === "Enter") commitQty(); }}
            sx={{ width: 44, "& .MuiInputBase-root": { height: 28, fontSize: "0.85rem" }, "& input": { textAlign: "center", p: 0.5 } }}
            slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
          />
        ) : (
          <Typography
            variant="body2" fontWeight="bold"
            sx={{ minWidth: 28, textAlign: "center", cursor: "pointer", userSelect: "none", bgcolor: "grey.100", borderRadius: 0.5, px: 0.5, py: 0.25 }}
            onClick={() => { setQtyInput(String(line.quantity)); setEditingQty(true); }}
          >
            {line.quantity}
          </Typography>
        )}
        <IconButton size="small" onClick={() => adjustCartQty(line.id, 1)}>
          <AddCircleOutlineIcon sx={{ fontSize: 18, color: "success.main" }} />
        </IconButton>
        <IconButton size="small" onClick={() => setCart((p) => p.filter((l) => l.id !== line.id))}>
          <DeleteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>
      {/* Collapsible discount */}
      {!discountOpen ? (
        <Typography
          variant="caption" color="primary" sx={{ cursor: "pointer", pl: 0.5, mt: 0.25, display: "block" }}
          onClick={() => setDiscountOpen(true)}
        >
          + Discount
        </Typography>
      ) : (
        <Stack direction="row" spacing={0.5} sx={{ pl: 0.5, mt: 0.5 }}>
          <TextField size="small" placeholder="€" type="number"
            value={line.discountAmount === "0" ? "" : line.discountAmount}
            onChange={(e) => setCart((p) => p.map((l) => l.id === line.id ? { ...l, discountAmount: e.target.value || "0" } : l))}
            sx={{ width: 70, "& .MuiInputBase-root": { height: 24, fontSize: "0.7rem" } }}
            slotProps={{ htmlInput: { step: "0.01", min: 0 } }}
          />
          <TextField size="small" placeholder="Note"
            value={line.discountNote}
            onChange={(e) => setCart((p) => p.map((l) => l.id === line.id ? { ...l, discountNote: e.target.value } : l))}
            sx={{ flex: 1, "& .MuiInputBase-root": { height: 24, fontSize: "0.7rem" } }}
          />
          <IconButton size="small" onClick={() => {
            setCart((p) => p.map((l) => l.id === line.id ? { ...l, discountAmount: "0", discountNote: "" } : l));
            setDiscountOpen(false);
          }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
}

// ─── Pending production row with editable qty ───────────────────────────────

function PendingProductionRow({ req, onUpdate, onDelete }: {
  req: PendingProduction;
  onUpdate: (updated: PendingProduction) => void;
  onDelete: () => void;
}) {
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState("");

  const adjustQty = (delta: number) => {
    const newQty = req.quantity + delta;
    if (newQty <= 0) { onDelete(); return; }
    onUpdate({ ...req, quantity: newQty });
  };

  const commitQty = () => {
    const n = parseInt(qtyInput);
    if (n > 0) { onUpdate({ ...req, quantity: n }); }
    else { onDelete(); }
    setEditingQty(false);
  };

  return (
    <Paper variant="outlined" sx={{ p: 1, borderColor: "info.light" }}>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight="medium" noWrap>{req.description}</Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(req.deviceCreatedAt).toLocaleTimeString()}
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => adjustQty(-1)}>
          <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: "error.light" }} />
        </IconButton>
        {editingQty ? (
          <TextField size="small" type="number" autoFocus value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            onBlur={commitQty}
            onKeyDown={(e) => { if (e.key === "Enter") commitQty(); }}
            sx={{ width: 44, "& .MuiInputBase-root": { height: 28, fontSize: "0.85rem" }, "& input": { textAlign: "center", p: 0.5 } }}
            slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
          />
        ) : (
          <Typography variant="body2" fontWeight="bold"
            sx={{ minWidth: 28, textAlign: "center", cursor: "pointer", bgcolor: "grey.100", borderRadius: 0.5, px: 0.5, py: 0.25 }}
            onClick={() => { setQtyInput(String(req.quantity)); setEditingQty(true); }}>
            {req.quantity}
          </Typography>
        )}
        <IconButton size="small" onClick={() => adjustQty(1)}>
          <AddCircleOutlineIcon sx={{ fontSize: 18, color: "success.main" }} />
        </IconButton>
        <IconButton size="small" onClick={onDelete}>
          <DeleteIcon sx={{ fontSize: 16, color: "error.main" }} />
        </IconButton>
      </Stack>
    </Paper>
  );
}

// ─── Main POS screen ─────────────────────────────────────────────────────────

export default function PosScreen({ config, onReset }: { config: PosConfig; onReset: () => void }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saleDiscountPct, setSaleDiscountPct] = useState("");
  const [saleDiscountFixed, setSaleDiscountFixed] = useState("");
  const [saleNote, setSaleNote] = useState("");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [viewLocationId, setViewLocationId] = useState(config.locationId);
  const [allLocations, setAllLocations] = useState<ApiLocation[]>([]);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [editingSale, setEditingSale] = useState<PendingSale | null>(null);
  const [pendingProductions, setPendingProductions] = useState<PendingProduction[]>([]);
  const [prodSearch, setProdSearch] = useState("");
  const [pushingProd, setPushingProd] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const refreshPending = useCallback(async () => {
    const sales = await getPendingSales();
    setPendingSales(sales);
  }, []);

  // Load cached data on mount
  useEffect(() => {
    getCachedProducts().then(setProducts);
    getLocalStock().then(setStock);
    refreshPending();
    getPendingProductions().then(setPendingProductions);
    fetchLocations().then(setAllLocations).catch(() => {});
  }, [refreshPending]);

  // Auto-sync products only (not sales)
  const handleProductSync = useCallback(async () => {
    setSyncing(true);
    try {
      await autoSync();
      setProducts(await getCachedProducts());
      setStock(await getLocalStock());
    } catch { /* offline */ }
    setSyncing(false);
  }, []);

  useEffect(() => {
    handleProductSync();
    const interval = setInterval(handleProductSync, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [handleProductSync]);

  // Manual push sales
  const handlePushSales = async () => {
    const online = await isOnline();
    if (!online) return;
    setPushing(true);
    await pushPendingSales();
    // Re-sync products to get fresh stock numbers
    try { await syncProducts(); } catch { /* */ }
    setProducts(await getCachedProducts());
    setStock(await getLocalStock());
    await refreshPending();
    setPushing(false);
  };

  const getStock = (variantId: string) => {
    // Local stock map is authoritative for the configured location (accounts for unsynced sales)
    if (viewLocationId === config.locationId) {
      return stock[`${variantId}:${viewLocationId}`] ?? 0;
    }
    // For other locations, read from synced product data
    for (const p of products) {
      const v = p.variants.find((v) => v.id === variantId);
      if (v) return v.stockByLocation?.[viewLocationId] ?? 0;
    }
    return 0;
  };

  // ─── Product actions ─────────────────────────────────────────────────────

  const addToCart = (product: PosProduct, variant: PosVariant) => {
    const label = variant.isDefault
      ? product.name
      : `${product.name} — ${variant.attributeValues.map((a) => a.value).join(", ")}`;

    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        return prev.map((l) =>
          l.variantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, {
        id: crypto.randomUUID(),
        variantId: variant.id,
        label,
        unitPrice: variant.effectivePrice,
        quantity: 1,
        photo: variant.galleryPhotoUrl ?? product.primaryPhoto,
        discountAmount: "0",
        discountNote: "",
      }];
    });
    if (isMobile) setShowCart(true);
  };

  const adjustCartQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const newQty = l.quantity + delta;
        return newQty <= 0 ? null : { ...l, quantity: newQty };
      }).filter(Boolean) as CartLine[]
    );
  };

  // Track which draft is currently loaded (so we update it, not create a new one)
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);

  // ─── Complete sale ───────────────────────────────────────────────────────

  const buildSaleFromCart = (): PendingSale => ({
    id: loadedDraftId ?? crypto.randomUUID(),
    deviceId: config.deviceId,
    deviceName: config.deviceName,
    status: "completed",
    lines: cart.map((l) => ({
      variantId: l.variantId,
      description: l.label,
      quantity: String(l.quantity),
      unitPrice: l.unitPrice,
      discountAmount: l.discountAmount !== "0" ? l.discountAmount : undefined,
      discountNote: l.discountNote || undefined,
      location: config.locationId,
    })),
    discountPercentage: saleDiscountPct || undefined,
    discountFixed: saleDiscountFixed || undefined,
    note: saleNote,
    deviceCreatedAt: new Date().toISOString(),
    locationId: config.locationId,
    syncedAt: null,
  });

  const completeSale = async () => {
    if (cart.length === 0) return;

    const sale = buildSaleFromCart();

    // If this was a loaded draft, remove the old draft first
    if (loadedDraftId) {
      await removePendingSale(loadedDraftId);
    }
    await addPendingSale(sale);

    for (const line of cart) {
      await deductLocalStock(line.variantId, config.locationId, line.quantity);
    }
    setStock(await getLocalStock());
    await refreshPending();

    setSaleComplete(true);
    setCart([]);
    setSaleDiscountPct("");
    setSaleDiscountFixed("");
    setSaleNote("");
    setLoadedDraftId(null);
    setTimeout(() => { setSaleComplete(false); setShowCart(false); }, 2000);
  };

  // ─── Save as draft ───────────────────────────────────────────────────────

  const saveDraft = async () => {
    if (cart.length === 0) return;

    const draft: PendingSale = {
      ...buildSaleFromCart(),
      status: "draft",
    };

    if (loadedDraftId) {
      await updatePendingSale(draft);
    } else {
      await addPendingSale(draft);
    }
    await refreshPending();
    setCart([]);
    setSaleDiscountPct("");
    setSaleDiscountFixed("");
    setSaleNote("");
    setLoadedDraftId(null);
  };

  // ─── Load draft into cart ────────────────────────────────────────────────

  const loadDraft = async (sale: PendingSale) => {
    // Check stock availability for each line
    const currentStock = await getLocalStock();
    const warnings: string[] = [];
    const loadableLines: CartLine[] = [];

    for (const line of sale.lines) {
      const available = currentStock[`${line.variantId}:${config.locationId}`] ?? 0;
      const qty = parseInt(line.quantity);
      if (available < qty) {
        warnings.push(`${line.description}: need ${qty}, only ${available} available`);
        if (available > 0) {
          loadableLines.push({
            id: crypto.randomUUID(),
            variantId: line.variantId,
            label: line.description,
            unitPrice: line.unitPrice,
            quantity: available,
            photo: null,
            discountAmount: line.discountAmount ?? "0",
            discountNote: line.discountNote ?? "",
          });
        }
      } else {
        loadableLines.push({
          id: crypto.randomUUID(),
          variantId: line.variantId,
          label: line.description,
          unitPrice: line.unitPrice,
          quantity: qty,
          photo: null,
          discountAmount: line.discountAmount ?? "0",
          discountNote: line.discountNote ?? "",
        });
      }
    }

    if (warnings.length > 0) {
      // Still load what we can, but warn
      alert("Stock warning:\n" + warnings.join("\n") + "\n\nLoading available quantities.");
    }

    if (loadableLines.length === 0) {
      alert("No items available in stock. Draft cannot be loaded.");
      return;
    }

    setCart(loadableLines);
    setSaleDiscountPct(sale.discountPercentage ?? "");
    setSaleDiscountFixed(sale.discountFixed ?? "");
    setSaleNote(sale.note ?? "");
    setLoadedDraftId(sale.id);
    setActiveTab(0); // switch to sell tab
    if (isMobile) setShowCart(true);
  };

  // ─── Edit/delete pending sale ────────────────────────────────────────────

  const handleDeleteSale = async (id: string) => {
    await removePendingSale(id);
    // Re-sync stock to restore deducted amounts
    try { await syncProducts(); } catch { /* offline — stock stays deducted until next sync */ }
    setStock(await getLocalStock());
    await refreshPending();
    setEditingSale(null);
  };

  const handleSaveEdit = async (sale: PendingSale) => {
    await updatePendingSale(sale);
    await refreshPending();
    setEditingSale(null);
  };

  // ─── Production ──────────────────────────────────────────────────────────

  const addProductionRequest = async (product: PosProduct, variant: PosVariant, qty: number) => {
    const label = variant.isDefault
      ? product.name
      : `${product.name} — ${variant.attributeValues.map((a) => a.value).join(", ")}`;

    // Merge into existing pending request for same variant
    const existing = pendingProductions.find((r) => r.variantId === variant.id);
    if (existing) {
      const updated = { ...existing, quantity: existing.quantity + qty };
      await updatePendingProduction(updated);
    } else {
      await addPendingProduction({
        id: crypto.randomUUID(),
        deviceId: config.deviceId,
        deviceName: config.deviceName,
        variantId: variant.id,
        description: label,
        quantity: qty,
        locationId: config.locationId,
        note: "",
        deviceCreatedAt: new Date().toISOString(),
      });
    }
    setPendingProductions(await getPendingProductions());
  };

  const handlePushProductions = async () => {
    const online = await isOnline();
    if (!online) return;
    setPushingProd(true);
    await pushPendingProductions();
    setPendingProductions(await getPendingProductions());
    setPushingProd(false);
  };

  const handleDeleteProduction = async (id: string) => {
    await removePendingProduction(id);
    setPendingProductions(await getPendingProductions());
  };

  // ─── Filtered products ───────────────────────────────────────────────────

  // All unique category names from cached products
  const allTags = [...new Set(products.flatMap((p) => p.categoryNames))].sort();

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const q = search.toLowerCase().trim();
  const filtered = products.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (selectedTags.size > 0 && !p.categoryNames.some((c) => selectedTags.has(c))) return false;
    if (p.itemType === "physical") {
      return p.variants.some((v) => getStock(v.id) > 0);
    }
    return true;
  });

  const cartSubtotal = cart.reduce((s, l) => s + parseFloat(l.unitPrice) * l.quantity, 0);
  const cartLineDiscounts = cart.reduce((s, l) => s + parseFloat(l.discountAmount || "0") * l.quantity, 0);
  const pctDiscount = saleDiscountPct ? (cartSubtotal - cartLineDiscounts) * (parseFloat(saleDiscountPct) / 100) : 0;
  const fixedDiscount = parseFloat(saleDiscountFixed || "0");
  const cartTotal = cartSubtotal - cartLineDiscounts - pctDiscount - fixedDiscount;
  const cartItems = cart.reduce((s, l) => s + l.quantity, 0);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "grey.50" }}>
      {/* Header */}
      <AppBar position="static" elevation={0} sx={{ bgcolor: "primary.main" }}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flex: 1, fontWeight: "bold" }}>POS</Typography>
          {allLocations.length > 1 ? (
            <Select
              size="small"
              value={viewLocationId}
              onChange={(e) => setViewLocationId(e.target.value)}
              sx={{ mr: 1, color: "white", fontSize: "0.8rem", height: 28,
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.4)" },
                "& .MuiSelect-icon": { color: "rgba(255,255,255,0.7)" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.7)" },
              }}
            >
              {allLocations.map((l) => (
                <MenuItem key={l.id} value={l.id} sx={{ fontSize: "0.8rem" }}>
                  {l.name}{l.id === config.locationId ? " ★" : ""}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Chip
              label={config.locationName}
              size="small"
              sx={{ mr: 1, color: "white", borderColor: "rgba(255,255,255,0.5)" }}
              variant="outlined"
            />
          )}
          {pendingSales.filter((s) => s.status === "completed").length > 0 && (
            <Chip label={`${pendingSales.filter((s) => s.status === "completed").length} to sync`} size="small" color="warning" sx={{ mr: 0.5 }} />
          )}
          {pendingSales.filter((s) => s.status === "draft").length > 0 && (
            <Chip label={`${pendingSales.filter((s) => s.status === "draft").length} drafts`} size="small" color="info" sx={{ mr: 0.5 }} />
          )}
          <IconButton color="inherit" onClick={handleProductSync} disabled={syncing} title="Sync products">
            <SyncIcon sx={{ animation: syncing ? "spin 1s linear infinite" : undefined }} />
          </IconButton>
          {pendingSales.filter((s) => s.status === "completed").length > 0 && (
            <IconButton color="inherit" onClick={handlePushSales} disabled={pushing} title="Push sales to server">
              <CloudUploadIcon sx={{ animation: pushing ? "spin 1s linear infinite" : undefined }} />
            </IconButton>
          )}
          <IconButton color="inherit" onClick={onReset} title="Settings">
            <SettingsIcon />
          </IconButton>
        </Toolbar>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          textColor="inherit"
          indicatorColor="secondary"
          variant="fullWidth"
          sx={{ bgcolor: "rgba(0,0,0,0.1)", minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5 } }}
        >
          <Tab icon={<PointOfSaleIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Sell" />
          <Tab icon={<HistoryIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`History (${pendingSales.length})`} />
          <Tab icon={<PrecisionManufacturingIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`Produce (${pendingProductions.reduce((s, r) => s + r.quantity, 0)})`} />
        </Tabs>
      </AppBar>

      {/* ─── SELL TAB ─── */}
      {activeTab === 0 && (
        <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Product list */}
          <Box sx={{
            flex: 1,
            display: showCart && isMobile ? "none" : "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            <Box sx={{ p: 1.5, pb: 0.5 }}>
              <TextField
                fullWidth size="small"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment>,
                  },
                }}
              />
            </Box>
            {allTags.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ px: 1.5, pb: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                {allTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onClick={() => toggleTag(tag)}
                    color={selectedTags.has(tag) ? "primary" : "default"}
                    variant={selectedTags.has(tag) ? "filled" : "outlined"}
                  />
                ))}
                {selectedTags.size > 0 && (
                  <Chip label="Clear" size="small" variant="outlined" onClick={() => setSelectedTags(new Set())} onDelete={() => setSelectedTags(new Set())} />
                )}
              </Stack>
            )}
            <Box sx={{ flex: 1, overflow: "auto", p: 1.5, pt: 1 }}>
              <Stack spacing={0.75}>
                {filtered.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    locationId={viewLocationId}
                    stock={stock}
                    onAdd={addToCart}
                  />
                ))}
                {filtered.length === 0 && (
                  <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                    {products.length === 0 ? "No products cached. Tap sync." : "No matching products."}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Box>

          {/* Cart panel */}
          <Box sx={{
            width: { xs: "100%", md: 360 },
            display: !showCart && isMobile ? "none" : "flex",
            flexDirection: "column",
            borderLeft: { md: "1px solid" },
            borderColor: "divider",
            bgcolor: "white",
          }}>
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
              <Stack direction="row" alignItems="center">
                {isMobile && (
                  <Button size="small" onClick={() => setShowCart(false)} sx={{ mr: 1, minWidth: 0 }}>
                    ← Products
                  </Button>
                )}
                <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
                  Cart
                  {cartItems > 0 && <Chip label={cartItems} size="small" color="primary" sx={{ ml: 1 }} />}
                </Typography>
                {cart.length > 0 && (
                  <IconButton size="small" onClick={() => setCart([])}>
                    <DeleteIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                  </IconButton>
                )}
              </Stack>
            </Box>

            <Box sx={{ flex: 1, overflow: "auto", p: 1.5 }}>
              {cart.length === 0 ? (
                <Typography color="text.secondary" variant="body2" textAlign="center" sx={{ py: 4 }}>
                  Tap a product to add it.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {cart.map((line) => (
                    <CartLineRow key={line.id} line={line} setCart={setCart} adjustCartQty={adjustCartQty} />
                  ))}
                </Stack>
              )}
            </Box>

            <Box sx={{ p: 1.5, borderTop: 1, borderColor: "divider" }}>
              {(cartLineDiscounts > 0 || pctDiscount > 0 || fixedDiscount > 0) && (
                <Stack spacing={0.25} sx={{ mb: 1 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                    <Typography variant="body2">€{cartSubtotal.toFixed(2)}</Typography>
                  </Stack>
                  {cartLineDiscounts > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="warning.main">Line discounts</Typography>
                      <Typography variant="body2" color="warning.main">-€{cartLineDiscounts.toFixed(2)}</Typography>
                    </Stack>
                  )}
                  {pctDiscount > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="warning.main">-{saleDiscountPct}%</Typography>
                      <Typography variant="body2" color="warning.main">-€{pctDiscount.toFixed(2)}</Typography>
                    </Stack>
                  )}
                  {fixedDiscount > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="warning.main">Flat discount</Typography>
                      <Typography variant="body2" color="warning.main">-€{fixedDiscount.toFixed(2)}</Typography>
                    </Stack>
                  )}
                </Stack>
              )}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" fontWeight="bold">Total</Typography>
                <Typography variant="h6" fontWeight="bold">€{cartTotal.toFixed(2)}</Typography>
              </Stack>
              {/* Sale-level discount: % | € flat */}
              <Stack direction="row" spacing={0.75} sx={{ mb: 0.75 }}>
                <TextField size="small" type="number" placeholder="Discount %" value={saleDiscountPct}
                  onChange={(e) => setSaleDiscountPct(e.target.value)}
                  sx={{ flex: 1, "& .MuiInputBase-root": { height: 30, fontSize: "0.8rem" } }}
                  slotProps={{ htmlInput: { step: "0.5", min: 0, max: 100 }, inputLabel: { shrink: true } }}
                />
                <TextField size="small" type="number" placeholder="Flat €" value={saleDiscountFixed}
                  onChange={(e) => setSaleDiscountFixed(e.target.value)}
                  sx={{ flex: 1, "& .MuiInputBase-root": { height: 30, fontSize: "0.8rem" } }}
                  slotProps={{ htmlInput: { step: "0.01", min: 0 }, inputLabel: { shrink: true } }}
                />
              </Stack>
              <TextField size="small" fullWidth placeholder="Note" value={saleNote}
                onChange={(e) => setSaleNote(e.target.value)}
                sx={{ mb: 1.5, "& .MuiInputBase-root": { height: 30, fontSize: "0.8rem" } }}
              />
              {loadedDraftId && (
                <Typography variant="caption" color="info.main" sx={{ mb: 1, display: "block" }}>
                  Loaded from draft — complete to finalize or save to update draft
                </Typography>
              )}
              <Stack spacing={1}>
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  fullWidth
                  disabled={cart.length === 0}
                  onClick={completeSale}
                  sx={{ py: 1.5, fontSize: "1.1rem" }}
                >
                  {saleComplete ? (
                    <><CheckCircleIcon sx={{ mr: 1 }} /> Sale complete!</>
                  ) : (
                    `Complete sale — €${cartTotal.toFixed(2)}`
                  )}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  disabled={cart.length === 0}
                  onClick={saveDraft}
                >
                  {loadedDraftId ? "Update draft" : "Save as draft"}
                </Button>
              </Stack>
            </Box>
          </Box>

          {/* Mobile cart toggle FAB */}
          {isMobile && !showCart && (
            <Box sx={{ position: "fixed", bottom: 16, right: 16, zIndex: 10 }}>
              <IconButton
                onClick={() => setShowCart(true)}
                sx={{ bgcolor: "primary.main", color: "white", width: 56, height: 56, "&:hover": { bgcolor: "primary.dark" } }}
              >
                <Badge badgeContent={cartItems} color="error">
                  <ShoppingCartIcon />
                </Badge>
              </IconButton>
            </Box>
          )}
        </Box>
      )}

      {/* ─── HISTORY TAB ─── */}
      {activeTab === 1 && (
        <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
          {editingSale ? (
            <SaleEditor
              sale={editingSale}
              onSave={handleSaveEdit}
              onDelete={() => handleDeleteSale(editingSale.id)}
              onCancel={() => setEditingSale(null)}
            />
          ) : (
            <Stack spacing={2}>
              {/* Push completed sales button */}
              {pendingSales.filter((s) => s.status === "completed").length > 0 && (
                <Button
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  onClick={handlePushSales}
                  disabled={pushing}
                >
                  {pushing ? "Pushing..." : `Push ${pendingSales.filter((s) => s.status === "completed").length} sale(s) to server`}
                </Button>
              )}

              {pendingSales.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                  No sales or drafts on this device.
                </Typography>
              ) : (
                <>
                  {/* Drafts section */}
                  {pendingSales.filter((s) => s.status === "draft").length > 0 && (
                    <>
                      <Typography variant="subtitle2" color="text.secondary">Saved drafts</Typography>
                      {pendingSales.filter((s) => s.status === "draft").reverse().map((sale) => (
                        <SaleCard key={sale.id} sale={sale} onEdit={() => setEditingSale(sale)} onDelete={() => handleDeleteSale(sale.id)} onLoad={() => loadDraft(sale)} />
                      ))}
                    </>
                  )}

                  {/* Completed (awaiting sync) section */}
                  {pendingSales.filter((s) => s.status === "completed").length > 0 && (
                    <>
                      <Typography variant="subtitle2" color="text.secondary">Completed — awaiting sync</Typography>
                      {pendingSales.filter((s) => s.status === "completed").reverse().map((sale) => (
                        <SaleCard key={sale.id} sale={sale} onEdit={() => setEditingSale(sale)} onDelete={() => handleDeleteSale(sale.id)} />
                      ))}
                    </>
                  )}
                </>
              )}
            </Stack>
          )}
        </Box>
      )}

      {/* ─── PRODUCTION TAB ─── */}
      {activeTab === 2 && (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Search */}
          <Box sx={{ p: 1.5, pb: 0.5 }}>
            <TextField
              fullWidth size="small"
              placeholder="Search products to produce..."
              value={prodSearch}
              onChange={(e) => setProdSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment>,
                },
              }}
            />
          </Box>

          <Box sx={{ flex: 1, overflow: "auto", p: 1.5, pt: 1 }}>
            <Stack spacing={0.75}>
              {/* Pending production requests */}
              {pendingProductions.length > 0 && (
                <>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ flex: 1 }}>
                      Pending requests ({pendingProductions.length})
                    </Typography>
                    <Button
                      size="small" variant="contained"
                      startIcon={<CloudUploadIcon />}
                      onClick={handlePushProductions}
                      disabled={pushingProd}
                    >
                      Push
                    </Button>
                  </Stack>
                  {pendingProductions.map((req) => (
                    <PendingProductionRow key={req.id} req={req}
                      onUpdate={async (updated) => { await updatePendingProduction(updated); setPendingProductions(await getPendingProductions()); }}
                      onDelete={() => handleDeleteProduction(req.id)} />
                  ))}
                  <Divider sx={{ my: 1 }} />
                </>
              )}

              {/* All products (not filtered by stock — you're producing, not selling) */}
              <Typography variant="subtitle2" color="text.secondary">All products</Typography>
              {products
                .filter((p) => !prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase()))
                .map((product) => (
                  <ProductionCard
                    key={product.id}
                    product={product}
                    onAdd={(variant, qty) => addProductionRequest(product, variant, qty)}
                  />
                ))}
            </Stack>
          </Box>
        </Box>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Box>
  );
}

// ─── Editor line row with collapsible discount ──────────────────────────────

function EditorLineRow({ line, idx, adjustQty, setLines }: {
  line: PendingSale["lines"][0];
  idx: number;
  adjustQty: (idx: number, delta: number) => void;
  setLines: React.Dispatch<React.SetStateAction<PendingSale["lines"]>>;
}) {
  const ld = parseFloat(line.discountAmount || "0");
  const hasDiscount = ld > 0 || (line.discountNote ?? "").length > 0;
  const [discountOpen, setDiscountOpen] = useState(hasDiscount);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap>{line.description}</Typography>
          <Typography variant="caption" color="text.secondary">
            €{line.unitPrice}{ld > 0 ? ` -€${line.discountAmount}` : ""} × {line.quantity}
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => adjustQty(idx, -1)}>
          <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: "error.light" }} />
        </IconButton>
        <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 20, textAlign: "center" }}>
          {line.quantity}
        </Typography>
        <IconButton size="small" onClick={() => adjustQty(idx, 1)}>
          <AddCircleOutlineIcon sx={{ fontSize: 18, color: "success.main" }} />
        </IconButton>
        <IconButton size="small" onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}>
          <DeleteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>
      {!discountOpen ? (
        <Typography variant="caption" color="primary" sx={{ cursor: "pointer", pl: 0.5, mt: 0.25, display: "block" }}
          onClick={() => setDiscountOpen(true)}>
          + Discount
        </Typography>
      ) : (
        <Stack direction="row" spacing={0.5} sx={{ pl: 0.5, mt: 0.5 }}>
          <TextField size="small" placeholder="€" type="number"
            value={(line.discountAmount ?? "0") === "0" ? "" : line.discountAmount}
            onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, discountAmount: e.target.value || "0" } : l))}
            sx={{ width: 70, "& .MuiInputBase-root": { height: 24, fontSize: "0.7rem" } }}
            slotProps={{ htmlInput: { step: "0.01", min: 0 } }}
          />
          <TextField size="small" placeholder="Note"
            value={line.discountNote ?? ""}
            onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, discountNote: e.target.value } : l))}
            sx={{ flex: 1, "& .MuiInputBase-root": { height: 24, fontSize: "0.7rem" } }}
          />
          <IconButton size="small" onClick={() => {
            setLines((p) => p.map((l, i) => i === idx ? { ...l, discountAmount: "0", discountNote: "" } : l));
            setDiscountOpen(false);
          }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
}

// ─── Sale editor (for unsynced local sales) ──────────────────────────────────

function SaleEditor({
  sale,
  onSave,
  onDelete,
  onCancel,
}: {
  sale: PendingSale;
  onSave: (sale: PendingSale) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [lines, setLines] = useState(sale.lines);
  const [note, setNote] = useState(sale.note);
  const [editDiscountPct, setEditDiscountPct] = useState(sale.discountPercentage ?? "");
  const [editDiscountFixed, setEditDiscountFixed] = useState(sale.discountFixed ?? "");

  const adjustQty = (idx: number, delta: number) => {
    setLines((prev) => {
      const next = [...prev];
      const newQty = parseInt(next[idx].quantity) + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], quantity: String(newQty) };
      }
      return next;
    });
  };

  const subtotal = lines.reduce((s, l) => s + parseFloat(l.unitPrice) * parseInt(l.quantity), 0);
  const lineDiscounts = lines.reduce((s, l) => s + parseFloat(l.discountAmount || "0") * parseInt(l.quantity), 0);
  const pctDisc = editDiscountPct ? (subtotal - lineDiscounts) * (parseFloat(editDiscountPct) / 100) : 0;
  const fixDisc = parseFloat(editDiscountFixed || "0");
  const total = subtotal - lineDiscounts - pctDisc - fixDisc;

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center">
        <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
          Edit Sale — {new Date(sale.deviceCreatedAt).toLocaleString()}
        </Typography>
        <Button size="small" onClick={onCancel}>Back</Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack spacing={1}>
          {lines.map((line, idx) => (
            <EditorLineRow key={idx} line={line} idx={idx} adjustQty={adjustQty} setLines={setLines} />
          ))}
        </Stack>
      </Paper>

      <TextField
        label="Note"
        size="small"
        fullWidth
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <Stack direction="row" spacing={0.75}>
        <TextField size="small" type="number" label="Discount %" value={editDiscountPct}
          onChange={(e) => setEditDiscountPct(e.target.value)}
          sx={{ flex: 1 }}
          slotProps={{ htmlInput: { step: "0.5", min: 0, max: 100 }, inputLabel: { shrink: true } }}
        />
        <TextField size="small" type="number" label="Flat discount €" value={editDiscountFixed}
          onChange={(e) => setEditDiscountFixed(e.target.value)}
          sx={{ flex: 1 }}
          slotProps={{ htmlInput: { step: "0.01", min: 0 }, inputLabel: { shrink: true } }}
        />
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" fontWeight="bold">Total: €{total.toFixed(2)}</Typography>
      </Stack>

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          fullWidth
          onClick={() => onSave({ ...sale, lines, note, discountPercentage: editDiscountPct || undefined, discountFixed: editDiscountFixed || undefined })}
          disabled={lines.length === 0}
        >
          Save changes
        </Button>
        <Button variant="outlined" color="error" onClick={onDelete}>
          Delete sale
        </Button>
      </Stack>
    </Stack>
  );
}

// ─── Sale card (history list item) ───────────────────────────────────────────

function SaleCard({
  sale,
  onEdit,
  onDelete,
  onLoad,
}: {
  sale: PendingSale;
  onEdit: () => void;
  onDelete: () => void;
  onLoad?: () => void;
}) {
  const sub = sale.lines.reduce((s, l) => s + parseFloat(l.unitPrice) * parseInt(l.quantity), 0);
  const ld = sale.lines.reduce((s, l) => s + parseFloat(l.discountAmount || "0") * parseInt(l.quantity), 0);
  const pd = sale.discountPercentage ? (sub - ld) * (parseFloat(sale.discountPercentage) / 100) : 0;
  const fd = parseFloat(sale.discountFixed || "0");
  const total = sub - ld - pd - fd;
  const items = sale.lines.reduce((s, l) => s + parseInt(l.quantity), 0);
  const isDraft = sale.status === "draft";

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderColor: isDraft ? "info.light" : undefined }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
            <Typography variant="body2" fontWeight="bold">€{total.toFixed(2)}</Typography>
            <Chip label={`${items} items`} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.7rem" }} />
            <Chip
              label={isDraft ? "draft" : "completed"}
              size="small"
              color={isDraft ? "info" : "warning"}
              sx={{ height: 18, fontSize: "0.7rem" }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {new Date(sale.deviceCreatedAt).toLocaleString()}
          </Typography>
          {sale.note && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{sale.note}</Typography>
          )}
          <Typography variant="caption" color="text.disabled" sx={{ display: "block" }}>
            {sale.lines.map((l) => `${l.description} ×${l.quantity}`).join(", ")}
          </Typography>
        </Box>
        {onLoad && isDraft && (
          <IconButton size="small" onClick={onLoad} title="Load into cart" color="primary">
            <ShoppingCartCheckoutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
        <IconButton size="small" onClick={onEdit} title="Edit">
          <EditIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton size="small" onClick={onDelete} title="Delete">
          <DeleteIcon sx={{ fontSize: 18, color: "error.main" }} />
        </IconButton>
      </Stack>
    </Paper>
  );
}

// ─── Production card ─────────────────────────────────────────────────────────

function ProductionCard({
  product,
  onAdd,
}: {
  product: PosProduct;
  onAdd: (variant: PosVariant, qty: number) => void;
}) {
  const variants = product.variants.filter((v) => v.isActive);
  const isSingle = variants.length <= 1;
  const singleVariant = variants[0];

  if (isSingle && singleVariant) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {product.primaryPhoto && (
            <Box component="img" src={product.primaryPhoto}
              sx={{ width: 36, height: 36, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
          )}
          <Typography variant="body2" fontWeight="bold" sx={{ flex: 1 }} noWrap>{product.name}</Typography>
          {[1, 5, 10].map((n) => (
            <Button key={n} size="small" variant="outlined" sx={{ minWidth: 36, px: 0.5, fontSize: "0.75rem" }}
              onClick={() => onAdd(singleVariant, n)}>
              +{n}
            </Button>
          ))}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, bgcolor: "grey.50" }}>
        {product.primaryPhoto && (
          <Box component="img" src={product.primaryPhoto}
            sx={{ width: 28, height: 28, borderRadius: "3px", objectFit: "cover", flexShrink: 0 }} />
        )}
        <Typography variant="body2" fontWeight="bold">{product.name}</Typography>
      </Stack>
      <Divider />
      <Stack divider={<Divider />}>
        {variants.map((v) => {
          const vLabel = v.isDefault ? "Default" : v.attributeValues.map((a) => a.value).join(", ");
          return (
            <Stack key={v.id} direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 0.75 }}>
              {v.galleryPhotoUrl ? (
                <Box component="img" src={v.galleryPhotoUrl}
                  sx={{ width: 24, height: 24, borderRadius: "3px", objectFit: "cover", flexShrink: 0 }} />
              ) : v.attributeValues.some((a) => a.colorHex) ? (
                <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: v.attributeValues.find((a) => a.colorHex)?.colorHex, border: "1px solid", borderColor: "divider", flexShrink: 0 }} />
              ) : null}
              <Typography variant="body2" sx={{ flex: 1 }}>{vLabel}</Typography>
              {[1, 5, 10].map((n) => (
                <Button key={n} size="small" variant="outlined" sx={{ minWidth: 32, px: 0.5, fontSize: "0.7rem" }}
                  onClick={() => onAdd(v, n)}>
                  +{n}
                </Button>
              ))}
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}

// ─── Product card ────────────────────────────────────────────────────────────

function ProductCard({
  product,
  locationId,
  stock,
  onAdd,
}: {
  product: PosProduct;
  locationId: string;
  stock: Record<string, number>;
  onAdd: (product: PosProduct, variant: PosVariant) => void;
}) {
  const variants = product.variants.filter((v) => v.isActive);
  const isSingle = variants.length <= 1;
  const singleVariant = variants[0];

  if (isSingle && singleVariant) {
    const qty = stock[`${singleVariant.id}:${locationId}`] ?? 0;
    return (
      <Paper
        variant="outlined"
        sx={{ p: 1.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" }, "&:active": { bgcolor: "action.selected" } }}
        onClick={() => onAdd(product, singleVariant)}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {product.primaryPhoto ? (
            <Box component="img" src={product.primaryPhoto}
              sx={{ width: 44, height: 44, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <Box sx={{ width: 44, height: 44, borderRadius: "4px", bgcolor: "grey.100", flexShrink: 0 }} />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight="bold" noWrap>{product.name}</Typography>
            {product.itemType === "physical" && (
              <Typography variant="caption" color="text.secondary">{qty} in stock</Typography>
            )}
          </Box>
          <Typography variant="body1" fontWeight="bold">€{singleVariant.effectivePrice}</Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box sx={{ px: 1.5, py: 1, bgcolor: "grey.50" }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {product.primaryPhoto ? (
            <Box component="img" src={product.primaryPhoto}
              sx={{ width: 36, height: 36, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <Box sx={{ width: 36, height: 36, borderRadius: "4px", bgcolor: "grey.200", flexShrink: 0 }} />
          )}
          <Typography variant="body2" fontWeight="bold" sx={{ flex: 1 }}>{product.name}</Typography>
        </Stack>
      </Box>
      <Divider />
      <Stack divider={<Divider />}>
        {variants.map((v) => {
          const qty = stock[`${v.id}:${locationId}`] ?? 0;
          const vLabel = v.isDefault ? "Default" : v.attributeValues.map((a) => a.value).join(", ");
          if (product.itemType === "physical" && qty <= 0) return null;
          return (
            <Stack
              key={v.id}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ px: 1.5, py: 0.75, cursor: "pointer", "&:hover": { bgcolor: "action.hover" }, "&:active": { bgcolor: "action.selected" } }}
              onClick={() => onAdd(product, v)}
            >
              {v.galleryPhotoUrl ? (
                <Box component="img" src={v.galleryPhotoUrl}
                  sx={{ width: 28, height: 28, borderRadius: "3px", objectFit: "cover", flexShrink: 0 }} />
              ) : v.attributeValues.some((a) => a.colorHex) ? (
                <Box sx={{
                  width: 14, height: 14, borderRadius: "50%",
                  bgcolor: v.attributeValues.find((a) => a.colorHex)?.colorHex,
                  border: "1px solid", borderColor: "divider", flexShrink: 0,
                }} />
              ) : null}
              <Typography variant="body2" sx={{ flex: 1 }}>{vLabel}</Typography>
              {product.itemType === "physical" && (
                <Chip label={qty} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.7rem" }} />
              )}
              <Typography variant="body2" fontWeight="bold">€{v.effectivePrice}</Typography>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}
