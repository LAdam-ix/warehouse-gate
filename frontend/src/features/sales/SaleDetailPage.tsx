import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { variantLabel } from "../../utils/variantLabel";
import {
  Box, Button, Chip, CircularProgress, Collapse, Divider, Grid, IconButton,
  InputAdornment, MenuItem, Paper, Select, Stack, TextField, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableHead, TableRow,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InventoryIcon from "@mui/icons-material/Inventory2";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { toast } from "react-toastify";
import {
  useSale, useUpdateSale, useFinalizeSale, useVoidSale,
  useAddSaleLine, useUpdateSaleLine, useDeleteSaleLine,
  useProducts, useProduct, useLocations,
} from "../../api/hooks";
import type { Location, Product, ProductVariant, SaleLine, SaleWrite } from "../../types/api";
import { useTranslation } from "react-i18next";

// ─── Catalog variant picker (reused in AddLineDialog) ─────────────────────────

function VariantPickerRows({
  productId,
  productName,
  itemType,
  servicePricing,
  hourlyRate,
  onSelect,
}: {
  productId: string;
  productName: string;
  itemType: string;
  servicePricing: string | null;
  hourlyRate: string | null;
  onSelect: (v: ProductVariant, label: string, itemType: string, servicePricing: string | null, hourlyRate: string | null) => void;
}) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useProduct(productId);
  if (isLoading) return <Box sx={{ p: 1.5 }}><CircularProgress size={16} /></Box>;
  if (!detail) return null;
  const active = detail.variants.filter((v) => v.isActive);
  return (
    <Stack divider={<Divider />}>
      {active.map((v) => {
        const label = v.isDefault
          ? productName
          : `${productName} — ${variantLabel(v.attributeValues)}`;
        const photoUrl = v.galleryPhotoUrl ?? v.photo ?? null;
        const colorHex = v.attributeValues.find((av) => av.colorHex)?.colorHex ?? null;
        return (
          <Stack key={v.id} direction="row" alignItems="center" spacing={1}
            sx={{ py: 0.75, px: 2, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
            onClick={() => onSelect(v, label, itemType, servicePricing, hourlyRate)}
          >
            {photoUrl && <Box component="img" src={photoUrl} sx={{ width: 28, height: 28, borderRadius: 0.5, objectFit: "cover" }} />}
            {!photoUrl && colorHex && <Box sx={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, bgcolor: colorHex }} />}
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>
              {v.isDefault ? t("variants.default") : variantLabel(v.attributeValues)}
            </Typography>
            <Typography variant="caption" color="primary">{t("common.select")}</Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

function CatalogProductRow({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: (v: ProductVariant, label: string, itemType: string, servicePricing: string | null, hourlyRate: string | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: detail } = useProduct(product.id);

  const handleSingleSelect = () => {
    const variant = detail?.variants.find((v) => v.isActive);
    if (variant) onSelect(variant, product.name, product.itemType, product.servicePricing, product.hourlyRate);
  };

  if (product.variantCount <= 1) {
    return (
      <Paper variant="outlined">
        <Stack direction="row" alignItems="center" spacing={1.5}
          sx={{ p: 1, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
          onClick={handleSingleSelect}
        >
          {product.primaryPhoto
            ? <Box component="img" src={product.primaryPhoto} sx={{ width: 32, height: 32, borderRadius: 0.5, objectFit: "cover", flexShrink: 0 }} />
            : <Box sx={{ width: 32, height: 32, bgcolor: "grey.100", borderRadius: 0.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <InventoryIcon sx={{ fontSize: 16, color: "grey.400" }} />
              </Box>
          }
          <Typography variant="body2" sx={{ flex: 1 }} noWrap>{product.name}</Typography>
          <Typography variant="caption" color="primary">{t("common.select")}</Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined">
      <Stack direction="row" alignItems="center" spacing={1.5}
        sx={{ p: 1, cursor: "pointer" }} onClick={() => setOpen((v) => !v)}
      >
        {product.primaryPhoto
          ? <Box component="img" src={product.primaryPhoto} sx={{ width: 32, height: 32, borderRadius: 0.5, objectFit: "cover", flexShrink: 0 }} />
          : <Box sx={{ width: 32, height: 32, bgcolor: "grey.100", borderRadius: 0.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <InventoryIcon sx={{ fontSize: 16, color: "grey.400" }} />
            </Box>
        }
        <Typography variant="body2" sx={{ flex: 1 }} noWrap>{product.name}</Typography>
        <Chip label={t("production.variants", { count: product.variantCount })} size="small" variant="outlined" />
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>
      <Collapse in={open}>
        <Divider />
        <VariantPickerRows productId={product.id} productName={product.name} itemType={product.itemType} servicePricing={product.servicePricing} hourlyRate={product.hourlyRate} onSelect={onSelect} />
      </Collapse>
    </Paper>
  );
}

// ─── Add line dialog ───────────────────────────────────────────────────────────

function AddLineDialog({
  saleId, open, onClose, locations,
}: {
  saleId: string; open: boolean; onClose: () => void; locations: Location[];
}) {
  const { t } = useTranslation();
  const addLine = useAddSaleLine(saleId);
  const [search, setSearch] = useState("");
  const { data: productsData, isLoading: loadingProducts } = useProducts({ search: search || undefined, is_active: true });

  const [selectedVariant, setSelectedVariant] = useState<{
    variant: ProductVariant;
    label: string;
    itemType: string;
    servicePricing: string | null;
    hourlyRate: string | null;
  } | null>(null);
  const defaultLocationId = locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? null;
  const [locationId, setLocationId] = useState<string | null>(defaultLocationId);
  const [form, setForm] = useState({
    quantity: "1",
    hours: "",
    unitPrice: "0.00",
  });

  const showLocationSelect = locations.length > 1;

  const handleVariantSelect = (variant: ProductVariant, label: string, itemType: string, servicePricing: string | null, hourlyRate: string | null) => {
    setSelectedVariant({ variant, label, itemType, servicePricing, hourlyRate });
    // For hourly services, pre-fill unit price with hourly rate
    const price = (servicePricing === "hourly" && hourlyRate) ? hourlyRate : (variant.effectivePrice ?? "0.00");
    setForm((f) => ({ ...f, unitPrice: price, hours: "", quantity: "1" }));
  };

  const handleSubmit = async () => {
    const isHourly = selectedVariant?.servicePricing === "hourly";
    const isFlat = selectedVariant?.servicePricing === "flat";
    const payload = isHourly && form.hours
      ? { hours: form.hours }
      : { quantity: isFlat ? "1" : form.quantity };
    await addLine.mutateAsync({
      variant: selectedVariant?.variant.id ?? null,
      description: selectedVariant?.label ?? "Manual line",
      ...payload,
      unitPrice: form.unitPrice,
      location: locationId,
      discountAmount: "0",
      discountNote: "",
    });
    toast.success(t("sales.addLineDialog.lineAdded"));
    setSelectedVariant(null);
    setSearch("");
    setForm({ quantity: "1", hours: "", unitPrice: "0.00" });
    onClose();
  };

  const products = productsData?.results ?? [];

  const isService = selectedVariant?.itemType === "service";
  const isHourly = selectedVariant?.servicePricing === "hourly";

  const showQuantity = !selectedVariant || (!isService);
  const showHours = isHourly;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t("sales.addItem")}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {/* Left: variant picker */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack spacing={1}>
              <TextField
                placeholder={t("sales.addLineDialog.searchProducts")}
                size="small"
                fullWidth
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              />
              {selectedVariant ? (
                <Paper variant="outlined" sx={{ p: 1, bgcolor: "primary.50" }}>
                  <Typography variant="body2" fontWeight="medium" noWrap>{selectedVariant.label}</Typography>
                  <Button size="small" sx={{ p: 0, minWidth: 0, textTransform: "none" }} onClick={() => setSelectedVariant(null)}>
                    {t("sales.addLineDialog.change")}
                  </Button>
                </Paper>
              ) : (
                <Box sx={{ maxHeight: 300, overflowY: "auto" }}>
                  {loadingProducts && <CircularProgress size={20} sx={{ mx: "auto", display: "block" }} />}
                  <Stack spacing={0.5}>
                    {products.map((p) => (
                      <CatalogProductRow key={p.id} product={p} onSelect={handleVariantSelect} />
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          </Grid>

          {/* Right: line details */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack spacing={1.5}>
              <Grid container spacing={1}>
                {showQuantity && (
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      label={t("sales.addLineDialog.quantity")}
                      type="number"
                      fullWidth
                      size="small"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      slotProps={{ htmlInput: { min: 0, step: "0.001" } }}
                    />
                  </Grid>
                )}
                {showHours && (
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      label={t("sales.addLineDialog.hoursOverride")}
                      type="number"
                      fullWidth
                      size="small"
                      value={form.hours}
                      onChange={(e) => setForm({ ...form, hours: e.target.value })}
                      slotProps={{ htmlInput: { min: 0, step: "0.25" } }}
                      helperText={isHourly && selectedVariant?.hourlyRate ? `€${selectedVariant.hourlyRate}/h` : t("sales.addLineDialog.hoursHelperText")}
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label={t("sales.addLineDialog.unitPrice")}
                    type="number"
                    fullWidth
                    size="small"
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                  />
                </Grid>
              </Grid>
              {showLocationSelect && (
                <Select
                  size="small"
                  fullWidth
                  displayEmpty
                  value={locationId ?? ""}
                  onChange={(e) => setLocationId(e.target.value || null)}
                >
                  <MenuItem value=""><em>{t("sales.addLineDialog.defaultLocation")}</em></MenuItem>
                  {locations.map((l) => (
                    <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                  ))}
                </Select>
              )}
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={addLine.isPending}>
          {t("sales.addLineDialog.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LineRow({ line, saleId, isDraft, locations }: { line: SaleLine; saleId: string; isDraft: boolean; locations: Location[] }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    unitPrice: line.unitPrice,
    location: line.location ?? "",
  });
  const update = useUpdateSaleLine(saleId, line.id);
  const remove = useDeleteSaleLine(saleId);
  const showLocationSelect = locations.length > 1;

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
        {editing ? (
          <TextField
            size="small"
            type="number"
            value={form.unitPrice}
            onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
            sx={{ width: 90 }}
            inputProps={{ step: "0.01" }}
          />
        ) : `€${line.unitPrice}`}
      </TableCell>
      <TableCell align="right">
        <Typography fontWeight="medium">€{line.lineTotal}</Typography>
        <Typography variant="caption" color="text.secondary">{t("sales.lineRow.lineCost", { cost: line.lineCost })}</Typography>
      </TableCell>
      {isDraft && (
        <TableCell align="right">
          {editing ? (
            <Stack spacing={0.5}>
              {showLocationSelect && (
                <Select
                  size="small"
                  displayEmpty
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value=""><em>{t("sales.lineRow.default")}</em></MenuItem>
                  {locations.map((l) => (
                    <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                  ))}
                </Select>
              )}
              <Stack direction="row" spacing={0.5}>
                <Button size="small" variant="contained" onClick={async () => {
                  await update.mutateAsync({
                    unitPrice: form.unitPrice,
                    location: form.location || null,
                  } as Partial<SaleLine>);
                  setEditing(false);
                }}>{t("common.save")}</Button>
                <Button size="small" onClick={() => setEditing(false)}>✕</Button>
              </Stack>
            </Stack>
          ) : (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <IconButton size="small" onClick={() => setEditing(true)}><EditIcon fontSize="small" /></IconButton>
              <IconButton size="small" color="error" onClick={() => remove.mutate(line.id)}><DeleteIcon fontSize="small" /></IconButton>
            </Stack>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

export default function SaleDetailPage() {
  const { t } = useTranslation();
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [noteValue, setNoteValue] = useState<string | null>(null);

  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);

  const { data: sale, isLoading } = useSale(saleId!);
  const { data: locations = [] } = useLocations();
  const updateSale = useUpdateSale(saleId!);
  const finalize = useFinalizeSale(saleId!);
  const voidSale = useVoidSale(saleId!);

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (!sale) return <Typography>{t("sales.saleNotFound")}</Typography>;

  const isDraft = sale.status === "draft";
  const marginPct = parseFloat(sale.total) > 0
    ? ((parseFloat(sale.profit) / parseFloat(sale.total)) * 100).toFixed(1)
    : "—";

  // Initialize noteValue from sale on first render
  const currentNoteValue = noteValue !== null ? noteValue : (sale.note ?? "");

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

  const leftPaperContent = isDraft ? (
    <TextField
      size="small"
      multiline
      maxRows={2}
      fullWidth
      label={t("common.note")}
      value={currentNoteValue}
      onChange={(e) => setNoteValue(e.target.value)}
      onBlur={handleNoteBlur}
    />
  ) : sale.note ? (
    <Box>
      <Typography variant="caption" color="text.secondary">{t("common.note")}</Typography>
      <Typography>{sale.note}</Typography>
    </Box>
  ) : null;

  return (
    <Stack spacing={2}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate("/sales")}><ArrowBackIcon /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight="bold">
            {t("sales.saleTitle")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("sales.created", { date: new Date(sale.createdAt).toLocaleString() })}
          </Typography>
        </Box>
        <Chip
          label={sale.status}
          color={sale.status === "finalized" ? "success" : sale.status === "voided" ? "default" : "warning"}
        />
      </Stack>

      {/* Actions */}
      {isDraft && (
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
      )}
      {sale.status === "finalized" && (
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => setVoidConfirmOpen(true)}>
            {t("sales.voidSale")}
          </Button>
        </Stack>
      )}

      {/* Details */}
      <Grid container spacing={2}>
        {leftPaperContent && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={0.5}>
                {leftPaperContent}
              </Stack>
            </Paper>
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: leftPaperContent ? 6 : 12 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={0.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">{t("sales.subtotal")}</Typography>
                <Typography>€{sale.subtotal}</Typography>
              </Stack>
              {parseFloat(sale.discountTotal) > 0 && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="warning.main">{t("sales.discounts")}</Typography>
                  <Typography color="warning.main">-€{sale.discountTotal}</Typography>
                </Stack>
              )}
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight="bold">{t("sales.total")}</Typography>
                <Typography fontWeight="bold">€{sale.total}</Typography>
              </Stack>
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">{t("sales.saleCost")}</Typography>
                <Typography color="text.secondary">€{sale.costTotal}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color={parseFloat(sale.profit) >= 0 ? "success.main" : "error.main"} fontWeight="bold">
                  {t("sales.saleProfit")}
                </Typography>
                <Typography color={parseFloat(sale.profit) >= 0 ? "success.main" : "error.main"} fontWeight="bold">
                  €{sale.profit} ({marginPct}%)
                </Typography>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Lines */}
      <Paper variant="outlined">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, pb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">{t("sales.linesTitle")}</Typography>
          {isDraft && (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>{t("sales.addItem")}</Button>
          )}
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("sales.description")}</TableCell>
              <TableCell align="right">{t("sales.qtyHours")}</TableCell>
              <TableCell align="right">{t("sales.unitPrice")}</TableCell>
              <TableCell align="right">{t("sales.total")}</TableCell>
              {isDraft && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {sale.lines.map((line) => (
              <LineRow key={line.id} line={line} saleId={saleId!} isDraft={isDraft} locations={locations} />
            ))}
            {sale.lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={isDraft ? 5 : 4} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {t("sales.noLinesYet")} {isDraft ? t("sales.addItemsToSale") : ""}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <AddLineDialog saleId={saleId!} open={addOpen} onClose={() => setAddOpen(false)} locations={locations} />

      {/* Void confirmation dialog */}
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
