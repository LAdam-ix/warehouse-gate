import { useEffect, useState } from "react";
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import { useAddStock, useLocations } from "../api/hooks";
import { variantLabel } from "../utils/variantLabel";
import { intQtyInputProps } from "../utils/form";
import type { ProductVariant } from "../types/api";
import { useTranslation } from "react-i18next";

const QUICK_AMOUNTS = [1, 5, 10, 50];

// ─── Shared location select — auto-selects default on mount ──────────────────

export function LocationSelect({
  locations,
  value,
  onChange,
}: {
  locations: { id: string; name: string; isDefault: boolean }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!value && locations.length > 0) {
      const def = locations.find((l) => l.isDefault) ?? locations[0];
      onChange(def.id);
    }
  }, [locations, value, onChange]);

  if (locations.length === 0) return null;
  return (
    <FormControl size="small" fullWidth>
      <InputLabel>{t("addStockDialog.locationLabel")}</InputLabel>
      <Select label={t("addStockDialog.locationLabel")} value={value} onChange={(e) => onChange(e.target.value)}>
        {locations.map((l) => (
          <MenuItem key={l.id} value={l.id}>
            {l.name}{l.isDefault ? t("common.locationDefault") : ""}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

// ─── Add Stock dialog — full-featured (note + date optional) ─────────────────

export function AddStockDialog({
  variant,
  productName,
  open,
  onClose,
}: {
  variant: ProductVariant;
  productName?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const addStock = useAddStock();
  const { data: locations } = useLocations();
  const [qty, setQty] = useState(0);
  const [locationId, setLocationId] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));

  const vLabel = variant.isDefault ? t("common.default") : variantLabel(variant.attributeValues);
  const title = productName
    ? (variant.isDefault ? productName : `${productName} — ${vLabel}`)
    : vLabel;

  const handleSubmit = async () => {
    if (qty <= 0) { toast.error(t("addStockDialog.enterQuantity")); return; }
    await addStock.mutateAsync({
      lines: [{ variantId: variant.id, quantity: qty }],
      locationId: locationId || undefined,
      note: note || undefined,
      movementDate: new Date(date).toISOString(),
    });
    toast.success(t("addStockDialog.addedToStock", { count: qty }));
    setQty(0);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("addStockDialog.title", { title })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ flex: 1 }}>{t("addStockDialog.quantity")}</Typography>
            {QUICK_AMOUNTS.map((n) => (
              <Button key={n} size="small" variant="outlined" onClick={() => setQty((q) => q + n)}>
                +{n}
              </Button>
            ))}
          </Stack>
          <TextField
            label={t("addStockDialog.quantityField")}
            type="number"
            size="small"
            fullWidth
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            slotProps={{ htmlInput: { ...intQtyInputProps, min: 1 } }}
          />
          <LocationSelect locations={locations ?? []} value={locationId} onChange={setLocationId} />
          <TextField
            label={t("addStockDialog.date")}
            type="datetime-local"
            size="small"
            fullWidth
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <TextField
            label={t("addStockDialog.noteOptional")}
            size="small"
            fullWidth
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={qty <= 0 || addStock.isPending}
        >
          {qty > 0 ? t("addStockDialog.addUnits", { count: qty }) : t("addStockDialog.addUnitsEmpty")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
