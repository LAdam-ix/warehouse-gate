import { useState } from "react";
import { variantLabel } from "../../utils/variantLabel";
import { intQtyInputProps } from "../../utils/form";
import {
  Autocomplete, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import { useProducts, useCreateProductionRequest } from "../../api/hooks";
import { axiosInstance } from "../../api/client/axiosInstance";
import type { ProductionRequest, ProductDetail } from "../../types/api";
import { useTranslation } from "react-i18next";

type Trigger = ProductionRequest["trigger"];

export default function CreateRequestDialog({
  open,
  onClose,
  defaultVariantId,
}: {
  open: boolean;
  onClose: () => void;
  defaultVariantId?: string;
}) {
  const { t } = useTranslation();
  const [productSearch, setProductSearch] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>(defaultVariantId ?? "");
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [qty, setQty] = useState("1");
  const [target, setTarget] = useState("");
  const [trigger, setTrigger] = useState<Trigger>("manual");
  const [note, setNote] = useState("");

  const { data: productsData } = useProducts({ search: productSearch || undefined, page_size: 20 });
  const products = productsData?.results ?? [];
  const create = useCreateProductionRequest();

  const loadProduct = async (id: string) => {
    setLoadingDetail(true);
    try {
      const data = await axiosInstance.get<ProductDetail>(`/products/${id}/`).then((r) => r.data);
      setProductDetail(data);
      // Auto-select first variant if only one
      if (data.variants.length === 1) {
        setSelectedVariantId(data.variants[0].id);
      } else {
        setSelectedVariantId("");
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedVariantId) { toast.error(t("production.newRequestDialog.selectVariant")); return; }
    const q = parseInt(qty, 10);
    if (!q || q <= 0) { toast.error(t("production.newRequestDialog.enterValidQty")); return; }
    await create.mutateAsync({
      variant: selectedVariantId,
      quantityRequested: q,
      quantityTarget: target ? parseInt(target, 10) : undefined,
      trigger,
      note: note || undefined,
    });
    toast.success(t("production.newRequestDialog.created"));
    onClose();
  };

  const variants = productDetail?.variants.filter((v) => v.isActive) ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("production.newRequestDialog.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Product picker */}
          <Autocomplete
            options={products}
            getOptionLabel={(p) => p.name}
            loading={false}
            inputValue={productSearch}
            onInputChange={(_, v) => setProductSearch(v)}
            onChange={(_, p) => {
              setProductDetail(null);
              if (p) loadProduct(p.id);
            }}
            renderInput={(params) => (
              <TextField {...params} label={t("production.newRequestDialog.product")} size="small" />
            )}
          />

          {/* Variant picker */}
          {loadingDetail && <CircularProgress size={20} />}
          {productDetail && variants.length > 0 && (
            <FormControl size="small" fullWidth>
              <InputLabel>{t("production.newRequestDialog.variant")}</InputLabel>
              <Select
                label={t("production.newRequestDialog.variant")}
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
              >
                {variants.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.isDefault
                      ? t("common.default")
                      : variantLabel(v.attributeValues)}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      {t("production.newRequestDialog.stockCount", { count: v.totalStock })}
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Stack direction="row" spacing={2}>
            <TextField
              label={t("production.newRequestDialog.qtyToProduce")}
              type="number"
              size="small"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              sx={{ flex: 1 }}
              slotProps={{ htmlInput: { ...intQtyInputProps, min: 1 } }}
            />
            <TextField
              label={t("production.newRequestDialog.targetStock")}
              type="number"
              size="small"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              sx={{ flex: 1 }}
              helperText={t("production.newRequestDialog.targetHelper")}
              slotProps={{ htmlInput: { ...intQtyInputProps, min: 0 } }}
            />
          </Stack>

          <FormControl size="small" fullWidth>
            <InputLabel>{t("production.newRequestDialog.trigger")}</InputLabel>
            <Select
              label={t("production.newRequestDialog.trigger")}
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as Trigger)}
            >
              <MenuItem value="manual">{t("production.newRequestDialog.triggerManual")}</MenuItem>
              <MenuItem value="seasonal">{t("production.newRequestDialog.triggerSeasonal")}</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label={t("common.noteOptional")}
            size="small"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={create.isPending || !selectedVariantId}
        >
          {t("common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
