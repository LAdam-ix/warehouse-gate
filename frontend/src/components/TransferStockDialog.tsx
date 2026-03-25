import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Button, CircularProgress, Collapse, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, InputAdornment,
  MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InventoryIcon from "@mui/icons-material/Inventory2";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { toast } from "react-toastify";
import { axiosInstance } from "../api/client/axiosInstance";
import { useProducts, useProduct, useLocations, useTransferStock } from "../api/hooks";
import { variantLabel } from "../utils/variantLabel";
import { intQtyInputProps } from "../utils/form";
import type { PaginatedResponse, Product, ProductVariant, StockEntry } from "../types/api";
import { useTranslation } from "react-i18next";

// ─── Internal variant picker (used in free-form mode) ─────────────────────────

function VariantPickerRows({
  productId,
  productName,
  onSelect,
}: {
  productId: string;
  productName: string;
  onSelect: (v: ProductVariant, productName: string) => void;
}) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useProduct(productId);
  if (isLoading) return <Box sx={{ p: 1 }}><CircularProgress size={14} /></Box>;
  if (!detail) return null;
  const active = detail.variants.filter((v) => v.isActive && (v.totalStock ?? 0) > 0);
  return (
    <Stack divider={<Divider />}>
      {active.map((v) => {
        const label = v.isDefault ? productName : variantLabel(v.attributeValues);
        const colorHex = v.attributeValues.find((av) => av.colorHex)?.colorHex ?? null;
        return (
          <Stack key={v.id} direction="row" alignItems="center" spacing={1}
            sx={{ py: 0.75, px: 2, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
            onClick={() => onSelect(v, productName)}
          >
            {colorHex && <Box sx={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, bgcolor: colorHex }} />}
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>{label}</Typography>
            <Typography variant="caption" color="primary">{t("common.select")}</Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

function ProductPickerRow({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: (v: ProductVariant, productName: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: detail } = useProduct(product.id);

  if (product.variantCount <= 1) {
    return (
      <Stack direction="row" alignItems="center" spacing={1.5}
        sx={{ p: 1, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
        onClick={() => {
          const v = detail?.variants.find((v) => v.isActive);
          if (v) onSelect(v, product.name);
        }}
      >
        {product.primaryPhoto
          ? <Box component="img" src={product.primaryPhoto} sx={{ width: 36, height: 36, borderRadius: "3px", objectFit: "cover", flexShrink: 0 }} />
          : <Box sx={{ width: 36, height: 36, bgcolor: "grey.100", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <InventoryIcon sx={{ fontSize: 18, color: "grey.400" }} />
            </Box>
        }
        <Typography variant="body2" sx={{ flex: 1 }} noWrap>{product.name}</Typography>
        <Typography variant="caption" color="primary">{t("common.select")}</Typography>
      </Stack>
    );
  }

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1.5}
        sx={{ p: 1, cursor: "pointer" }} onClick={() => setOpen((v) => !v)}
      >
        {product.primaryPhoto
          ? <Box component="img" src={product.primaryPhoto} sx={{ width: 36, height: 36, borderRadius: "3px", objectFit: "cover", flexShrink: 0 }} />
          : <Box sx={{ width: 36, height: 36, bgcolor: "grey.100", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <InventoryIcon sx={{ fontSize: 18, color: "grey.400" }} />
            </Box>
        }
        <Typography variant="body2" sx={{ flex: 1 }} noWrap>{product.name}</Typography>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Stack>
      <Collapse in={open}>
        <Divider />
        <VariantPickerRows productId={product.id} productName={product.name} onSelect={onSelect} />
      </Collapse>
    </>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export function TransferStockDialog({
  variant: prefilledVariant,
  productName: prefilledProductName,
  open,
  onClose,
}: {
  variant?: ProductVariant;
  productName?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Free-form picker state (only used when no variant is pre-filled)
  const [search, setSearch] = useState("");
  const [pickedVariant, setPickedVariant] = useState<ProductVariant | null>(null);
  const [pickedProductName, setPickedProductName] = useState<string>("");

  // Transfer form state
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");

  // Reset everything when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearch("");
      setPickedVariant(null);
      setPickedProductName("");
      setFromId("");
      setToId("");
      setQty("1");
      setNote("");
    }
  }, [open]);

  const currentVariant = prefilledVariant ?? pickedVariant;
  const currentProductName = prefilledProductName ?? pickedProductName;
  const isFreeForm = !prefilledVariant;

  // Queries
  const { data: productsData } = useProducts(
    isFreeForm && !currentVariant ? { search: search || undefined, is_active: true, has_stock: true } : undefined
  );
  const { data: entries = [] } = useQuery({
    queryKey: ["stock-entries", { variant: currentVariant?.id }],
    queryFn: () =>
      axiosInstance
        .get<PaginatedResponse<StockEntry>>("/stock-entries/", { params: { variant: currentVariant!.id } })
        .then((r) => r.data.results),
    enabled: !!currentVariant?.id && open,
  });
  const { data: allLocations = [] } = useLocations();
  const transfer = useTransferStock();

  const locationsWithStock = entries.filter((e) => e.quantity > 0);
  const fromEntry = locationsWithStock.find((e) => e.location === fromId);
  const maxQty = fromEntry?.quantity ?? 0;
  const toLocations = allLocations.filter((l) => l.id !== fromId && l.isActive);

  const displayLabel = currentVariant
    ? currentVariant.isDefault
      ? currentProductName || t("common.default")
      : currentProductName
        ? `${currentProductName} — ${variantLabel(currentVariant.attributeValues)}`
        : variantLabel(currentVariant.attributeValues)
    : null;

  const handleSubmit = async () => {
    if (!currentVariant || !fromId || !toId) return;
    const quantity = parseInt(qty, 10);
    if (!quantity || quantity < 1 || quantity > maxQty) return;
    try {
      await transfer.mutateAsync({
        variantId: currentVariant.id,
        fromLocationId: fromId,
        toLocationId: toId,
        quantity,
        note: note || undefined,
      });
      toast.success(t("transferStockDialog.transferred"));
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("transferStockDialog.transferFailed");
      toast.error(msg);
    }
  };

  const canSubmit =
    !!currentVariant && !!fromId && !!toId &&
    parseInt(qty, 10) >= 1 && parseInt(qty, 10) <= maxQty &&
    !transfer.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("transferStockDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {/* Step 1: variant picker (free-form only) */}
          {isFreeForm && !currentVariant && (
            <>
              <TextField
                placeholder={t("transferStockDialog.searchProducts")}
                size="small"
                fullWidth
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              />
              <Box sx={{ maxHeight: 260, overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                <Stack divider={<Divider />}>
                  {(productsData?.results ?? []).map((p) => (
                    <ProductPickerRow key={p.id} product={p} onSelect={(v, pn) => {
                      setPickedVariant(v);
                      setPickedProductName(pn);
                    }} />
                  ))}
                </Stack>
              </Box>
            </>
          )}

          {/* Variant label + back button (free-form picked) */}
          {isFreeForm && currentVariant && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton size="small" onClick={() => {
                setPickedVariant(null);
                setFromId("");
                setToId("");
              }}>
                <ArrowBackIcon fontSize="small" />
              </IconButton>
              <Typography variant="body2" fontWeight="medium">{displayLabel}</Typography>
            </Stack>
          )}

          {/* Pre-filled variant label */}
          {!isFreeForm && (
            <Typography variant="body2" fontWeight="medium">{displayLabel}</Typography>
          )}

          {/* Step 2: transfer form (shown once variant is known) */}
          {currentVariant && (
            <>
              <Select
                size="small"
                displayEmpty
                value={fromId}
                onChange={(e) => { setFromId(e.target.value); setToId(""); }}
              >
                <MenuItem value="" disabled><em>{t("transferStockDialog.fromLocation")}</em></MenuItem>
                {locationsWithStock.map((e) => (
                  <MenuItem key={e.location} value={e.location}>
                    {e.locationName} ({e.quantity} units)
                  </MenuItem>
                ))}
              </Select>

              <Select
                size="small"
                displayEmpty
                disabled={!fromId}
                value={toId}
                onChange={(e) => setToId(e.target.value)}
              >
                <MenuItem value="" disabled><em>{t("transferStockDialog.toLocation")}</em></MenuItem>
                {toLocations.map((l) => (
                  <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                ))}
              </Select>

              <TextField
                label={t("transferStockDialog.quantity")}
                type="number"
                size="small"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                slotProps={{ htmlInput: { ...intQtyInputProps, min: 1, max: maxQty } }}
                helperText={fromId ? t("transferStockDialog.maxQty", { max: maxQty }) : " "}
              />

              <TextField
                label={t("transferStockDialog.noteOptional")}
                size="small"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          variant="contained"
          disabled={!canSubmit}
          onClick={handleSubmit}
          startIcon={<SwapHorizIcon />}
        >
          {t("transferStockDialog.transfer")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
