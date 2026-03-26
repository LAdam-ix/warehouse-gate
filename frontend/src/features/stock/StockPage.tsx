import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Button, Chip, CircularProgress, Collapse, Divider, IconButton, Paper,
  MenuItem, Stack, Typography,
  FormControl, InputLabel, Select,
  Table, TableBody, TableCell, TableHead, TableRow,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import AddIcon from "@mui/icons-material/Add";
import UndoIcon from "@mui/icons-material/Undo";
import { toast } from "react-toastify";
import { useLocations, useStockMovements, useRevertMovement } from "../../api/hooks";
import { useConfirm } from "../../components/ConfirmDialog";
import type { StockMovement } from "../../types/api";
import { useTranslation } from "react-i18next";
import { navLinkProps } from "../../utils/navLink";

const REVERTABLE_TYPES = new Set(["produced", "adjustment", "transfer_out", "transfer_in"]);

// ─── Movement log grouping ────────────────────────────────────────────────────

interface MovementGroup {
  batchId: string | null;
  movements: StockMovement[];
}

function groupMovements(movements: StockMovement[]): MovementGroup[] {
  const groups: MovementGroup[] = [];
  const batchMap = new Map<string, MovementGroup>();

  for (const m of movements) {
    if (m.batchId) {
      const existing = batchMap.get(m.batchId);
      if (existing) {
        existing.movements.push(m);
      } else {
        const g: MovementGroup = { batchId: m.batchId, movements: [m] };
        batchMap.set(m.batchId, g);
        groups.push(g);
      }
    } else {
      groups.push({ batchId: null, movements: [m] });
    }
  }
  return groups;
}

function MovementGroupRow({ group, showLocations }: { group: MovementGroup; showLocations: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const revert = useRevertMovement();
  const confirm = useConfirm();
  const isBatch = group.batchId !== null && group.movements.length > 1;
  const first = group.movements[0];
  const totalDelta = group.movements.reduce((s, m) => s + m.quantityDelta, 0);

  const handleRevert = async (m: StockMovement) => {
    const ok = await confirm(
      t("stock.revertConfirm", { variant: m.variantName, qty: Math.abs(m.quantityDelta) }),
      { title: t("stock.revertTitle"), confirmLabel: t("stock.revert") },
    );
    if (!ok) return;
    try {
      await revert.mutateAsync(m.id);
      toast.success(t("stock.reverted"));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? t("stock.revertFailed"));
    }
  };

  if (!isBatch) {
    const m = first;
    const canRevert = REVERTABLE_TYPES.has(m.movementType);
    return (
      <TableRow hover>
        <TableCell>
          <Typography variant="caption">{new Date(m.movementDate).toLocaleDateString()}</Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {new Date(m.movementDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>{m.variantName}</Typography>
          {showLocations && <Typography variant="caption" color="text.secondary">{m.locationName}</Typography>}
        </TableCell>
        <TableCell>
          <Chip
            label={t(`stock.movementType.${m.movementType}`, { defaultValue: m.movementType })}
            size="small"
            color={m.quantityDelta > 0 ? "success" : m.movementType === "sold" ? "default" : "warning"}
            variant="outlined"
          />
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2" fontWeight="bold" color={m.quantityDelta >= 0 ? "success.main" : "error.main"}>
            {m.quantityDelta >= 0 ? "+" : ""}{m.quantityDelta}
          </Typography>
        </TableCell>
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{m.note}</Typography>
            {canRevert && (
              <IconButton size="small" onClick={() => handleRevert(m)} disabled={revert.isPending} title={t("stock.revert")}>
                <UndoIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Stack>
        </TableCell>
      </TableRow>
    );
  }

  // Batch row
  const colSpan = 5;
  return (
    <>
      <TableRow
        hover
        sx={{ cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}
      >
        <TableCell>
          <Typography variant="caption">{new Date(first.movementDate).toLocaleDateString()}</Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {new Date(first.movementDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            {t("stock.batchItems", { count: group.movements.length })}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            label={t(`stock.movementType.${first.movementType}`, { defaultValue: first.movementType })}
            size="small"
            color={totalDelta > 0 ? "success" : "warning"}
            variant="outlined"
          />
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2" fontWeight="bold" color="success.main">+{totalDelta}</Typography>
        </TableCell>
        <TableCell>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">{first.note}</Typography>
            <IconButton size="small">
              {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Stack>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={colSpan} sx={{ p: 0 }}>
          <Collapse in={open}>
            <Stack divider={<Divider />} sx={{ pl: 4, bgcolor: "grey.50" }}>
              {group.movements.map((m) => (
                <Stack key={m.id} direction="row" alignItems="center" spacing={2} sx={{ py: 0.75, px: 2 }}>
                  <Typography variant="body2" sx={{ flex: 1 }} noWrap>{m.variantName}</Typography>
                  {showLocations && (
                    <Typography variant="caption" color="text.secondary">{m.locationName}</Typography>
                  )}
                  <Typography variant="body2" fontWeight="bold" color="success.main">+{m.quantityDelta}</Typography>
                </Stack>
              ))}
            </Stack>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ─── Stock Log page ───────────────────────────────────────────────────────────

export default function StockPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [movTypeFilter, setMovTypeFilter] = useState("");
  const { data: locationsData } = useLocations();
  const { data: movements, isLoading } = useStockMovements(
    movTypeFilter ? { movement_type: movTypeFilter } : undefined
  );

  const locations = locationsData ?? [];
  const showLocations = locations.length > 1;

  const MOVEMENT_TYPE_KEYS = [
    "produced", "fulfilled", "sold", "damaged", "adjustment", "returned", "refund_return", "transfer_in", "transfer_out",
  ];

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="h5" fontWeight="bold" sx={{ flex: 1 }}>{t("stock.title")}</Typography>
        <Button variant="outlined" size="small" startIcon={<AddIcon />} {...navLinkProps("/stock/add", navigate)}>
          {t("stock.addStock")}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t("stock.filterType")}</InputLabel>
          <Select label={t("stock.filterType")} value={movTypeFilter} onChange={(e) => setMovTypeFilter(e.target.value)}>
            <MenuItem value="">{t("stock.allMovements")}</MenuItem>
            {MOVEMENT_TYPE_KEYS.map((key) => (
              <MenuItem key={key} value={key}>{t(`stock.movementType.${key}`)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {showLocations && (
          <Button variant="outlined" size="small" startIcon={<SwapHorizIcon />} {...navLinkProps("/stock/transfer", navigate)}>
            {t("stock.transfer")}
          </Button>
        )}
      </Stack>

      <Paper variant="outlined">
        {isLoading && <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress /></Box>}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("stock.date")}</TableCell>
              <TableCell>{t("stock.productVariant")}</TableCell>
              <TableCell>{t("stock.type")}</TableCell>
              <TableCell align="right">{t("stock.qty")}</TableCell>
              <TableCell>{t("stock.note")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {movements?.results && groupMovements(movements.results).map((group, i) => (
              <MovementGroupRow key={group.batchId ?? `single-${i}`} group={group} showLocations={showLocations} />
            ))}
            {!isLoading && movements?.results?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {t("stock.noMovementsYet")}
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
