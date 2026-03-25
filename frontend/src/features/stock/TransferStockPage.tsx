import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Button, Chip, Divider, Grid, IconButton, MenuItem,
  Paper, Select, Stack, TextField, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { toast } from "react-toastify";
import { useLocations, useBatchTransfer, useStockEntries } from "../../api/hooks";
import ProductPickerPanel, { type ProductPickerSelectFn } from "../../components/ProductPickerPanel";
import type { ProductVariant } from "../../types/api";
import { useTranslation } from "react-i18next";

interface CartLine {
  id: string;
  variantId: string;
  label: string;
  fromLocationId: string;
  quantity: number;
}

// ─── Per-line source location picker (fetches stock entries for the variant) ──

function SourceLocationSelect({
  variantId,
  value,
  onChange,
  excludeLocationId,
}: {
  variantId: string;
  value: string;
  onChange: (locationId: string) => void;
  excludeLocationId: string;
}) {
  const { t } = useTranslation();
  const { data: entries = [] } = useStockEntries({ variant: variantId });
  const withStock = entries.filter((e) => e.quantity > 0 && e.location !== excludeLocationId);

  // Auto-select first available source if current selection is invalid
  useEffect(() => {
    if (withStock.length > 0 && !withStock.find((e) => e.location === value)) {
      onChange(withStock[0].location);
    }
  }, [withStock.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Select
      size="small"
      displayEmpty
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ fontSize: "0.75rem", minWidth: 100, "& .MuiSelect-select": { py: 0.5 } }}
    >
      <MenuItem value="" disabled><em>{t("transferStockDialog.fromLocation", "From…")}</em></MenuItem>
      {withStock.map((e) => (
        <MenuItem key={e.location} value={e.location} sx={{ fontSize: "0.75rem" }}>
          {e.locationName} ({e.quantity})
        </MenuItem>
      ))}
    </Select>
  );
}

// ─── Transfer Stock page ─────────────────────────────────────────────────────

export default function TransferStockPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [toLocationId, setToLocationId] = useState("");
  const [note, setNote] = useState("");

  const { data: locations } = useLocations();
  const batchTransfer = useBatchTransfer();

  // Auto-select default destination
  useEffect(() => {
    if (!toLocationId && locations && locations.length > 0) {
      const def = locations.find((l) => l.isDefault) ?? locations[0];
      setToLocationId(def.id);
    }
  }, [locations, toLocationId]);

  const handleAdd: ProductPickerSelectFn = (variant: ProductVariant, label: string, _product, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        return prev.map((l) => l.variantId === variant.id ? { ...l, quantity: l.quantity + qty } : l);
      }
      return [...prev, { id: crypto.randomUUID(), variantId: variant.id, label, fromLocationId: "", quantity: qty }];
    });
  };

  const updateFrom = (lineId: string, locationId: string) => {
    setCart((prev) => prev.map((l) => l.id === lineId ? { ...l, fromLocationId: locationId } : l));
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
    if (cart.length === 0 || !toLocationId) return;
    const invalid = cart.filter((l) => !l.fromLocationId || l.fromLocationId === toLocationId);
    if (invalid.length > 0) {
      toast.error(t("stock.transferPage.invalidSources"));
      return;
    }
    try {
      await batchTransfer.mutateAsync({
        lines: cart.map((l) => ({
          variantId: l.variantId,
          fromLocationId: l.fromLocationId,
          quantity: l.quantity,
        })),
        toLocationId,
        note: note || undefined,
      });
      toast.success(t("stock.transferPage.transferred", { count: cart.length }));
      navigate("/stock");
    } catch {
      toast.error(t("stock.transferPage.transferFailed"));
    }
  };

  const totalUnits = cart.reduce((s, l) => s + l.quantity, 0);
  const canSubmit = cart.length > 0 && toLocationId && cart.every((l) => l.fromLocationId && l.fromLocationId !== toLocationId) && !batchTransfer.isPending;

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate("/stock")}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" fontWeight="bold" sx={{ flex: 1 }}>{t("stock.transferPage.title")}</Typography>
      </Stack>

      <Grid container spacing={2}>
        {/* Left — product picker */}
        <Grid size={{ xs: 12, md: 7 }}>
          <ProductPickerPanel
            onSelect={handleAdd}
            queryParams={{ item_type: "physical", is_active: true, has_stock: true }}
            showStock
            quickAmounts={[1, 5]}
            autoFocus
            emptyMessage={t("stock.transferPage.noProducts")}
            noMatchMessage={t("common.noProductsFound")}
          />
        </Grid>

        {/* Right — transfer cart */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper variant="outlined" sx={{ p: 2, position: "sticky", top: 16 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {t("stock.transferPage.toTransfer")}
              {totalUnits > 0 && <Chip label={`${totalUnits}`} size="small" color="primary" sx={{ ml: 1 }} />}
            </Typography>

            {/* Destination location */}
            {locations && locations.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">{t("stock.transferPage.destination")}</Typography>
                <Select
                  size="small"
                  fullWidth
                  value={toLocationId}
                  onChange={(e) => setToLocationId(e.target.value)}
                >
                  {locations.filter((l) => l.isActive).map((l) => (
                    <MenuItem key={l.id} value={l.id}>{l.name}{l.isDefault ? ` (${t("common.default")})` : ""}</MenuItem>
                  ))}
                </Select>
              </Box>
            )}

            {cart.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("stock.transferPage.clickToAdd")}
              </Typography>
            ) : (
              <Stack spacing={0.75} sx={{ mb: 2 }}>
                {cart.map((line) => (
                  <Stack key={line.id} spacing={0.5}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {line.label}
                      </Typography>
                      <IconButton size="small" onClick={() => setCart((p) => p.filter((l) => l.id !== line.id))}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <SourceLocationSelect
                        variantId={line.variantId}
                        value={line.fromLocationId}
                        onChange={(locId) => updateFrom(line.id, locId)}
                        excludeLocationId={toLocationId}
                      />
                      <Box sx={{ flex: 1 }} />
                      <IconButton size="small" onClick={() => adjustQty(line.id, -1)}>
                        <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: "error.light" }} />
                      </IconButton>
                      <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 24, textAlign: "center" }}>
                        {line.quantity}
                      </Typography>
                      <IconButton size="small" onClick={() => adjustQty(line.id, 1)}>
                        <AddCircleOutlineIcon sx={{ fontSize: 18, color: "success.main" }} />
                      </IconButton>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 1.5 }} />

            <Stack spacing={1.5}>
              <TextField
                label={t("common.noteOptional")}
                size="small"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                startIcon={<SwapHorizIcon />}
                onClick={handleSubmit}
                disabled={!canSubmit}
                fullWidth
              >
                {t("stock.transferPage.confirm", { count: totalUnits })}
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
