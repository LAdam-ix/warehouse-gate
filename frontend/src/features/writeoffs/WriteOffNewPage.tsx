import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button, Chip, Collapse, Divider,
  FormControl, Grid, IconButton, InputLabel,
  MenuItem, Paper, Select, Stack, TextField, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { toast } from "react-toastify";
import { useLocations, useCreateDamageReport, useStockEntries } from "../../api/hooks";
import ProductPickerPanel from "../../components/ProductPickerPanel";
import { useTranslation } from "react-i18next";

interface WriteOffLine {
  id: string;
  variantId: string;
  variantLabel: string;
  locationId: string;
  quantity: number;
  reason: string;
  customReason: string;
  note: string;
  noteOpen: boolean;
}

// ─── Compact cart line (inline, no nested Paper) ─────────────────────────────

function CartLine({
  line,
  locations,
  reasons,
  otherLabel,
  onChange,
  onRemove,
}: {
  line: WriteOffLine;
  locations: Array<{ id: string; name: string; isDefault: boolean }>;
  reasons: string[];
  otherLabel: string;
  onChange: (id: string, patch: Partial<WriteOffLine>) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { data: stockEntries } = useStockEntries({ variant: line.variantId, page_size: 100 });
  const stockByLocation = Object.fromEntries(
    (stockEntries ?? []).map((e) => [e.location, e.quantity])
  );
  const maxQty = line.locationId ? (stockByLocation[line.locationId] ?? 999) : 999;
  const showLocations = locations.length > 1;

  return (
    <Stack spacing={0.75} sx={{ py: 1 }}>
      {/* Row 1: name + location + qty + remove */}
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Typography variant="body2" fontWeight="medium" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {line.variantLabel}
        </Typography>
        {showLocations && (
          <Select
            size="small"
            value={line.locationId}
            onChange={(e) => onChange(line.id, { locationId: e.target.value, quantity: 1 })}
            sx={{ fontSize: "0.75rem", minWidth: 90, "& .MuiSelect-select": { py: 0.5 } }}
            renderValue={(v) => locations.find((l) => l.id === v)?.name ?? ""}
          >
            {locations
              .filter((l) => !stockEntries || (stockByLocation[l.id] ?? 0) > 0)
              .map((l) => (
                <MenuItem key={l.id} value={l.id} sx={{ fontSize: "0.85rem" }}>
                  {l.name}
                  {stockEntries && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({stockByLocation[l.id] ?? 0})
                    </Typography>
                  )}
                </MenuItem>
              ))}
          </Select>
        )}
        <IconButton size="small" onClick={() => onChange(line.id, { quantity: Math.max(1, line.quantity - 1) })}>
          <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: "error.light" }} />
        </IconButton>
        <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 20, textAlign: "center" }}>
          {line.quantity}
        </Typography>
        <IconButton size="small" onClick={() => onChange(line.id, { quantity: Math.min(maxQty, line.quantity + 1) })}>
          <AddCircleOutlineIcon sx={{ fontSize: 18, color: "success.main" }} />
        </IconButton>
        <IconButton size="small" onClick={() => onRemove(line.id)}>
          <DeleteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>

      {/* Row 2: reason */}
      <FormControl size="small" fullWidth required>
        <InputLabel>{t("writeoffs.newPage.reasonRequired")}</InputLabel>
        <Select
          label={t("writeoffs.newPage.reasonRequired")}
          value={line.reason}
          onChange={(e) => onChange(line.id, { reason: e.target.value })}
        >
          {reasons.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </Select>
      </FormControl>

      {/* Row 2b: custom reason (when "Other" selected) */}
      {line.reason === otherLabel && (
        <TextField
          size="small"
          placeholder={t("writeoffs.newPage.describeReason")}
          value={line.customReason}
          onChange={(e) => onChange(line.id, { customReason: e.target.value })}
          fullWidth
        />
      )}

      {/* Row 3: add note link (below reason) */}
      {!line.noteOpen && !line.note && (
        <Button
          size="small"
          variant="text"
          sx={{ alignSelf: "flex-start", px: 0, py: 0.25, textTransform: "none", color: "text.secondary", fontSize: "0.78rem" }}
          onClick={() => onChange(line.id, { noteOpen: true })}
        >
          {t("writeoffs.newPage.noteToggle")}
        </Button>
      )}

      {/* Row 3: note (collapsed by default) */}
      <Collapse in={line.noteOpen || !!line.note}>
        <TextField
          size="small"
          placeholder={t("writeoffs.newPage.notePlaceholder")}
          value={line.note}
          onChange={(e) => onChange(line.id, { note: e.target.value })}
          fullWidth
          sx={{ "& .MuiInputBase-input": { fontSize: "0.8rem", py: 0.75 } }}
        />
      </Collapse>
    </Stack>
  );
}

// ─── Write-off new page ───────────────────────────────────────────────────────

export default function WriteOffNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cart, setCart] = useState<WriteOffLine[]>([]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 16));

  const { data: locations } = useLocations();
  const create = useCreateDamageReport();

  const otherLabel = t("writeoffs.newPage.reasons.other");
  const REASONS = [
    t("writeoffs.newPage.reasons.printFailure"),
    t("writeoffs.newPage.reasons.damagedHandling"),
    t("writeoffs.newPage.reasons.lostMissing"),
    t("writeoffs.newPage.reasons.qualityReject"),
    t("writeoffs.newPage.reasons.expiredUnusable"),
    t("writeoffs.newPage.reasons.sampleGiveaway"),
    otherLabel,
  ];

  const defaultLocationId =
    locations?.find((l) => l.isDefault)?.id ?? locations?.[0]?.id ?? "";

  const handleAdd: import("../../components/ProductPickerPanel").ProductPickerSelectFn = (v, label, _product, qty = 1) => {
    setCart((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        variantId: v.id,
        variantLabel: label,
        locationId: defaultLocationId,
        quantity: qty,
        reason: "",
        customReason: "",
        note: "",
        noteOpen: false,
      },
    ]);
  };

  const handleChange = (id: string, patch: Partial<WriteOffLine>) => {
    setCart((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l));
  };

  const handleRemove = (id: string) => {
    setCart((prev) => prev.filter((l) => l.id !== id));
  };

  const canSubmit =
    cart.length > 0 &&
    cart.every((l) => {
      const finalReason = l.reason === otherLabel ? l.customReason.trim() : l.reason;
      return l.locationId && finalReason;
    });

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error(t("writeoffs.newPage.fillRequired"));
      return;
    }
    const batchId = crypto.randomUUID();
    await Promise.all(
      cart.map((line) => {
        const finalReason = line.reason === otherLabel ? line.customReason : line.reason;
        return create.mutateAsync({
          variant: line.variantId,
          location: line.locationId,
          quantity: line.quantity,
          reason: finalReason,
          note: line.note || undefined,
          reportDate: new Date(reportDate).toISOString(),
          batchId,
        });
      })
    );
    toast.success(t("writeoffs.newPage.recorded"));
    navigate("/writeoffs");
  };

  const totalUnits = cart.reduce((s, l) => s + l.quantity, 0);

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate("/writeoffs")}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" fontWeight="bold" sx={{ flex: 1 }}>{t("writeoffs.newPage.title")}</Typography>
      </Stack>

      <Grid container spacing={2}>
        {/* Left — catalog picker */}
        <Grid size={{ xs: 12, md: 7 }}>
          <ProductPickerPanel
            onSelect={handleAdd}
            queryParams={{ item_type: "physical", has_stock: true }}
            showStock
            hideZeroStock
            quickAmounts={[1, 5]}
            autoFocus
            emptyMessage={t("writeoffs.newPage.noPhysicalItems")}
            noMatchMessage={t("writeoffs.newPage.noProductsMatch")}
          />
        </Grid>

        {/* Right — cart */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper variant="outlined" sx={{ p: 2, position: "sticky", top: 16 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
                {t("writeoffs.newPage.toWriteOff")}
              </Typography>
              {totalUnits > 0 && (
                <Chip label={`${totalUnits} units`} size="small" color="error" />
              )}
            </Stack>

            {cart.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("writeoffs.newPage.selectVariant")}
              </Typography>
            ) : (
              <Stack divider={<Divider />}>
                {cart.map((line) => (
                  <CartLine
                    key={line.id}
                    line={line}
                    locations={locations ?? []}
                    reasons={REASONS}
                    otherLabel={otherLabel}
                    onChange={handleChange}
                    onRemove={handleRemove}
                  />
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 1.5 }} />

            <Stack spacing={1.5}>
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
                disabled={!canSubmit || create.isPending}
                fullWidth
              >
                {cart.length <= 1
                  ? t("writeoffs.newPage.recordButton")
                  : t("writeoffs.newPage.recordButtonCount", { count: cart.length })}
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
