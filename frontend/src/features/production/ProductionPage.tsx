import { useState, useEffect } from "react";
import {
  Box, Button, Chip, CircularProgress, Divider, FormControl, InputLabel, MenuItem, Select,
  Grid, IconButton, Paper, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { toast } from "react-toastify";
import {
  useCreateProductionRequest,
  useProductionRequests,
  useUpdateProductionRequest,
  useCancelProductionRequest,
  useFulfillProductionRequest,
} from "../../api/hooks";
import { useConfirm } from "../../components/ConfirmDialog";
import ProductPickerPanel, { type ProductPickerSelectFn } from "../../components/ProductPickerPanel";
import { intQtyInputProps } from "../../utils/form";
import type { ProductionRequest } from "../../types/api";
import { useTranslation } from "react-i18next";
import PaginationComponent, { usePagination } from "../../components/Pagination";

// ─── Cart ─────────────────────────────────────────────────────────────────────

interface CartLine {
  variantId: string;
  variantLabel: string;
  quantity: number;
}

// ─── Status constants ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ProductionRequest["status"], "warning" | "info" | "success" | "default"> = {
  pending: "warning",
  in_progress: "info",
  fulfilled: "success",
  cancelled: "default",
};

// ─── Fulfill dialog ───────────────────────────────────────────────────────────

function FulfillDialog({
  request,
  onClose,
}: {
  request: ProductionRequest;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [qty, setQty] = useState<string>(String(request.quantityRequested));
  const [note, setNote] = useState("");
  const fulfill = useFulfillProductionRequest();

  const handleSubmit = async () => {
    await fulfill.mutateAsync({
      id: request.id,
      quantity: qty ? Number(qty) : undefined,
      note: note || undefined,
    });
    toast.success(t("production.requestFulfilled"));
    onClose();
  };

  return (
    <div>
      <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {t("production.fulfillDialog.title", { variantName: request.variantName })}
          </Typography>
          <TextField
            label={t("production.fulfillDialog.qtyProduced")}
            type="number"
            size="small"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            helperText={t("production.fulfillDialog.qtyHelper")}
            fullWidth
            slotProps={{ htmlInput: { ...intQtyInputProps, min: 1 } }}
          />
          <TextField
            label={t("common.noteOptional")}
            size="small"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={onClose}>{t("common.cancel")}</Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleSubmit}
              disabled={fulfill.isPending}
              startIcon={<CheckIcon />}
            >
              {t("production.fulfillDialog.fulfillButton")}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </div>
  );
}

// ─── Existing queue row ───────────────────────────────────────────────────────

function RequestRow({ req }: { req: ProductionRequest }) {
  const { t } = useTranslation();
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const update = useUpdateProductionRequest(req.id);
  const cancel = useCancelProductionRequest();
  const confirm = useConfirm();
  const isOpen = req.status === "pending" || req.status === "in_progress";

  return (
    <>
      <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{
        py: 1.5, px: 2,
        borderLeft: "3px solid",
        borderColor:
          req.priority === 3 ? "error.main" :
          req.priority === 2 ? "warning.main" :
          req.priority === 1 ? "grey.300" :
          "grey.100",
      }}>
        <Stack spacing={0.5} sx={{ minWidth: 90 }}>
          <Chip
            label={t(`production.status.${req.status}`)}
            color={STATUS_COLORS[req.status]}
            size="small"
            variant="outlined"
          />
          {req.priority !== 1 && (
            <Chip
              label={t(
                req.priority === 3 ? "production.priorityUrgent" :
                req.priority === 2 ? "production.priorityHigh" :
                "production.priorityLow"
              )}
              size="small"
              color={req.priority === 3 ? "error" : req.priority === 2 ? "warning" : "default"}
              sx={{ fontSize: "0.65rem", height: 18 }}
            />
          )}
          {req.trigger === "auto" && (
            <Chip
              label={t("production.auto")}
              size="small"
              icon={<AutoAwesomeIcon sx={{ fontSize: 12 }} />}
              sx={{ fontSize: "0.65rem", height: 18 }}
            />
          )}
        </Stack>

        {/* Photo / color swatch */}
        <Box sx={{ width: 36, flexShrink: 0, pt: 0.25 }}>
          {req.variantPhotoUrl ? (
            <Box component="img" src={req.variantPhotoUrl}
              sx={{ width: 32, height: 32, borderRadius: "3px", objectFit: "cover", display: "block" }} />
          ) : req.variantColorHex ? (
            <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: req.variantColorHex, border: "1px solid", borderColor: "divider" }} />
          ) : null}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {(() => {
            // variantName comes as "attr: val | attr: val" (empty for default variant).
            // Strip generic attribute names for cleaner display.
            const GENERIC = new Set(["color", "colour", "size", "pattern", "material", "style"]);
            const parts = (req.variantName ?? "").split(" | ").filter(Boolean).map((p) => {
              const idx = p.indexOf(": ");
              if (idx < 0) return p;
              const name = p.slice(0, idx);
              const value = p.slice(idx + 2);
              return GENERIC.has(name.toLowerCase()) ? value : p;
            });
            const vLabel = parts.join(" | ");
            return (
              <Typography variant={req.note ? "body2" : "body1"} fontWeight="medium" noWrap>
                {req.productName}
                {vLabel && <Typography component="span" variant="body2"> — {vLabel}</Typography>}
              </Typography>
            );
          })()}
          {req.note && (
            <Typography variant="caption" color="text.disabled" display="block" noWrap>
              {req.note}
            </Typography>
          )}
        </Box>

        <Box sx={{ textAlign: "right", minWidth: 60 }}>
          <Typography variant="body2" fontWeight="bold">×{req.quantityRequested}</Typography>
          {req.quantityTarget && (
            <Typography variant="caption" color="text.secondary">{t("production.target", { value: req.quantityTarget })}</Typography>
          )}
        </Box>

        <Box sx={{ textAlign: "right", minWidth: 90 }}>
          <Typography variant="caption" color="text.secondary">
            {new Date(req.createdAt).toLocaleDateString()}
          </Typography>
          {req.createdByName && (
            <Typography variant="caption" color="text.disabled" display="block">{req.createdByName}</Typography>
          )}
          {req.fulfilledAt && (
            <Typography variant="caption" color="success.main" display="block">
              ✓ {new Date(req.fulfilledAt).toLocaleDateString()}
            </Typography>
          )}
        </Box>

        {isOpen && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            {req.status === "pending" && (
              <Tooltip title={t("production.markInProgress")}>
                <IconButton
                  size="small"
                  color="info"
                  disabled={update.isPending}
                  onClick={async () => {
                    await update.mutateAsync({ status: "in_progress" } as never);
                    toast.success(t("production.markedInProgress"));
                  }}
                >
                  <PlayArrowIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={t("production.markFulfillAdd")}>
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<CheckIcon />}
                onClick={() => setFulfillOpen((v) => !v)}
              >
                {t("production.fulfill")}
              </Button>
            </Tooltip>
            <Tooltip title={t("production.cancelRequest")}>
              <span>
                <Button
                  size="small"
                  variant="text"
                  color="error"
                  onClick={async () => {
                    if (!await confirm(t("production.cancelRequestConfirm"), { title: t("production.cancelRequestTitle") })) return;
                    await cancel.mutateAsync(req.id);
                    toast.success(t("production.requestCancelled"));
                  }}
                  disabled={cancel.isPending}
                >
                  <CloseIcon fontSize="small" />
                </Button>
              </span>
            </Tooltip>
          </Stack>
        )}
      </Stack>

      {fulfillOpen && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <FulfillDialog
            request={req}
            onClose={() => setFulfillOpen(false)}
          />
        </Box>
      )}
    </>
  );
}

// ─── Production page ──────────────────────────────────────────────────────────

export default function ProductionPage() {
  const { t } = useTranslation();
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending,in_progress");
  const [addOpen, setAddOpen] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [batchContext, setBatchContext] = useState(() => {
    try { return localStorage.getItem("production_batch_context") !== "off"; } catch { return true; }
  });
  const { page, pageSize, setPage, setPageSize } = usePagination(25);

  const create = useCreateProductionRequest();

  const queueParams: Record<string, unknown> = { page, page_size: pageSize };
  if (statusFilter && statusFilter !== "pending,in_progress") queueParams.status = statusFilter;
  if (queueSearch) queueParams.search = queueSearch;
  const { data: queueData, isLoading: queueLoading } = useProductionRequests(queueParams);

  const queueRequests = queueData?.results ?? [];
  const filteredQueue =
    statusFilter === "pending,in_progress"
      ? queueRequests.filter((r) => r.status === "pending" || r.status === "in_progress")
      : queueRequests;

  // Auto-open add panel when queue has no active requests (only on default filter)
  const hasActiveRequests = queueRequests.some((r) => r.status === "pending" || r.status === "in_progress");
  useEffect(() => {
    if (!queueLoading && !hasActiveRequests && statusFilter === "pending,in_progress") {
      setAddOpen(true);
    }
  }, [queueLoading, hasActiveRequests, statusFilter]);

  const handlePickerAdd: ProductPickerSelectFn = (variant, label, _product, qty = 1) => {
    handleAdd({ variantId: variant.id, variantLabel: label, quantity: qty });
  };

  const handleAdd = (line: CartLine) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.variantId === line.variantId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity };
        return next;
      }
      return [...prev, line];
    });
  };

  const adjustQty = (variantId: string, delta: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.variantId === variantId);
      if (idx < 0) return prev;
      const newQty = prev[idx].quantity + delta;
      if (newQty <= 0) return prev.filter((l) => l.variantId !== variantId);
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: newQty };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    const batchId = cart.length > 1 ? crypto.randomUUID() : undefined;
    await Promise.all(
      cart.map((line) =>
        create.mutateAsync({
          variant: line.variantId,
          quantityRequested: line.quantity,
          priority,
          batchId,
          note: note || undefined,
        })
      )
    );
    toast.success(t(cart.length !== 1 ? "production.createdRequests_other" : "production.createdRequests_one", { count: cart.length }));
    setCart([]);
    setNote("");
    setPriority(1);
    setAddOpen(false);
  };

  const totalRequested = cart.reduce((s, l) => s + l.quantity, 0);

  const STATUS_FILTERS = [
    { val: "pending,in_progress", label: t("production.openFilter") },
    { val: "pending", label: t("production.pendingFilter") },
    { val: "in_progress", label: t("production.inProgressFilter") },
    { val: "fulfilled", label: t("production.fulfilledFilter") },
    { val: "cancelled", label: t("production.cancelledFilter") },
    { val: "", label: t("production.allFilter") },
  ] as const;

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="h5" fontWeight="bold" sx={{ flex: 1 }}>{t("production.title")}</Typography>
        <Button
          variant={addOpen ? "contained" : "outlined"}
          size="small"
          startIcon={addOpen ? <ExpandLessIcon /> : <AddIcon />}
          onClick={() => setAddOpen((v) => !v)}
        >
          {t("production.addToQueue")}
        </Button>
      </Stack>

      {/* Collapsible add panel */}
      {addOpen && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 7 }}>
            <ProductPickerPanel
              onSelect={handlePickerAdd}
              queryParams={{ item_type: "physical" }}
              showStock
              quickAmounts={[1, 5, 10, 50]}
              autoExpandThreshold={3}
              variantSort="stockAsc"
              productSort="stockRatio"
              filterFn={lowStockOnly
                ? (p) => p.lowStockThreshold !== null && p.totalStock <= p.lowStockThreshold
                : undefined}
              autoFocus
              noMatchMessage={t("common.noProductsFound")}
            />
            <Chip
              label={t("production.lowStock")}
              size="small"
              color={lowStockOnly ? "warning" : "default"}
              variant={lowStockOnly ? "filled" : "outlined"}
              onClick={() => setLowStockOnly((v) => !v)}
              sx={{ cursor: "pointer", mt: 1 }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Paper variant="outlined" sx={{ p: 2, position: "sticky", top: 16 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                {t("production.requestsToCreate")}
                {totalRequested > 0 && (
                  <Chip label={t("production.units", { count: totalRequested })} size="small" color="primary" sx={{ ml: 1 }} />
                )}
              </Typography>

              {cart.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("production.clickToAddRequest")}
                </Typography>
              ) : (
                <Stack spacing={0.75} sx={{ mb: 2 }}>
                  {cart.map((line) => (
                    <Stack key={line.variantId} direction="row" alignItems="center" spacing={0.5}>
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {line.variantLabel}
                      </Typography>
                      <IconButton size="small" onClick={() => adjustQty(line.variantId, -1)}>
                        <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: "error.light" }} />
                      </IconButton>
                      <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 24, textAlign: "center" }}>
                        {line.quantity}
                      </Typography>
                      <IconButton size="small" onClick={() => adjustQty(line.variantId, 1)}>
                        <AddCircleOutlineIcon sx={{ fontSize: 18, color: "success.main" }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => setCart((p) => p.filter((l) => l.variantId !== line.variantId))}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}

              <Divider sx={{ my: 1.5 }} />

              <Stack spacing={1.5}>
                <FormControl size="small" fullWidth>
                  <InputLabel>{t("production.priority")}</InputLabel>
                  <Select label={t("production.priority")} value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                    <MenuItem value={0}>{t("production.priorityLow")}</MenuItem>
                    <MenuItem value={1}>{t("production.priorityNormal")}</MenuItem>
                    <MenuItem value={2}>{t("production.priorityHigh")}</MenuItem>
                    <MenuItem value={3}>{t("production.priorityUrgent")}</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label={t("common.noteOptional")}
                  size="small"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  fullWidth
                  placeholder={t("production.noteAppliedToAll")}
                />
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={handleSubmit}
                  disabled={cart.length === 0 || create.isPending}
                  fullWidth
                >
                  {cart.length > 0
                    ? t(cart.length !== 1 ? "production.createRequests_other" : "production.createRequests_one", { count: cart.length })
                    : t("production.createRequestsDefault")}
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Queue */}
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
            {t("production.queue")}
          </Typography>
          <Tooltip title={t("production.batchContextTooltip")}>
            <Chip
              label={t("production.batchContext")}
              size="small"
              onClick={() => {
                const next = !batchContext;
                setBatchContext(next);
                try { localStorage.setItem("production_batch_context", next ? "on" : "off"); } catch {}
              }}
              color={batchContext ? "info" : "default"}
              variant={batchContext ? "filled" : "outlined"}
              sx={{ cursor: "pointer" }}
            />
          </Tooltip>
          {STATUS_FILTERS.map(({ val, label }) => (
            <Chip
              key={val}
              label={label}
              size="small"
              onClick={() => { setStatusFilter(val); setPage(1); }}
              color={statusFilter === val ? "primary" : "default"}
              variant={statusFilter === val ? "filled" : "outlined"}
              sx={{ cursor: "pointer" }}
            />
          ))}
          <TextField
            size="small"
            placeholder={t("production.searchQueue")}
            value={queueSearch}
            onChange={(e) => { setQueueSearch(e.target.value); setPage(1); }}
            sx={{ width: 200 }}
          />
        </Stack>

        <Paper variant="outlined">
          {queueLoading && (
            <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress /></Box>
          )}
          {!queueLoading && filteredQueue.length === 0 && (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {t("production.noProductionRequests")}
                {statusFilter === "pending,in_progress"
                  ? t("production.noProductionRequestsHint")
                  : ""}
              </Typography>
            </Box>
          )}
          <Stack divider={<Divider />}>
            {(() => {
              // Group by batch_id, preserving order (already sorted by -priority, created_at on backend)
              const groups: { batchId: string | null; items: typeof filteredQueue }[] = [];
              for (const req of filteredQueue) {
                const bid = req.batchId;
                if (bid) {
                  const existing = groups.find((g) => g.batchId === bid);
                  if (existing) { existing.items.push(req); continue; }
                }
                groups.push({ batchId: bid, items: [req] });
              }

              // Apply batch context filter
              const visibleGroups = groups.map((g) => {
                if (!batchContext || !g.batchId) return g;
                // In batch context mode: show entire batch if any item matches the current filter
                // (filteredQueue already has the filter applied, so all items here match)
                return g;
              });

              let batchColorIdx = 0;
              return visibleGroups.flatMap((group) => {
                const bg = group.batchId ? (batchColorIdx++ % 2 === 0 ? "grey.50" : "background.paper") : "background.paper";
                return group.items.map((req) => (
                  <Box key={req.id} sx={{ bgcolor: bg }}>
                    <RequestRow req={req} />
                  </Box>
                ));
              });
            })()}
          </Stack>
          {(queueData?.count ?? 0) > pageSize && (
            <PaginationComponent
              count={queueData?.count ?? 0}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              storageKey="productionQueue"
            />
          )}
        </Paper>
      </Stack>
    </Stack>
  );
}
