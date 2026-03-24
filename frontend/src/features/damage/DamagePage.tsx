import { useState } from "react";
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Paper, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography, FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { toast } from "react-toastify";
import { useDamageReports, useCreateDamageReport, useLocations } from "../../api/hooks";
import { useTranslation } from "react-i18next";

function ReportDamageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: locations } = useLocations();
  const create = useCreateDamageReport();
  const [form, setForm] = useState({
    variantId: "",
    locationId: "",
    quantity: "1",
    reason: "",
    estimatedValueLost: "",
    reportDate: new Date().toISOString().slice(0, 16),
  });

  const handleSubmit = async () => {
    if (!form.variantId || !form.locationId || !form.reason) {
      toast.error(t("damage.reportDamageDialog.fillRequired"));
      return;
    }
    await create.mutateAsync({
      variant: form.variantId,
      location: form.locationId,
      quantity: Number(form.quantity),
      reason: form.reason,
      estimatedValueLost: form.estimatedValueLost || undefined,
      reportDate: new Date(form.reportDate).toISOString(),
    });
    toast.success(t("damage.reportDamageDialog.reported"));
    setForm({ variantId: "", locationId: "", quantity: "1", reason: "", estimatedValueLost: "", reportDate: new Date().toISOString().slice(0, 16) });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("damage.reportDamageDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t("damage.reportDamageDialog.variantId")}
            fullWidth
            size="small"
            value={form.variantId}
            onChange={(e) => setForm({ ...form, variantId: e.target.value })}
            placeholder={t("damage.reportDamageDialog.variantIdPlaceholder")}
          />
          <FormControl fullWidth size="small" required>
            <InputLabel>{t("damage.reportDamageDialog.locationRequired")}</InputLabel>
            <Select label={t("damage.reportDamageDialog.locationRequired")} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              {locations?.map((l) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            label={t("damage.reportDamageDialog.quantityRequired")}
            type="number"
            fullWidth
            size="small"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            inputProps={{ min: 1 }}
          />
          <TextField
            label={t("damage.reportDamageDialog.reasonRequired")}
            fullWidth
            multiline
            rows={2}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder={t("damage.reportDamageDialog.reasonPlaceholder")}
          />
          <TextField
            label={t("damage.reportDamageDialog.estimatedValueLost")}
            type="number"
            fullWidth
            size="small"
            value={form.estimatedValueLost}
            onChange={(e) => setForm({ ...form, estimatedValueLost: e.target.value })}
            helperText={t("damage.reportDamageDialog.estimatedValueHelper")}
            inputProps={{ min: 0, step: "0.01" }}
          />
          <TextField
            label={t("damage.reportDamageDialog.date")}
            type="datetime-local"
            fullWidth
            size="small"
            value={form.reportDate}
            onChange={(e) => setForm({ ...form, reportDate: e.target.value })}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" color="error" onClick={handleSubmit} disabled={create.isPending}>
          {t("damage.reportDamageDialog.reportButton")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DamagePage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useDamageReports();

  const totalLoss = data?.results?.reduce((sum, r) => sum + parseFloat(r.estimatedValueLost), 0) ?? 0;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" fontWeight="bold">{t("damage.title")}</Typography>
          {totalLoss > 0 && (
            <Typography variant="caption" color="error.main">
              {t("damage.totalLoss", { amount: totalLoss.toFixed(2) })}
            </Typography>
          )}
        </Box>
        <Button variant="contained" color="error" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          {t("damage.reportDamage")}
        </Button>
      </Stack>

      {isLoading && <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>}

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t("damage.date")}</TableCell>
              <TableCell>{t("damage.item")}</TableCell>
              <TableCell>{t("damage.location")}</TableCell>
              <TableCell align="right">{t("damage.qty")}</TableCell>
              <TableCell align="right">{t("damage.valueLost")}</TableCell>
              <TableCell>{t("damage.reason")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.results?.map((report) => (
              <TableRow key={report.id} hover>
                <TableCell>
                  <Typography variant="caption">{new Date(report.reportDate).toLocaleString()}</Typography>
                </TableCell>
                <TableCell>{report.variantName}</TableCell>
                <TableCell>{report.locationName}</TableCell>
                <TableCell align="right">{report.quantity}</TableCell>
                <TableCell align="right">
                  <Typography color="error.main">€{report.estimatedValueLost}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>{report.reason}</Typography>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && data?.results?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>{t("damage.noDamageReports")}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <ReportDamageDialog open={open} onClose={() => setOpen(false)} />
    </Stack>
  );
}
