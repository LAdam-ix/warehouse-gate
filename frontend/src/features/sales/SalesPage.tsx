import { useState } from "react";
import {
  Box, Button, Chip, CircularProgress, FormControl, IconButton, InputLabel,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate } from "react-router-dom";
import { useSales, useCreateSale, useDeleteSaleById } from "../../api/hooks";
import { useConfirm } from "../../components/ConfirmDialog";
import { useTranslation } from "react-i18next";
import { navLinkProps } from "../../utils/navLink";

const STATUS_COLORS: Record<string, "warning" | "success" | "default" | "error" | "info"> = {
  draft: "warning",
  pending_review: "info",
  finalized: "success",
  voided: "error",
  discarded: "default",
  refunded: "info",
};

export default function SalesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createSale = useCreateSale();
  const deleteSale = useDeleteSaleById();
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = useState("");
  const { data, isLoading } = useSales(statusFilter ? { status: statusFilter } : undefined);

  const handleDelete = async (saleId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!await confirm(t("sales.deleteConfirm"), { title: t("sales.deleteTitle"), confirmLabel: t("common.delete") })) return;
    await deleteSale.mutateAsync(saleId);
  };
  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" fontWeight="bold">{t("sales.title")}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={createSale.isPending}
          onClick={async () => {
            const sale = await createSale.mutateAsync({});
            navigate(`/sales/${sale.id}`);
          }}
        >
          {t("sales.newSale")}
        </Button>
      </Stack>

      <FormControl size="small" sx={{ maxWidth: 180 }}>
        <InputLabel>{t("sales.statusFilter")}</InputLabel>
        <Select label={t("sales.statusFilter")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <MenuItem value="">{t("sales.all")}</MenuItem>
          <MenuItem value="draft">{t("sales.draft")}</MenuItem>
          <MenuItem value="finalized">{t("sales.finalized")}</MenuItem>
          <MenuItem value="voided">{t("sales.voided")}</MenuItem>
          <MenuItem value="discarded">{t("sales.discarded")}</MenuItem>
          <MenuItem value="refunded">{t("sales.refunded")}</MenuItem>
        </Select>
      </FormControl>

      {isLoading && <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>}

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t("sales.statusFilter")}</TableCell>
              <TableCell>{t("sales.noteColumn")}</TableCell>
              <TableCell align="right">{t("sales.lines")}</TableCell>
              <TableCell align="right">{t("sales.total")}</TableCell>
              <TableCell align="right">{t("sales.profit")}</TableCell>
              <TableCell>{t("sales.date")}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.results?.map((sale) => (
              <TableRow
                key={sale.id}
                hover
                {...navLinkProps(`/sales/${sale.id}`, navigate)}
                sx={{ cursor: "pointer" }}
              >
                <TableCell>
                  <Chip
                    label={sale.status}
                    size="small"
                    color={STATUS_COLORS[sale.status]}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                    {sale.note || <Typography component="span" color="text.secondary">—</Typography>}
                  </Typography>
                </TableCell>
                <TableCell align="right">{sale.lineCount}</TableCell>
                <TableCell align="right">€{sale.total}</TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    color={parseFloat(sale.profit) >= 0 ? "success.main" : "error.main"}
                    fontWeight="medium"
                  >
                    €{sale.profit}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {sale.finalizedAt
                      ? new Date(sale.finalizedAt).toLocaleDateString()
                      : new Date(sale.createdAt).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell sx={{ width: 40, p: 0.5 }}>
                  {(sale.status === "voided" || sale.status === "discarded") && (
                    <IconButton size="small" onClick={(e) => handleDelete(sale.id, e)} disabled={deleteSale.isPending}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && data?.results?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {t("sales.noSalesYet")}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
