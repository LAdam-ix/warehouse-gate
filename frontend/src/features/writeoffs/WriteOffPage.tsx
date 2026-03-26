import {
  Box, Button, CircularProgress, Paper, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate } from "react-router-dom";
import { useDamageReports } from "../../api/hooks";
import { useTranslation } from "react-i18next";
import { navLinkProps } from "../../utils/navLink";

export default function WriteOffPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useDamageReports();

  const totalLoss = data?.results?.reduce((sum, r) => sum + parseFloat(r.estimatedValueLost), 0) ?? 0;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" fontWeight="bold">{t("writeoffs.title")}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t("writeoffs.subtitle")}
          </Typography>
          {totalLoss > 0 && (
            <Typography variant="caption" color="error.main" display="block">
              {t("writeoffs.totalLoss", { amount: totalLoss.toFixed(2) })}
            </Typography>
          )}
        </Box>
        <Button variant="contained" color="error" startIcon={<AddIcon />} {...navLinkProps("/writeoffs/new", navigate)}>
          {t("writeoffs.recordWriteOff")}
        </Button>
      </Stack>

      {isLoading && <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>}

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t("writeoffs.date")}</TableCell>
              <TableCell>{t("writeoffs.item")}</TableCell>
              <TableCell>{t("writeoffs.location")}</TableCell>
              <TableCell align="right">{t("writeoffs.qty")}</TableCell>
              <TableCell align="right">{t("writeoffs.valueLost")}</TableCell>
              <TableCell>{t("writeoffs.reason")}</TableCell>
              <TableCell>{t("writeoffs.note")}</TableCell>
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
                  <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>{report.reason}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>{report.note}</Typography>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && data?.results?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>{t("writeoffs.noWriteOffs")}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

    </Stack>
  );
}
