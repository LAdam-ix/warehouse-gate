import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button, Chip, Divider,
  Grid, IconButton, Paper, Stack, TextField, Typography,
  FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { toast } from "react-toastify";
import { useLocations, useAddStock, useCreateLocation } from "../../api/hooks";
import ProductPickerPanel, { type ProductPickerSelectFn } from "../../components/ProductPickerPanel";
import { useTranslation } from "react-i18next";

interface CartLine {
  id: string; // unique per line — same variant can appear multiple times for different locations
  variantId: string;
  variantLabel: string;
  quantity: number;
  locationId: string;
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
  const [cart, setCart] = useState<CartLine[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState("");
  const [note, setNote] = useState("");
  const [movementDate, setMovementDate] = useState(new Date().toISOString().slice(0, 16));

  const { data: locations } = useLocations();
  const addStock = useAddStock();

  // Auto-select default location
  useEffect(() => {
    if (!defaultLocationId && locations && locations.length > 0) {
      const def = locations.find((l) => l.isDefault) ?? locations[0];
      setDefaultLocationId(def.id);
    }
  }, [locations, defaultLocationId]);

  const handlePickerAdd: ProductPickerSelectFn = (_variant, label, _product, qty = 1) => {
    const line = { variantId: _variant.id, variantLabel: label, quantity: qty };
    handleAdd(line);
  };

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
        {/* Left — product picker */}
        <Grid size={{ xs: 12, md: 7 }}>
          <ProductPickerPanel
            onSelect={handlePickerAdd}
            queryParams={{ item_type: "physical" }}
            showStock
            quickAmounts={[1, 5, 10, 50]}
            autoExpandThreshold={3}
            variantLimit={3}
            autoFocus
            noMatchMessage={t("common.noProductsFound")}
          />
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
