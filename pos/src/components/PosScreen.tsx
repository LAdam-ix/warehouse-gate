import { useState, useEffect, useCallback } from "react";
import {
  AppBar, Badge, Box, Button, Chip, Divider, IconButton, InputAdornment,
  Paper, Stack, Tab, Tabs, TextField, Toolbar, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SyncIcon from "@mui/icons-material/Sync";
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HistoryIcon from "@mui/icons-material/History";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import {
  getCachedProducts, getLocalStock, deductLocalStock,
  addPendingSale, getPendingSales, type PosProduct, type PosVariant, type PosConfig,
} from "../lib/db";
import { fullSync } from "../lib/sync";

// ─── Cart types ──────────────────────────────────────────────────────────────

interface CartLine {
  id: string;
  variantId: string;
  label: string;
  unitPrice: string;
  quantity: number;
  photo: string | null;
}

// ─── Main POS screen ─────────────────────────────────────────────────────────

export default function PosScreen({ config, onReset }: { config: PosConfig; onReset: () => void }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showCart, setShowCart] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0=sell, 1=history
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [editingSale, setEditingSale] = useState<PendingSale | null>(null);

  // Load cached data on mount
  useEffect(() => {
    getCachedProducts().then(setProducts);
    getLocalStock().then(setStock);
    getPendingSales().then((s) => setPendingCount(s.filter((x) => !x.syncedAt).length));
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await fullSync();
      const prods = await getCachedProducts();
      setProducts(prods);
      const s = await getLocalStock();
      setStock(s);
      const pending = await getPendingSales();
      setPendingCount(pending.filter((x) => !x.syncedAt).length);
    } catch {
      // offline — silent
    }
    setSyncing(false);
  }, []);

  // Auto-sync on mount + every 5 minutes
  useEffect(() => {
    handleSync();
    const interval = setInterval(handleSync, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [handleSync]);

  const getStock = (variantId: string) => stock[`${variantId}:${config.locationId}`] ?? 0;

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
      }];
    });

    // Show cart on mobile after adding
    if (isMobile) setShowCart(true);
  };

  const adjustCartQty = (lineId: string, delta: number) => {
    setCart((prev) => {
      return prev.map((l) => {
        if (l.id !== lineId) return l;
        const newQty = l.quantity + delta;
        return newQty <= 0 ? null : { ...l, quantity: newQty };
      }).filter(Boolean) as CartLine[];
    });
  };

  const removeCartLine = (lineId: string) => {
    setCart((prev) => prev.filter((l) => l.id !== lineId));
  };

  // ─── Complete sale ───────────────────────────────────────────────────────

  const completeSale = async () => {
    if (cart.length === 0) return;

    const sale = {
      id: crypto.randomUUID(),
      lines: cart.map((l) => ({
        variantId: l.variantId,
        description: l.label,
        quantity: String(l.quantity),
        unitPrice: l.unitPrice,
        location: config.locationId,
      })),
      note: "",
      deviceCreatedAt: new Date().toISOString(),
      locationId: config.locationId,
      syncedAt: null,
    };

    // Save to pending queue
    await addPendingSale(sale);

    // Deduct local stock
    for (const line of cart) {
      await deductLocalStock(line.variantId, config.locationId, line.quantity);
    }

    // Refresh stock display
    const freshStock = await getLocalStock();
    setStock(freshStock);
    setPendingCount((c) => c + 1);

    // Show confirmation, then return to products
    setSaleComplete(true);
    setCart([]);
    setTimeout(() => { setSaleComplete(false); setShowCart(false); }, 2000);

    // Try to sync immediately (best effort)
    try { await fullSync(); } catch { /* offline — will sync later */ }
    const pending = await getPendingSales();
    setPendingCount(pending.filter((x) => !x.syncedAt).length);
  };

  // ─── Filtered products ───────────────────────────────────────────────────

  const q = search.toLowerCase().trim();
  const filtered = products.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q)) return false;
    // Only show products with stock at this location (or services)
    if (p.itemType === "physical") {
      return p.variants.some((v) => getStock(v.id) > 0);
    }
    return true;
  });

  const cartTotal = cart.reduce((s, l) => s + parseFloat(l.unitPrice) * l.quantity, 0);
  const cartItems = cart.reduce((s, l) => s + l.quantity, 0);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "grey.50" }}>
      {/* Header */}
      <AppBar position="static" elevation={0} sx={{ bgcolor: "primary.main" }}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flex: 1, fontWeight: "bold" }}>POS</Typography>
          <Chip
            label={config.locationName}
            size="small"
            sx={{ mr: 1, color: "white", borderColor: "rgba(255,255,255,0.5)" }}
            variant="outlined"
          />
          {pendingCount > 0 && (
            <Chip label={`${pendingCount} pending`} size="small" color="warning" sx={{ mr: 1 }} />
          )}
          <IconButton color="inherit" onClick={handleSync} disabled={syncing}>
            <SyncIcon sx={{ animation: syncing ? "spin 1s linear infinite" : undefined }} />
          </IconButton>
          <IconButton color="inherit" onClick={onReset}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Body */}
      <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Product list */}
        <Box sx={{
          flex: 1,
          display: showCart && isMobile ? "none" : "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Search */}
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

          {/* Products */}
          <Box sx={{ flex: 1, overflow: "auto", p: 1.5, pt: 1 }}>
            <Stack spacing={0.75}>
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  locationId={config.locationId}
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
                  <Stack key={line.id} direction="row" alignItems="center" spacing={0.75}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap fontWeight="medium">{line.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        €{line.unitPrice} × {line.quantity} = €{(parseFloat(line.unitPrice) * line.quantity).toFixed(2)}
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => adjustCartQty(line.id, -1)}>
                      <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: "error.light" }} />
                    </IconButton>
                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 20, textAlign: "center" }}>
                      {line.quantity}
                    </Typography>
                    <IconButton size="small" onClick={() => adjustCartQty(line.id, 1)}>
                      <AddCircleOutlineIcon sx={{ fontSize: 18, color: "success.main" }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => removeCartLine(line.id)}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>

          {/* Total + complete */}
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: "divider" }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="h6" fontWeight="bold">Total</Typography>
              <Typography variant="h6" fontWeight="bold">€{cartTotal.toFixed(2)}</Typography>
            </Stack>
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
          </Box>
        </Box>
      </Box>

      {/* Mobile cart toggle FAB */}
      {isMobile && (
        <Box sx={{ position: "fixed", bottom: 16, right: 16, zIndex: 10 }}>
          <IconButton
            onClick={() => setShowCart((v) => !v)}
            sx={{ bgcolor: "primary.main", color: "white", width: 56, height: 56, "&:hover": { bgcolor: "primary.dark" } }}
          >
            <Badge badgeContent={cartItems} color="error">
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
        </Box>
      )}

      {/* Spin animation for sync icon */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Box>
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
          {product.primaryPhoto && (
            <Box component="img" src={product.primaryPhoto}
              sx={{ width: 44, height: 44, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
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

  // Multi-variant product
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box sx={{ px: 1.5, py: 1, bgcolor: "grey.50" }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {product.primaryPhoto && (
            <Box component="img" src={product.primaryPhoto}
              sx={{ width: 36, height: 36, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
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
              {v.attributeValues.some((a) => a.colorHex) && (
                <Box sx={{
                  width: 14, height: 14, borderRadius: "50%",
                  bgcolor: v.attributeValues.find((a) => a.colorHex)?.colorHex,
                  border: "1px solid", borderColor: "divider", flexShrink: 0,
                }} />
              )}
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
