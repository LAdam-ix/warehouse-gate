import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Button, Chip, CircularProgress, Divider, Grid, IconButton,
  InputAdornment, MenuItem, Paper, Select, Stack, TextField, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableHead, TableRow,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { toast } from "react-toastify";
import {
  useSale, useUpdateSale, useFinalizeSale, useVoidSale, useDeleteSale,
  useAddSaleLine, useUpdateSaleLine, useDeleteSaleLine,
  useLocations, useStockEntries, useWarehouseSettings,
} from "../../api/hooks";
import type { Location, SaleLine, SaleWrite, StockEntry } from "../../types/api";
import { intQtyInputProps } from "../../utils/form";
import ProductPickerPanel, { type ProductPickerSelectFn } from "../../components/ProductPickerPanel";
import { useTranslation } from "react-i18next";

// ─── Cart line row (draft mode — always editable) ─────────────────────────────

const noSpinnerSx = {
  "& input[type=number]::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 },
  "& input[type=number]::-webkit-outer-spin-button": { WebkitAppearance: "none", margin: 0 },
  "& input[type=number]": { MozAppearance: "textfield" },
} as const;

function CartLineRow({ line, saleId, locations }: { line: SaleLine; saleId: string; locations: Location[] }) {
  const { t } = useTranslation();
  const isHourly = line.hours != null;
  const [qty, setQty] = useState(isHourly ? String(line.hours) : String(parseFloat(line.quantity)));
  const [unitPrice, setUnitPrice] = useState(line.unitPrice);
  const [discountAmount, setDiscountAmount] = useState(line.discountAmount ?? "0");
  const [discountNote, setDiscountNote] = useState(line.discountNote ?? "");
  const [locationId, setLocationId] = useState(line.location ?? "");
  const [discountOpen, setDiscountOpen] = useState(parseFloat(line.discountAmount ?? "0") > 0);

  const update = useUpdateSaleLine(saleId, line.id);
  const remove = useDeleteSaleLine(saleId);
  const showLocations = locations.length > 1;

  const { data: stockEntries } = useStockEntries(
    { variant: line.variant ?? "" },
    { enabled: !!line.variant && showLocations },
  );
  const stockByLocation = (locId: string): number | null => {
    if (!stockEntries) return null;
    return (stockEntries as StockEntry[]).find((e) => e.location === locId)?.quantity ?? 0;
  };

  const save = (patch: { qty?: string; unitPrice?: string; discountAmount?: string; discountNote?: string; locationId?: string } = {}) => {
    const q = patch.qty ?? qty;
    const p = patch.unitPrice ?? unitPrice;
    const da = patch.discountAmount ?? discountAmount;
    const dn = patch.discountNote ?? discountNote;
    const loc = patch.locationId ?? locationId;
    update.mutate({
      ...(isHourly ? { hours: q } : { quantity: q }),
      unitPrice: p,
      discountAmount: da,
      discountNote: dn,
      location: loc || null,
    } as Partial<SaleLine>);
  };

  const handleQtyStep = (delta: number) => {
    const next = String(Math.max(isHourly ? 0.25 : 1, parseFloat(qty || "1") + delta));
    setQty(next);
    save({ qty: next });
  };

  const handleLocationChange = (v: string) => {
    setLocationId(v);
    save({ locationId: v });
  };

  const handleRemoveDiscount = () => {
    setDiscountOpen(false);
    setDiscountAmount("0");
    setDiscountNote("");
    save({ discountAmount: "0", discountNote: "" });
  };

  return (
    <Box sx={{ px: 1.5, py: 1 }}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        {/* Label */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap fontWeight="medium">{line.description}</Typography>
          {line.variantName && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
              {line.variantName}
            </Typography>
          )}
        </Box>

        {/* Location */}
        {showLocations && (
          <Select
            size="small"
            value={locationId}
            onChange={(e) => handleLocationChange(e.target.value)}
            displayEmpty
            sx={{ minWidth: 88, fontSize: "0.78rem", "& .MuiSelect-select": { py: 0.5, px: 1 } }}
          >
            <MenuItem value="" sx={{ fontSize: "0.78rem" }}><em>{t("sales.lineRow.default")}</em></MenuItem>
            {locations.map((l) => {
              const stock = stockByLocation(l.id);
              return (
                <MenuItem key={l.id} value={l.id} sx={{ fontSize: "0.78rem" }}>
                  {l.name}
                  {stock !== null && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      ({stock})
                    </Typography>
                  )}
                </MenuItem>
              );
            })}
          </Select>
        )}

        {/* Qty / Hours */}
        <Stack direction="row" alignItems="center" sx={{ flexShrink: 0 }}>
          <IconButton size="small" onClick={() => handleQtyStep(-1)}>
            <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: "error.light" }} />
          </IconButton>
          <TextField
            size="small"
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={() => save()}
            sx={{ width: 50, ...noSpinnerSx }}
            slotProps={{
              htmlInput: {
                ...(isHourly ? { step: "0.25", min: "0.25" } : { ...intQtyInputProps, min: "1" }),
                style: { textAlign: "center", padding: "4px 6px" },
              },
            }}
          />
          <IconButton size="small" onClick={() => handleQtyStep(1)}>
            <AddCircleOutlineIcon sx={{ fontSize: 18, color: "success.main" }} />
          </IconButton>
        </Stack>

        {/* Unit price */}
        <TextField
          size="small"
          type="number"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          onBlur={() => save()}
          sx={{ width: 92, ...noSpinnerSx }}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start" sx={{ mr: 0.25 }}>€</InputAdornment> },
            htmlInput: { step: "0.01", min: "0", style: { padding: "4px 6px" } },
          }}
        />

        {/* Line total */}
        <Typography variant="body2" sx={{ minWidth: 60, textAlign: "right", flexShrink: 0 }} fontWeight="bold">
          €{line.lineTotal}
        </Typography>

        {/* Delete */}
        <IconButton size="small" onClick={() => remove.mutate(line.id)}>
          <DeleteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>

      {/* Discount toggle */}
      <Box sx={{ pl: 0.25, mt: 0.25 }}>
        {!discountOpen ? (
          <Button
            size="small"
            onClick={() => setDiscountOpen(true)}
            sx={{ p: 0, minWidth: 0, textTransform: "none", fontSize: "0.72rem", color: "text.disabled", "&:hover": { color: "text.secondary", bgcolor: "transparent" } }}
          >
            + {t("sales.addDiscount")}
          </Button>
        ) : (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <TextField
              label={t("sales.addLineDialog.discountEuro")}
              size="small"
              type="number"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              onBlur={() => save()}
              sx={{ width: 112, ...noSpinnerSx }}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">€</InputAdornment> },
                htmlInput: { step: "0.01", min: "0" },
              }}
            />
            <TextField
              label={t("sales.addLineDialog.discountNote")}
              size="small"
              value={discountNote}
              onChange={(e) => setDiscountNote(e.target.value)}
              onBlur={() => save()}
              sx={{ flex: 1 }}
              placeholder={t("sales.addLineDialog.discountNotePlaceholder")}
            />
            <IconButton size="small" onClick={handleRemoveDiscount}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

// ─── Read-only line row (finalized / voided view) ─────────────────────────────

function ReadOnlyLineRow({ line }: { line: SaleLine }) {
  const { t } = useTranslation();
  return (
    <TableRow>
      <TableCell>
        <Typography variant="body2">{line.description}</Typography>
        {line.variantName && <Typography variant="caption" color="text.secondary">{line.variantName}</Typography>}
        {line.locationName && <Typography variant="caption" color="text.disabled" sx={{ display: "block" }}>{line.locationName}</Typography>}
      </TableCell>
      <TableCell align="right">
        {line.hours != null ? `${line.hours}h` : `×${line.quantity}`}
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2">€{line.unitPrice}</Typography>
        {parseFloat(line.discountAmount ?? "0") > 0 && (
          <Typography variant="caption" color="warning.main" sx={{ display: "block" }}>
            -{t("sales.discount")} €{line.discountAmount}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        <Typography fontWeight="medium">€{line.lineTotal}</Typography>
        <Typography variant="caption" color="text.secondary">{t("sales.lineRow.lineCost", { cost: line.lineCost })}</Typography>
      </TableCell>
    </TableRow>
  );
}

// ─── Sale-level discount (local state, saves on blur) ────────────────────────

function SaleDiscountFields({ sale, onSave }: { sale: { discountPercentage: string; discountFixed: string }; onSave: (data: { discountPercentage?: string; discountFixed?: string }) => void }) {
  const { t } = useTranslation();
  const [pct, setPct] = useState(sale.discountPercentage === "0.00" ? "" : sale.discountPercentage);
  const [fixed, setFixed] = useState(sale.discountFixed === "0.00" ? "" : sale.discountFixed);

  const savePct = () => { const v = pct.trim() || "0"; if (v !== sale.discountPercentage) onSave({ discountPercentage: v }); };
  const saveFixed = () => { const v = fixed.trim() || "0"; if (v !== sale.discountFixed) onSave({ discountFixed: v }); };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        size="small" type="number"
        label={t("sales.discountPercent")}
        placeholder="0"
        value={pct}
        onChange={(e) => setPct(e.target.value)}
        onBlur={savePct}
        onKeyDown={(e) => { if (e.key === "Enter") savePct(); }}
        slotProps={{ htmlInput: { step: "0.01", min: 0, max: 100 }, inputLabel: { shrink: true } }}
        sx={{ width: 110, ...noSpinnerSx }}
      />
      <TextField
        size="small" type="number"
        label={t("sales.discountFixedLabel")}
        placeholder="0"
        value={fixed}
        onChange={(e) => setFixed(e.target.value)}
        onBlur={saveFixed}
        onKeyDown={(e) => { if (e.key === "Enter") saveFixed(); }}
        slotProps={{ htmlInput: { step: "0.01", min: 0 }, inputLabel: { shrink: true } }}
        InputProps={{ startAdornment: <InputAdornment position="start">€</InputAdornment> }}
        sx={{ width: 120, ...noSpinnerSx }}
      />
    </Stack>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SaleDetailPage() {
  const { t } = useTranslation();
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();

  const [noteValue, setNoteValue] = useState<string | null>(null);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);

  const { data: sale, isLoading } = useSale(saleId!);
  const { data: locations = [] } = useLocations();
  const { data: settings } = useWarehouseSettings();

  const updateSale = useUpdateSale(saleId!);
  const finalize = useFinalizeSale(saleId!);
  const voidSale = useVoidSale(saleId!);
  const deleteSale = useDeleteSale(saleId!);
  const addLine = useAddSaleLine(saleId!);

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (!sale) return <Typography>{t("sales.saleNotFound")}</Typography>;

  const isDraft = sale.status === "draft";
  const marginPct = parseFloat(sale.total) > 0
    ? ((parseFloat(sale.profit) / parseFloat(sale.total)) * 100).toFixed(1)
    : "—";

  const currentNoteValue = noteValue !== null ? noteValue : (sale.note ?? "");
  const defaultLocationId = locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? null;

  // TODO: Same product from different locations creates separate lines (for stock tracking).
  // When generating an invoice, merge lines with the same variant into one invoice line
  // (customer doesn't care which location it came from, only total quantity × price).
  const handleAddLine: ProductPickerSelectFn = async (variant, label, product, qty = 1) => {
    if (addLine.isPending) return;
    const isHourly = product.servicePricing === "hourly";
    const price = (isHourly && product.hourlyRate) ? product.hourlyRate : (variant.effectivePrice ?? "0.00");
    await addLine.mutateAsync({
      variant: variant.id,
      description: label,
      ...(isHourly ? { hours: String(qty) } : { quantity: String(qty) }),
      unitPrice: price,
      location: defaultLocationId,
      discountAmount: "0",
      discountNote: "",
    });
  };

  const handleFinalize = async () => {
    try {
      await finalize.mutateAsync();
      toast.success(t("sales.saleFinalized"));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("sales.failedToFinalize");
      toast.error(msg);
    }
  };

  const handleVoid = async () => {
    try {
      if (sale.status === "draft" && sale.lines.length === 0) {
        await deleteSale.mutateAsync();
        navigate("/sales", { replace: true });
        return;
      }
      await voidSale.mutateAsync();
      toast.success(sale.status === "finalized" ? t("sales.saleVoided") : t("sales.saleDiscarded"));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("sales.failedToVoid");
      toast.error(msg);
    } finally {
      setVoidConfirmOpen(false);
    }
  };

  const handleNoteBlur = async () => {
    if (noteValue !== null && noteValue !== (sale.note ?? "")) {
      await updateSale.mutateAsync({ note: noteValue } as Partial<SaleWrite>);
    }
  };

  const totalsContent = (
    <Stack spacing={0.5}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">{t("sales.subtotal")}</Typography>
        <Typography variant="body2">€{sale.subtotal}</Typography>
      </Stack>
      {parseFloat(sale.discountTotal) > 0 && (
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="warning.main">{t("sales.discounts")}</Typography>
          <Typography variant="body2" color="warning.main">-€{sale.discountTotal}</Typography>
        </Stack>
      )}
      <Stack direction="row" justifyContent="space-between">
        <Typography fontWeight="bold">{t("sales.total")}</Typography>
        <Typography fontWeight="bold">€{sale.total}</Typography>
      </Stack>
      <Divider />
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">{t("sales.saleCost")}</Typography>
        <Typography variant="body2" color="text.secondary">€{sale.costTotal}</Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between">
        <Typography
          variant="body2"
          color={parseFloat(sale.profit) >= 0 ? "success.main" : "error.main"}
          fontWeight="bold"
        >
          {t("sales.saleProfit")}
        </Typography>
        <Typography
          variant="body2"
          color={parseFloat(sale.profit) >= 0 ? "success.main" : "error.main"}
          fontWeight="bold"
        >
          €{sale.profit} ({marginPct}%)
        </Typography>
      </Stack>
    </Stack>
  );

  return (
    <Stack spacing={2}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={async () => {
          if (isDraft && sale.lines.length === 0 && !sale.note?.trim()) {
            await deleteSale.mutateAsync();
          }
          navigate("/sales");
        }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight="bold">{t("sales.saleTitle")}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t("sales.created", { date: new Date(sale.createdAt).toLocaleString() })}
          </Typography>
        </Box>
        <Chip
          label={sale.status}
          color={sale.status === "finalized" ? "success" : sale.status === "voided" ? "default" : "warning"}
        />
      </Stack>

      {/* ── Draft: cart layout ── */}
      {isDraft && (
        <Grid container spacing={2}>
          {/* Left: product picker */}
          <Grid size={{ xs: 12, sm: 5 }}>
            <ProductPickerPanel
              onSelect={handleAddLine}
              showStock
              quickAmounts={[1, 5]}
              filterFn={settings?.warehouseMode === "strict"
                ? (p) => p.itemType === "service" || p.totalStock > 0
                : undefined}
            />
          </Grid>

          {/* Right: cart + note + totals + actions */}
          <Grid size={{ xs: 12, sm: 7 }}>
            <Stack spacing={2}>
              {/* Cart */}
              <Paper variant="outlined">
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
                  <Typography variant="subtitle2" fontWeight="bold">{t("sales.linesTitle")}</Typography>
                  {addLine.isPending && <CircularProgress size={14} />}
                </Stack>
                {sale.lines.length === 0 ? (
                  <Box sx={{ px: 1.5, pb: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("sales.noLinesYet")} {t("sales.addItemsToSale")}
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {/* Column headers */}
                    <Stack direction="row" spacing={0.75} alignItems="center"
                      sx={{ px: 1.5, py: 0.5, bgcolor: "grey.50", borderTop: 1, borderBottom: 1, borderColor: "divider" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{t("sales.description")}</Typography>
                      {locations.length > 1 && (
                        <Typography variant="caption" color="text.secondary" sx={{ width: 88 }}>{t("common.location")}</Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ width: 114, textAlign: "center" }}>{t("sales.qtyHours")}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ width: 92, textAlign: "right" }}>{t("sales.unitPrice")}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60, textAlign: "right" }}>{t("sales.total")}</Typography>
                      <Box sx={{ width: 34, flexShrink: 0 }} />
                    </Stack>
                    <Stack divider={<Divider />}>
                      {sale.lines.map((line) => (
                        <CartLineRow key={line.id} line={line} saleId={saleId!} locations={locations} />
                      ))}
                    </Stack>
                  </>
                )}
              </Paper>

              {/* Note */}
              <TextField
                size="small"
                multiline
                maxRows={3}
                fullWidth
                label={t("common.note")}
                value={currentNoteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                onBlur={handleNoteBlur}
              />

              {/* Sale-level discount */}
              <SaleDiscountFields sale={sale} onSave={(data) => updateSale.mutate(data)} />

              {/* Totals */}
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                {totalsContent}
              </Paper>

              {/* Actions */}
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleFinalize}
                  disabled={finalize.isPending || sale.lines.length === 0}
                >
                  {t("sales.finalizeSale")}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => setVoidConfirmOpen(true)}
                >
                  {t("sales.discard")}
                </Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* ── Finalized / voided: summary view ── */}
      {!isDraft && (
        <>
          {sale.status === "finalized" && (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => setVoidConfirmOpen(true)}>
                {t("sales.voidSale")}
              </Button>
            </Stack>
          )}

          <Grid container spacing={2}>
            {sale.note && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">{t("common.note")}</Typography>
                  <Typography>{sale.note}</Typography>
                </Paper>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: sale.note ? 6 : 12 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                {totalsContent}
              </Paper>
            </Grid>
          </Grid>

          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("sales.description")}</TableCell>
                  <TableCell align="right">{t("sales.qtyHours")}</TableCell>
                  <TableCell align="right">{t("sales.unitPrice")}</TableCell>
                  <TableCell align="right">{t("sales.total")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sale.lines.map((line) => (
                  <ReadOnlyLineRow key={line.id} line={line} />
                ))}
                {sale.lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        {t("sales.noLinesYet")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* Void / discard confirmation */}
      <Dialog open={voidConfirmOpen} onClose={() => setVoidConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {sale.status === "finalized" ? t("sales.voidDialog.voidFinalizedTitle") : t("sales.voidDialog.discardTitle")}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {sale.status === "finalized"
              ? t("sales.voidDialog.voidFinalizedBody")
              : t("sales.voidDialog.discardBody")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoidConfirmOpen(false)}>{t("common.cancel")}</Button>
          <Button variant="contained" color="error" disabled={voidSale.isPending} onClick={handleVoid}>
            {sale.status === "finalized" ? t("sales.voidDialog.voidSaleButton") : t("sales.voidDialog.discardButton")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
