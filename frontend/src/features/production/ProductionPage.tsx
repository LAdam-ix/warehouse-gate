import { useState } from "react";
import {
  Box, Button, Chip, CircularProgress, Collapse, Divider,
  Grid, IconButton, InputAdornment, Paper, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InventoryIcon from "@mui/icons-material/Inventory2";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { toast } from "react-toastify";
import {
  useProducts,
  useProduct,
  useCreateProductionRequest,
  useProductionRequests,
  useUpdateProductionRequest,
  useCancelProductionRequest,
  useFulfillProductionRequest,
} from "../../api/hooks";
import { useConfirm } from "../../components/ConfirmDialog";
import { variantLabel } from "../../utils/variantLabel";
import { intQtyInputProps } from "../../utils/form";
import type { Product, ProductionRequest } from "../../types/api";
import { useTranslation } from "react-i18next";

const QUICK_AMOUNTS = [1, 5, 10, 50];

// ─── Cart ─────────────────────────────────────────────────────────────────────

interface CartLine {
  variantId: string;
  variantLabel: string;
  quantity: number;
}

// ─── Variant quick-add row ────────────────────────────────────────────────────

function VariantQuickAdd({
  variantId,
  variantLabel,
  totalStock,
  isLowStock,
  colorHex,
  photoUrl,
  label,
  onAdd,
}: {
  variantId: string;
  variantLabel: string;
  totalStock: number;
  isLowStock: boolean;
  colorHex?: string | null;
  photoUrl?: string | null;
  label: string;
  onAdd: (line: CartLine) => void;
}) {
  const { t } = useTranslation();
  const stockColor = totalStock === 0 ? "error" : isLowStock ? "warning" : "success";
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.75, px: 2 }}>
      {photoUrl && (
        <Box component="img" src={photoUrl} sx={{ width: 32, height: 32, borderRadius: "3px", objectFit: "cover" }} />
      )}
      {!photoUrl && colorHex && (
        <Box sx={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, bgcolor: colorHex }} />
      )}
      <Typography variant="body2" sx={{ flex: 1 }} noWrap>{label}</Typography>
      <Chip label={t("production.inStock", { count: totalStock })} size="small" color={stockColor} variant="outlined" />
      <Stack direction="row" spacing={0.5}>
        {QUICK_AMOUNTS.map((n) => (
          <Button
            key={n}
            size="small"
            variant="outlined"
            sx={{ minWidth: 36, px: 0.5 }}
            onClick={() => onAdd({ variantId, variantLabel, quantity: n })}
          >
            +{n}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}

// ─── Fetches product detail and renders variant rows ──────────────────────────

function VariantRows({
  productId,
  productName,
  onAdd,
}: {
  productId: string;
  productName: string;
  onAdd: (line: CartLine) => void;
}) {
  const { data: detail, isLoading } = useProduct(productId);
  if (isLoading) return <Box sx={{ p: 1.5 }}><CircularProgress size={16} /></Box>;
  if (!detail) return null;

  const active = [...detail.variants.filter((v) => v.isActive)]
    .sort((a, b) => a.totalStock - b.totalStock);

  return (
    <Stack divider={<Divider />}>
      {active.map((v) => {
        const vLabel = v.isDefault
          ? productName
          : `${productName} — ${variantLabel(v.attributeValues)}`;
        const rowLabel = v.isDefault ? productName : variantLabel(v.attributeValues);
        const photoUrl = v.galleryPhotoUrl ?? v.photo ?? null;
        const colorHex = v.attributeValues.find((av) => av.colorHex)?.colorHex ?? null;

        return (
          <VariantQuickAdd
            key={v.id}
            variantId={v.id}
            variantLabel={vLabel}
            totalStock={v.totalStock}
            isLowStock={v.isLowStock}
            photoUrl={!photoUrl ? null : photoUrl}
            colorHex={!photoUrl ? colorHex : null}
            label={rowLabel}
            onAdd={onAdd}
          />
        );
      })}
    </Stack>
  );
}

// ─── Single-variant product row ───────────────────────────────────────────────

function SingleVariantRow({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (line: CartLine) => void;
}) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useProduct(product.id);
  const v = detail?.variants.find((v) => v.isActive);

  return (
    <Paper variant="outlined">
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.5 }}>
        {product.primaryPhoto ? (
          <Box component="img" src={product.primaryPhoto}
            sx={{ width: 48, height: 48, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <Box sx={{ width: 48, height: 48, bgcolor: "grey.100", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <InventoryIcon sx={{ fontSize: 24, color: "grey.400" }} />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight="medium" noWrap>{product.name}</Typography>
          {product.categoryNames.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.25} sx={{ mt: 0.25 }}>
              {product.categoryNames.map((n) => (
                <Chip key={n} label={n} size="small" variant="outlined" sx={{ height: 16, fontSize: "0.6rem" }} />
              ))}
            </Stack>
          )}
        </Box>
        {isLoading ? (
          <CircularProgress size={16} />
        ) : v ? (
          <>
            <Chip
              label={t("production.inStock", { count: v.totalStock })}
              size="small"
              color={v.totalStock === 0 ? "error" : v.isLowStock ? "warning" : "success"}
              variant="outlined"
            />
            <Stack direction="row" spacing={0.5}>
              {QUICK_AMOUNTS.map((n) => (
                <Button
                  key={n}
                  size="small"
                  variant="outlined"
                  sx={{ minWidth: 36, px: 0.5 }}
                  onClick={() => onAdd({ variantId: v.id, variantLabel: product.name, quantity: n })}
                >
                  +{n}
                </Button>
              ))}
            </Stack>
          </>
        ) : (
          <Chip
            label={t("production.inStock", { count: product.totalStock })}
            size="small"
            color={product.totalStock === 0 ? "error" : "default"}
            variant="outlined"
          />
        )}
      </Stack>
    </Paper>
  );
}

// ─── Multi-variant product row with expand ────────────────────────────────────

function MultiVariantRow({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (line: CartLine) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(product.variantCount <= 3);

  return (
    <Paper variant="outlined">
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ p: 1.5, cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}
      >
        {product.primaryPhoto ? (
          <Box component="img" src={product.primaryPhoto}
            sx={{ width: 48, height: 48, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <Box sx={{ width: 48, height: 48, bgcolor: "grey.100", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <InventoryIcon sx={{ fontSize: 24, color: "grey.400" }} />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight="medium" noWrap>{product.name}</Typography>
          {product.categoryNames.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.25} sx={{ mt: 0.25 }}>
              {product.categoryNames.map((n) => (
                <Chip key={n} label={n} size="small" variant="outlined" sx={{ height: 16, fontSize: "0.6rem" }} />
              ))}
            </Stack>
          )}
        </Box>
        <Chip
          label={t("production.inStock", { count: product.totalStock })}
          size="small"
          color={product.totalStock === 0 ? "error" : "default"}
          variant="outlined"
        />
        <Chip label={t("production.variants", { count: product.variantCount })} size="small" variant="outlined" />
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Stack>
      <Collapse in={open}>
        <Divider />
        <VariantRows productId={product.id} productName={product.name} onAdd={onAdd} />
      </Collapse>
    </Paper>
  );
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
      <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ py: 1.5, px: 2 }}>
        <Stack spacing={0.5} sx={{ minWidth: 90 }}>
          <Chip
            label={t(`production.status.${req.status}`)}
            color={STATUS_COLORS[req.status]}
            size="small"
            variant="outlined"
          />
          {req.trigger === "auto" && (
            <Chip
              label={t("production.auto")}
              size="small"
              icon={<AutoAwesomeIcon sx={{ fontSize: 12 }} />}
              sx={{ fontSize: "0.65rem", height: 18 }}
            />
          )}
        </Stack>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight="medium" noWrap>{req.productName}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {req.variantName !== req.productName ? req.variantName : "—"}
          </Typography>
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
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending,in_progress");

  const { data: productsData, isLoading } = useProducts({
    search: search || undefined,
    item_type: "physical",
    is_active: true,
  });
  const create = useCreateProductionRequest();

  const { data: queueData, isLoading: queueLoading } = useProductionRequests(
    statusFilter === "pending,in_progress" ? undefined : statusFilter ? { status: statusFilter } : undefined
  );

  const allProducts = productsData?.results ?? [];
  const products = [...allProducts]
    .filter((p) => !lowStockOnly || (p.lowStockThreshold !== null && p.totalStock <= p.lowStockThreshold))
    .sort((a, b) => a.totalStock - b.totalStock);

  const queueRequests = queueData?.results ?? [];
  const filteredQueue =
    statusFilter === "pending,in_progress"
      ? queueRequests.filter((r) => r.status === "pending" || r.status === "in_progress")
      : queueRequests;

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
    await Promise.all(
      cart.map((line) =>
        create.mutateAsync({
          variant: line.variantId,
          quantityRequested: line.quantity,
          note: note || undefined,
        })
      )
    );
    toast.success(t(cart.length !== 1 ? "production.createdRequests_other" : "production.createdRequests_one", { count: cart.length }));
    setCart([]);
    setNote("");
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
      <Typography variant="h5" fontWeight="bold">{t("production.title")}</Typography>

      {/* Browse + cart */}
      <Grid container spacing={2}>
        {/* Left — product browser */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                placeholder={t("production.searchProducts")}
                size="small"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                sx={{ flex: 1 }}
                autoFocus
              />
              <Chip
                label={t("production.lowStock")}
                size="small"
                color={lowStockOnly ? "warning" : "default"}
                variant={lowStockOnly ? "filled" : "outlined"}
                onClick={() => setLowStockOnly((v) => !v)}
                sx={{ cursor: "pointer" }}
              />
            </Stack>

            {isLoading && <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>}
            {!isLoading && products.length === 0 && (
              <Typography color="text.secondary" variant="body2">{t("common.noProductsFound")}</Typography>
            )}

            <Stack spacing={0.75}>
              {products.map((product) =>
                product.variantCount === 1 ? (
                  <SingleVariantRow key={product.id} product={product} onAdd={handleAdd} />
                ) : (
                  <MultiVariantRow key={product.id} product={product} onAdd={handleAdd} />
                )
              )}
            </Stack>
          </Stack>
        </Grid>

        {/* Right — request cart */}
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

      <Divider />

      {/* Existing queue */}
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
            {t("production.queue")}
          </Typography>
          {STATUS_FILTERS.map(({ val, label }) => (
            <Chip
              key={val}
              label={label}
              size="small"
              onClick={() => setStatusFilter(val)}
              color={statusFilter === val ? "primary" : "default"}
              variant={statusFilter === val ? "filled" : "outlined"}
              sx={{ cursor: "pointer" }}
            />
          ))}
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
            {filteredQueue.map((req) => (
              <RequestRow key={req.id} req={req} />
            ))}
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  );
}
