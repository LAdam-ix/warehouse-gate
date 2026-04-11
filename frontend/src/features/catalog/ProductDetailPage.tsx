import { useEffect, useRef, useState } from "react";
import { blockNonDecimal } from "../../utils/form";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, Grid, IconButton,
  Paper, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography,
  FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import StarIcon from "@mui/icons-material/Star";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import PhotoIcon from "@mui/icons-material/Photo";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import SortIcon from "@mui/icons-material/Sort";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { toast } from "react-toastify";
import {
  useProduct, useUpdateProduct, useDeleteProduct,
  useUploadProductPhoto, useDeleteProductPhoto, useSetPrimaryPhoto, useReorderPhotos, useProductTree,
  useUpdateVariant, useDeleteVariant, useUploadVariantPhoto,
  useCategories, useCreateCategory,
  useCreateVariant, useCreateAttribute, useUpdateAttribute, useReorderAttributes, useDeleteAttribute,
  useCreateAttributeValue, useUpdateAttributeValue, useDeleteAttributeValue, useReorderAttributeValues,
  useProductionRequests, useCreateProductionRequest, useFulfillProductionRequest, useCancelProductionRequest,
  useWarehouseSettings, useAddStock, useLocations, useRedistributeStock,
} from "../../api/hooks";
import { useConfirm } from "../../components/ConfirmDialog";
import { AddStockDialog } from "../../components/AddStockDialog";
import { TransferStockDialog } from "../../components/TransferStockDialog";
import { variantLabel, sortVariants } from "../../utils/variantLabel";
import type {
  ProductDetail, ProductUpdate, ProductVariant, ProductCostWrite,
  VariantAttribute, AttributeValue, ProductionRequest,
} from "../../types/api";
import CostFields from "../../components/CostFields";
import MathTextField from "../../components/MathTextField";
import { useTranslation } from "react-i18next";

// ─── Color presets ────────────────────────────────────────────────────────────

import { COLOR_PRESETS, sortByHue } from "../../utils/colorPresets";

// ─── Drag-and-drop photo upload zone ─────────────────────────────────────────

function PhotoDropZone({ onFiles, pending }: { onFiles: (files: File[]) => void; pending?: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length) onFiles(files);
  };

  return (
    <Box
      onClick={() => !pending && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        pick(e.dataTransfer.files);
      }}
      sx={{
        width: 90, height: 90, borderRadius: 1.5,
        border: "2px dashed",
        borderColor: dragging ? "primary.main" : "divider",
        bgcolor: dragging ? "primary.50" : undefined,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: pending ? "wait" : "pointer",
        color: dragging ? "primary.main" : "text.disabled",
        transition: "border-color 0.15s, background-color 0.15s",
        "&:hover": { borderColor: "primary.main", color: "primary.main" },
        userSelect: "none",
      }}
    >
      {pending ? <CircularProgress size={20} /> : (
        <>
          <CloudUploadIcon fontSize="small" />
          <Typography variant="caption" align="center" sx={{ mt: 0.25, fontSize: "0.6rem", lineHeight: 1.2 }}>
            Drop or click
          </Typography>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => {
        pick(e.target.files);
        e.target.value = "";
      }} />
    </Box>
  );
}

// ─── Gallery photo picker dialog ─────────────────────────────────────────────

function GalleryPickerDialog({
  photos,
  currentId,
  open,
  onClose,
  onPick,
  onUpload,
  uploading,
}: {
  photos: ProductDetail["photos"];
  currentId: string | null;
  open: boolean;
  onClose: () => void;
  onPick: (photoId: string | null) => void;
  onUpload: (files: File[]) => void;
  uploading?: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("variants.chooseVariantPhoto")}</DialogTitle>
      <DialogContent>
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
          {photos.map((p) => (
            <Box
              key={p.id}
              onClick={() => { onPick(p.id); onClose(); }}
              sx={{
                position: "relative", cursor: "pointer",
                border: "2px solid",
                borderColor: currentId === p.id ? "primary.main" : "divider",
                borderRadius: 1, overflow: "hidden",
                "&:hover": { borderColor: "primary.main" },
              }}
            >
              <Box component="img" src={p.image} sx={{ width: 80, height: 80, objectFit: "cover", display: "block" }} />
              {currentId === p.id && (
                <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(25,118,210,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <StarIcon sx={{ color: "primary.main", fontSize: 20 }} />
                </Box>
              )}
            </Box>
          ))}
          {/* None option */}
          <Box
            onClick={() => { onPick(null); onClose(); }}
            sx={{
              width: 80, height: 80, border: "2px solid",
              borderColor: currentId === null ? "primary.main" : "divider",
              borderRadius: 1, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: "text.disabled", "&:hover": { borderColor: "text.secondary" },
            }}
          >
            <Typography variant="caption" align="center">{t("variants.nonePhoto")}</Typography>
          </Box>
          {/* Upload new */}
          <Box
            onClick={() => !uploading && inputRef.current?.click()}
            sx={{
              width: 80, height: 80, border: "2px dashed",
              borderColor: "divider", borderRadius: 1, cursor: uploading ? "wait" : "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              color: "text.disabled", "&:hover": { borderColor: "primary.main", color: "primary.main" },
            }}
          >
            {uploading ? <CircularProgress size={20} /> : (
              <>
                <CloudUploadIcon fontSize="small" />
                <Typography variant="caption" sx={{ fontSize: "0.6rem" }}>{t("variants.uploadLabel")}</Typography>
              </>
            )}
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) { onUpload(files); e.target.value = ""; }
            }} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Variant row in stock table ───────────────────────────────────────────────

function VariantRow({
  variant,
  locations,
  photos,
  productName,
  isOnlyVariant,
  attributes,
  productLowStockThreshold,
  basePrice,
  baseCost,
}: {
  variant: ProductVariant & { stockByLocation?: Record<string, number> };
  locations: Array<{ id: string; name: string }>;
  photos: ProductDetail["photos"];
  productName: string;
  isOnlyVariant: boolean;
  attributes: VariantAttribute[];
  productLowStockThreshold: number | null;
  basePrice: string;
  baseCost: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editSku, setEditSku] = useState("");
  const [editPriceDelta, setEditPriceDelta] = useState("");
  const [editCostDelta, setEditCostDelta] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editLowStockThreshold, setEditLowStockThreshold] = useState("");
  const [priceMode, setPriceMode] = useState<"absolute" | "delta">("absolute");
  const [costMode, setCostMode] = useState<"absolute" | "delta">("absolute");
  const [editValueIds, setEditValueIds] = useState<Record<string, string>>({});
  const { t } = useTranslation();
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const update = useUpdateVariant(variant.id);
  const deleteVariant = useDeleteVariant();
  const uploadVariantPhoto = useUploadVariantPhoto(variant.id);
  const confirm = useConfirm();

  const label = isOnlyVariant
    ? productName
    : (variantLabel(variant.attributeValues) || t("common.default"));
  const color = variant.totalStock === 0 ? "error" : variant.isLowStock ? "warning" : "success";
  const hasStock = variant.totalStock > 0;
  const canTransfer = locations.length > 1 && hasStock;
  const photoUrl = variant.galleryPhotoUrl ?? variant.photo ?? null;

  const deltaNum = parseFloat(variant.priceDelta);
  const deltaLabel = deltaNum > 0 ? `+€${deltaNum.toFixed(2)}` : deltaNum < 0 ? `-€${Math.abs(deltaNum).toFixed(2)}` : null;
  const hasOverride = variant.priceOverride !== null;

  const openEdit = () => {
    setEditSku(variant.sku);
    // Default to absolute mode showing effective price/cost
    setPriceMode("absolute");
    setCostMode("absolute");
    setEditPriceDelta(variant.effectivePrice === "0.00" ? "" : variant.effectivePrice);
    setEditCostDelta(variant.effectiveCost === "0.00" ? "" : variant.effectiveCost);
    setEditWeight(variant.weight ?? (variant.effectiveWeight || ""));
    setEditLowStockThreshold(variant.lowStockThreshold != null ? String(variant.lowStockThreshold) : "");
    // Pre-fill attribute value selects from current variant values
    const ids: Record<string, string> = {};
    for (const attr of attributes) {
      const match = variant.attributeValues.find((av) =>
        attr.values.some((v) => v.id === av.id)
      );
      ids[attr.id] = match?.id ?? "";
    }
    setEditValueIds(ids);
    setEditOpen(true);
  };

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, px: 2 }}>
        {/* Photo / swatch */}
        <Box sx={{ width: 36, flexShrink: 0 }}>
          {photoUrl ? (
            <Box
              component="img" src={photoUrl}
              sx={{ width: 32, height: 32, borderRadius: 0.5, objectFit: "cover", cursor: "pointer" }}
              onClick={() => setGalleryOpen(true)}
            />
          ) : variant.attributeValues.find((av) => av.colorHex) ? (
            <Box sx={{
              width: 18, height: 18, mt: 0.5, borderRadius: "50%",
              bgcolor: variant.attributeValues.find((av) => av.colorHex)?.colorHex,
              border: "1px solid", borderColor: "divider", cursor: "pointer",
            }} onClick={() => setGalleryOpen(true)} />
          ) : (
            <Tooltip title={t("variants.setPhotoTooltip")}>
              <IconButton size="small" onClick={() => setGalleryOpen(true)} sx={{ width: 32, height: 32 }}>
                <PhotoIcon sx={{ fontSize: 16, color: "text.disabled" }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Label + SKU */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight="medium">{label}</Typography>
          {variant.sku && <Typography variant="caption" color="text.secondary">{t("variants.sku", { sku: variant.sku })}</Typography>}
        </Box>

        {/* Stock chips — only locations with actual stock */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="flex-end" sx={{ minWidth: 80 }}>
          {(() => {
            const locsWithStock = locations.filter((loc) => (variant.stockByLocation?.[loc.id] ?? 0) > 0);
            if (locsWithStock.length === 0) {
              return <Chip label={`${variant.totalStock}`} size="small" color={color} />;
            }
            if (locsWithStock.length === 1) {
              return <Chip label={`${locsWithStock[0].name}: ${variant.totalStock}`} size="small" color={color} />;
            }
            return (
              <>
                {locsWithStock.map((loc) => (
                  <Chip key={loc.id} label={`${loc.name}: ${variant.stockByLocation![loc.id]}`} size="small" variant="outlined" />
                ))}
                <Chip label={`Σ ${variant.totalStock}`} size="small" color={color} />
              </>
            );
          })()}
        </Stack>

        {/* Price */}
        <Stack alignItems="flex-end" sx={{ width: 80, flexShrink: 0 }}>
          <Typography variant="body2" sx={{ fontStyle: hasOverride ? "italic" : undefined }}>€{variant.effectivePrice}</Typography>
          {deltaLabel && !hasOverride && (
            <Chip label={deltaLabel} size="small"
              color={deltaNum > 0 ? "warning" : "success"}
              sx={{ height: 14, fontSize: "0.55rem" }} />
          )}
          {hasOverride && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.55rem" }}>manual</Typography>
          )}
        </Stack>

        {/* Actions */}
        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
          {variant.isActive ? (
            <>
              <Tooltip title={t("variants.addStockTooltip")}>
                <IconButton size="small" color="primary" onClick={() => setAddStockOpen(true)}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("variants.transferStockTooltip")}>
                <IconButton size="small" onClick={() => setTransferOpen(true)} sx={{ visibility: canTransfer ? "visible" : "hidden" }}>
                  <SwapHorizIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("variants.editVariantTooltip")}>
                <IconButton size="small" onClick={openEdit}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {isOnlyVariant ? (
                <Tooltip title={t("variants.archiveOnlyVariantTooltip")}>
                  <span>
                    <IconButton size="small" color="warning" disabled>
                      <ArchiveIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <Tooltip title={t("variants.archiveVariantTooltip")}>
                  <IconButton size="small" color="warning" onClick={async () => {
                    if (!await confirm(t("variants.archiveVariantConfirm", { label }), { title: t("variants.archiveVariantTitle"), confirmLabel: t("variants.archiveVariantLabel") })) return;
                    await update.mutateAsync({ isActive: false });
                    toast.success(t("variants.archived"));
                  }}>
                    <ArchiveIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </>
          ) : (
            <>
              <Tooltip title={t("variants.restoreVariantTooltip")}>
                <IconButton size="small" color="success" onClick={async () => {
                  await update.mutateAsync({ isActive: true });
                  toast.success(t("variants.restored"));
                }}>
                  <UnarchiveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {!isOnlyVariant && (
                <Tooltip title={t("variants.deleteVariantTooltip")}>
                  <IconButton size="small" color="error" onClick={async () => {
                    if (!await confirm(t("variants.deleteVariantConfirm", { label }), { title: t("variants.deleteVariantTitle"), confirmLabel: t("common.delete") })) return;
                    try {
                      await deleteVariant.mutateAsync(variant.id);
                      toast.success(t("variants.deleted"));
                    } catch (err: unknown) {
                      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                      toast.error(msg ?? t("variants.couldNotDelete"));
                    }
                  }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Stack>
      </Stack>

      <AddStockDialog variant={variant} open={addStockOpen} onClose={() => setAddStockOpen(false)} />
      <TransferStockDialog variant={variant} productName={productName} open={transferOpen} onClose={() => setTransferOpen(false)} />

      {/* Edit variant dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("variants.editVariantDialog.title", { label })}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("variants.editVariantDialog.sku")}
              size="small"
              fullWidth
              value={editSku}
              onChange={(e) => setEditSku(e.target.value)}
            />
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                label={priceMode === "absolute" ? t("variants.editVariantDialog.price") : t("variants.editVariantDialog.priceDelta")}
                type="number"
                size="small"
                fullWidth
                value={editPriceDelta}
                onChange={(e) => setEditPriceDelta(e.target.value)}
                onKeyDown={blockNonDecimal}
                slotProps={{ htmlInput: { step: "0.01" } }}
                helperText={priceMode === "absolute"
                  ? t("variants.editVariantDialog.priceAbsoluteHelper", { base: basePrice })
                  : t("variants.editVariantDialog.priceDeltaHelper")}
              />
              <Tooltip title={priceMode === "absolute" ? t("variants.editVariantDialog.switchToDelta") : t("variants.editVariantDialog.switchToAbsolute")}>
                <IconButton size="small" sx={{ mt: 1 }} onClick={() => {
                  const val = parseFloat(editPriceDelta || "0");
                  const base = parseFloat(basePrice);
                  if (priceMode === "absolute") {
                    setEditPriceDelta(val === 0 ? "" : String(val - base));
                    setPriceMode("delta");
                  } else {
                    setEditPriceDelta(String(base + val));
                    setPriceMode("absolute");
                  }
                }}>
                  <SwapHorizIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                label={costMode === "absolute" ? t("variants.editVariantDialog.cost") : t("variants.editVariantDialog.costDelta")}
                type="number"
                size="small"
                fullWidth
                value={editCostDelta}
                onChange={(e) => setEditCostDelta(e.target.value)}
                onKeyDown={blockNonDecimal}
                slotProps={{ htmlInput: { step: "0.01" } }}
                helperText={costMode === "absolute"
                  ? t("variants.editVariantDialog.costAbsoluteHelper", { base: baseCost })
                  : t("variants.editVariantDialog.costDeltaHelper")}
              />
              <Tooltip title={costMode === "absolute" ? t("variants.editVariantDialog.switchToDelta") : t("variants.editVariantDialog.switchToAbsolute")}>
                <IconButton size="small" sx={{ mt: 1 }} onClick={() => {
                  const val = parseFloat(editCostDelta || "0");
                  const base = parseFloat(baseCost);
                  if (costMode === "absolute") {
                    setEditCostDelta(val === 0 ? "" : String(val - base));
                    setCostMode("delta");
                  } else {
                    setEditCostDelta(String(base + val));
                    setCostMode("absolute");
                  }
                }}>
                  <SwapHorizIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
            <TextField
              label={t("variants.editVariantDialog.weight")}
              type="number"
              size="small"
              fullWidth
              value={editWeight}
              onChange={(e) => setEditWeight(e.target.value)}
              onKeyDown={blockNonDecimal}
              slotProps={{ htmlInput: { step: "0.001", min: 0 }, inputLabel: { shrink: true } }}
              placeholder="—"
              helperText={t("variants.editVariantDialog.weightHelper")}
            />
            <TextField
              label={t("variants.editVariantDialog.lowStockThreshold")}
              type="number"
              size="small"
              fullWidth
              value={editLowStockThreshold}
              onChange={(e) => setEditLowStockThreshold(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              helperText={
                editLowStockThreshold === "" && productLowStockThreshold != null
                  ? t("variants.editVariantDialog.lowStockHelperInherit", { threshold: productLowStockThreshold })
                  : t("variants.editVariantDialog.lowStockHelper")
              }
            />
            {attributes.length > 0 && (
              <>
                <Divider />
                <Typography variant="caption" color="text.secondary" fontWeight="medium">
                  {t("variants.editVariantDialog.attributeValues")}
                </Typography>
                {attributes.map((attr) => (
                  <FormControl key={attr.id} size="small" fullWidth>
                    <InputLabel>{attr.name}</InputLabel>
                    <Select
                      label={attr.name}
                      value={editValueIds[attr.id] ?? ""}
                      onChange={(e) => setEditValueIds((prev) => ({ ...prev, [attr.id]: e.target.value }))}
                    >
                      <MenuItem value=""><em>{t("variants.editVariantDialog.none")}</em></MenuItem>
                      {attr.values.map((v) => (
                        <MenuItem key={v.id} value={v.id}>
                          {v.colorHex && (
                            <Box component="span" sx={{
                              display: "inline-block", width: 10, height: 10,
                              borderRadius: "50%", bgcolor: v.colorHex, mr: 0.75,
                            }} />
                          )}
                          {v.value}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ))}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>{t("common.cancel")}</Button>
          <Button variant="contained" disabled={update.isPending} onClick={async () => {
            const base = parseFloat(basePrice);
            const baseCostNum = parseFloat(baseCost);
            const priceVal = parseFloat(editPriceDelta || "0");
            const costVal = parseFloat(editCostDelta || "0");

            // In absolute mode: compute delta, set override if it differs from base+delta
            let priceDelta: string;
            let priceOverride: string | null = null;
            if (priceMode === "absolute") {
              priceDelta = String(priceVal - base);
              // Set override if the absolute price doesn't match what attribute deltas would give
              priceOverride = String(priceVal);
            } else {
              priceDelta = editPriceDelta || "0";
            }

            let costDelta: string;
            let costOverride: string | null = null;
            if (costMode === "absolute") {
              costDelta = String(costVal - baseCostNum);
              costOverride = String(costVal);
            } else {
              costDelta = editCostDelta || "0";
            }

            await update.mutateAsync({
              sku: editSku,
              priceDelta,
              costDelta,
              priceOverride,
              costOverride,
              weight: editWeight ? editWeight : null,
              lowStockThreshold: editLowStockThreshold !== "" ? Number(editLowStockThreshold) : null,
              attributeValueIds: Object.values(editValueIds).filter(Boolean),
            });
            setEditOpen(false);
            toast.success(t("variants.updated"));
          }}>{t("common.save")}</Button>
        </DialogActions>
      </Dialog>

      {/* Gallery picker */}
      <GalleryPickerDialog
        photos={photos}
        currentId={variant.galleryPhoto}
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onPick={async (photoId) => {
          await update.mutateAsync({ galleryPhoto: photoId });
          toast.success(t("variants.photoUpdated"));
        }}
        onUpload={async (files) => {
          for (const f of files) await uploadVariantPhoto.mutateAsync(f);
          setGalleryOpen(false);
          toast.success(t("variants.photoUploaded"));
        }}
        uploading={uploadVariantPhoto.isPending}
      />
    </>
  );
}

// ─── Variant management (Variants tab) ───────────────────────────────────────

function VariantManager({
  productId,
  attributes,
  variants,
  locations,
  photos,
  productName,
  productLowStockThreshold,
  basePrice,
  baseCost,
}: {
  productId: string;
  attributes: VariantAttribute[];
  variants: (ProductVariant & { stockByLocation?: Record<string, number> })[];
  locations: Array<{ id: string; name: string }>;
  photos: ProductDetail["photos"];
  productName: string;
  productLowStockThreshold: number | null;
  basePrice: string;
  baseCost: string;
}) {
  const { t } = useTranslation();
  const { data: wSettings } = useWarehouseSettings();
  const colorLib = wSettings?.colorLibrary ?? [];
  const hiddenHexes = new Set(colorLib.filter((c) => c.status === "hidden").map((c) => c.hex));
  const dbPresetHexes = new Set(colorLib.filter((c) => c.isPreset).map((c) => c.hex));
  const favoriteColors = sortByHue(colorLib.filter((c) => c.status === "favorite"));
  const normalCustom = colorLib.filter((c) => c.status === "normal" && !c.isPreset);
  const visiblePresets = COLOR_PRESETS.filter((c) => !hiddenHexes.has(c.hex) && !dbPresetHexes.has(c.hex));
  const normalColors = sortByHue([...normalCustom, ...visiblePresets]);
  const hasFavorites = favoriteColors.length > 0;
  const [showAllColors, setShowAllColors] = useState(false);
  const createAttr = useCreateAttribute();
  const deleteAttr = useDeleteAttribute();
  const createAttrValue = useCreateAttributeValue();
  const deleteAttrValue = useDeleteAttributeValue();
  const reorderAttrValues = useReorderAttributeValues();
  const createVariant = useCreateVariant();
  const deleteVariant = useDeleteVariant();

  // New / edit attribute dialog
  const [attrDialog, setAttrDialog] = useState<{ open: boolean; editing: VariantAttribute | null }>({ open: false, editing: null });
  const [attrName, setAttrName] = useState("");
  const [attrType, setAttrType] = useState<"text" | "color" | "number">("text");
  const updateAttr = useUpdateAttribute(attrDialog.editing?.id ?? "");
  const reorderAttrs = useReorderAttributes();

  const moveAttr = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= attributes.length) return;
    // Reassign sequential sort_orders based on new positions, so equal/stale
    // sort_order values (e.g. all 0 on old data) get corrected automatically.
    const reordered = [...attributes];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    reorderAttrs.mutate(
      reordered.map((attr, pos) => ({ id: attr.id, sortOrder: pos })),
      { onError: () => toast.error(t("variants.couldNotDelete")) },
    );
  };

  // New / edit value dialog
  const [valueDialog, setValueDialog] = useState<{ attr: VariantAttribute | null; editing: AttributeValue | null }>({ attr: null, editing: null });
  const [valueName, setValueName] = useState("");
  const [valueColor, setValueColor] = useState("");
  const [valuePriceDelta, setValuePriceDelta] = useState("");
  const [valueCostDelta, setValueCostDelta] = useState("");
  const [valueWeightDelta, setValueWeightDelta] = useState("");
  const updateAttrValue = useUpdateAttributeValue(valueDialog.editing?.id ?? "");

  // New variant dialog
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantSku, setVariantSku] = useState("");
  const [variantPriceDelta, setVariantPriceDelta] = useState("");
  const [variantCostDelta, setVariantCostDelta] = useState("");
  const [variantWeight, setVariantWeight] = useState("");
  const [variantValueIds, setVariantValueIds] = useState<Record<string, string>>({});

  // Assign values to existing (default) variant
  const [assignDialogVariant, setAssignDialogVariant] = useState<(typeof variants)[0] | null>(null);
  const [assignValueIds, setAssignValueIds] = useState<Record<string, string>>({});
  const updateVariant = useUpdateVariant(assignDialogVariant?.id ?? "");

  // Redistribute dialog
  const [redistOpen, setRedistOpen] = useState(false);
  const [redistDeltas, setRedistDeltas] = useState<Record<string, number>>({});
  const [redistLocationId, setRedistLocationId] = useState("");
  const redistribute = useRedistributeStock();

  const openRedistribute = (prefill?: Record<string, number>) => {
    setRedistDeltas(prefill ?? Object.fromEntries(activeVariants.map((v) => [v.id, 0])));
    setRedistOpen(true);
  };

  const redistTotal = Object.values(redistDeltas).reduce((s, n) => s + n, 0);

  const handleRedistribute = async () => {
    const lines = Object.entries(redistDeltas)
      .filter(([, delta]) => delta !== 0)
      .map(([variantId, delta]) => ({ variantId, delta }));
    if (lines.length === 0 || redistTotal !== 0) return;
    try {
      await redistribute.mutateAsync({ locationId: redistLocationId, lines });
      toast.success(t("variants.redistribute.done"));
      setRedistOpen(false);
      // Auto-delete empty default variant
      const defaultVar = variants.find((v) => v.isDefault && v.attributeValues.length === 0);
      if (defaultVar) {
        const defaultDelta = redistDeltas[defaultVar.id] ?? 0;
        if (defaultVar.totalStock + defaultDelta <= 0) {
          try { await deleteVariant.mutateAsync(defaultVar.id); } catch { /* has movements, leave it */ }
        }
      }
    } catch {
      toast.error(t("variants.redistribute.error"));
    }
  };

  // Batch add stock panel
  const [batchStockOpen, setBatchStockOpen] = useState(false);
  const [batchStockCart, setBatchStockCart] = useState<Record<string, number>>({});
  const [batchStockLocationId, setBatchStockLocationId] = useState("");
  const [batchStockNote, setBatchStockNote] = useState("");
  const [batchStockDate, setBatchStockDate] = useState(new Date().toISOString().slice(0, 16));
  const batchAddStock = useAddStock();
  const { data: batchLocations } = useLocations();

  useEffect(() => {
    if (!batchStockLocationId && batchLocations && batchLocations.length > 0) {
      const def = batchLocations.find((l: { isDefault: boolean }) => l.isDefault) ?? batchLocations[0];
      setBatchStockLocationId(def.id);
    }
  }, [batchLocations, batchStockLocationId]);

  const batchStockAdjust = (variantId: string, delta: number) => {
    setBatchStockCart((prev) => {
      const next = { ...prev };
      const current = next[variantId] ?? 0;
      const newQty = current + delta;
      if (newQty <= 0) { delete next[variantId]; } else { next[variantId] = newQty; }
      return next;
    });
  };

  const batchStockSubmit = async () => {
    const lines = Object.entries(batchStockCart)
      .filter(([, qty]) => qty > 0)
      .map(([variantId, quantity]) => ({ variantId, quantity, locationId: batchStockLocationId || undefined }));
    if (lines.length === 0) return;
    await batchAddStock.mutateAsync({
      lines,
      note: batchStockNote || undefined,
      movementDate: new Date(batchStockDate).toISOString(),
    });
    toast.success(t("variants.batchStock.added", { count: lines.length }));
    setBatchStockCart({});
    setBatchStockNote("");
    setBatchStockOpen(false);
  };

  const batchStockTotal = Object.values(batchStockCart).reduce((s, n) => s + n, 0);

  // Generate all combinations dialog
  const [genOpen, setGenOpen] = useState(false);
  const [genSelected, setGenSelected] = useState<Record<string, Set<string>>>({});
  const [genCreating, setGenCreating] = useState(false);

  const openGenDialog = () => {
    const initial: Record<string, Set<string>> = {};
    for (const attr of attributes) {
      initial[attr.id] = new Set(attr.values.map((v) => v.id));
    }
    setGenSelected(initial);
    setGenOpen(true);
  };

  const toggleGenValue = (attrId: string, valueId: string) => {
    setGenSelected((prev) => {
      const next = new Set(prev[attrId]);
      if (next.has(valueId)) next.delete(valueId);
      else next.add(valueId);
      return { ...prev, [attrId]: next };
    });
  };

  const cartesian = (sets: string[][]): string[][] => {
    if (sets.length === 0) return [[]];
    const [first, ...rest] = sets;
    const restResult = cartesian(rest);
    return first.flatMap((v) => restResult.map((r) => [v, ...r]));
  };

  const existingCombinations = variants.map((v) => new Set(v.attributeValues.map((av) => av.id)));
  const isCombinationExisting = (ids: string[]) =>
    existingCombinations.some((ex) => ex.size === ids.length && ids.every((id) => ex.has(id)));

  const sortedAttributes = [...attributes].sort((a, b) =>
    a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id.localeCompare(b.id)
  );
  const selectedSets = sortedAttributes
    .map((attr) => Array.from(genSelected[attr.id] ?? []))
    .filter((s) => s.length > 0);
  const allCombinations = cartesian(selectedSets);
  const newCombinations = allCombinations.filter((ids) => ids.length > 0 && !isCombinationExisting(ids));

  const handleGenerate = async () => {
    setGenCreating(true);
    try {
      for (const ids of newCombinations) {
        await createVariant.mutateAsync({
          product: productId,
          sku: "",
          priceDelta: "0",
          costDelta: "0",
          photo: null,
          galleryPhoto: null,
          lowStockThreshold: null,
          isActive: true,
          attributeValueIds: ids,
        });
      }
      // Auto-remove the default variant if it has no stock and no attribute values
      const defaultVariant = variants.find((v) => v.isDefault && v.attributeValues.length === 0);
      if (defaultVariant && defaultVariant.totalStock === 0) {
        try { await deleteVariant.mutateAsync(defaultVariant.id); } catch { /* has movements, leave it */ }
      }
      setGenOpen(false);
      toast.success(t("variants.generateDialog.created_other", { count: newCombinations.length }));
      // If default variant has stock, prompt to redistribute
      if (defaultVariant && defaultVariant.totalStock > 0) {
        const firstLoc = batchLocations?.find((l) =>
          (defaultVariant.stockByLocation?.[l.id] ?? 0) > 0
        );
        setRedistLocationId(firstLoc?.id ?? batchLocations?.[0]?.id ?? "");
        const prefill: Record<string, number> = { [defaultVariant.id]: -defaultVariant.totalStock };
        openRedistribute(prefill);
      }
    } finally {
      setGenCreating(false);
    }
  };

  const openNewAttr = () => { setAttrDialog({ open: true, editing: null }); setAttrName(""); setAttrType("text"); };
  const openEditAttr = (attr: VariantAttribute) => { setAttrDialog({ open: true, editing: attr }); setAttrName(attr.name); setAttrType(attr.attributeType); };

  const handleSaveAttr = async () => {
    if (attrDialog.editing) {
      await updateAttr.mutateAsync({ name: attrName, attributeType: attrType });
      toast.success(t("variants.attributeUpdated"));
    } else {
      await createAttr.mutateAsync({ name: attrName, attributeType: attrType, sortOrder: attributes.length, product: productId });
      toast.success(t("variants.attributeCreated"));
    }
    setAttrDialog({ open: false, editing: null });
  };

  const openNewValue = (attr: VariantAttribute) => { setValueDialog({ attr, editing: null }); setValueName(""); setValueColor(""); setValuePriceDelta(""); setValueCostDelta(""); };
  const openEditValue = (attr: VariantAttribute, v: AttributeValue) => { setValueDialog({ attr, editing: v }); setValueName(v.value); setValueColor(v.colorHex ?? ""); setValuePriceDelta(parseFloat(v.priceDelta) !== 0 ? v.priceDelta : ""); setValueCostDelta(parseFloat(v.costDelta) !== 0 ? v.costDelta : ""); setValueWeightDelta(parseFloat(v.weightDelta) !== 0 ? v.weightDelta : ""); };

  const handleSaveValue = async () => {
    const { attr, editing } = valueDialog;
    if (!attr) return;
    const isColor = attr.attributeType === "color";
    const deltas = { priceDelta: valuePriceDelta || "0", costDelta: valueCostDelta || "0", weightDelta: valueWeightDelta || "0" };
    // Check for duplicate value name
    const isDuplicate = attr.values.some((v) =>
      v.value.toLowerCase() === valueName.trim().toLowerCase() && v.id !== editing?.id
    );
    if (isDuplicate) {
      toast.error(t("variants.valueDuplicate", { name: valueName.trim() }));
      return;
    }
    try {
      if (editing) {
        await updateAttrValue.mutateAsync({ value: valueName, colorHex: isColor ? (valueColor || null) : null, ...deltas });
        toast.success(t("variants.valueUpdated"));
      } else {
        await createAttrValue.mutateAsync({ value: valueName, colorHex: isColor ? (valueColor || null) : null, sortOrder: attr.values.length, attribute: attr.id, ...deltas });
        toast.success(t("variants.valueAdded"));
      }
      setValueDialog({ attr: null, editing: null });
    } catch {
      // Global error handler shows the toast, but if it's a unique constraint, be specific
    }
  };

  const handleCreateVariant = async () => {
    await createVariant.mutateAsync({
      product: productId,
      sku: variantSku || "",
      priceDelta: variantPriceDelta || "0",
      costDelta: variantCostDelta || "0",
      weight: variantWeight || null,
      photo: null,
      galleryPhoto: null,
      lowStockThreshold: null,
      isActive: true,
      attributeValueIds: Object.values(variantValueIds).filter(Boolean),
    });
    setVariantSku(""); setVariantPriceDelta(""); setVariantCostDelta(""); setVariantWeight(""); setVariantValueIds({});
    setVariantDialogOpen(false);
    toast.success(t("variants.created"));
  };

  const handleAssignValues = async () => {
    if (!assignDialogVariant) return;
    await updateVariant.mutateAsync({ attributeValueIds: Object.values(assignValueIds).filter(Boolean) });
    setAssignValueIds({}); setAssignDialogVariant(null);
    toast.success(t("variants.updated"));
  };

  const activeVariants = sortVariants(variants.filter((v) => v.isActive));
  const archivedVariants = sortVariants(variants.filter((v) => !v.isActive));
  const confirm = useConfirm();

  return (
    <Stack spacing={2}>
      {/* Attributes section */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2" fontWeight="bold">{t("variants.attributes")}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={openNewAttr}>{t("variants.addAttribute")}</Button>
      </Stack>

      {attributes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("variants.noAttributes")}
        </Typography>
      ) : (
        <Stack spacing={1}>
          {attributes.map((attr, idx) => (
            <Paper key={attr.id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                {/* Order controls */}
                <Stack direction="column" sx={{ gap: 0 }}>
                  <IconButton size="small" disabled={idx === 0 || reorderAttrs.isPending}
                    onClick={() => moveAttr(idx, -1)} sx={{ p: 0.25 }}>
                    <ArrowUpwardIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                  <IconButton size="small" disabled={idx === attributes.length - 1 || reorderAttrs.isPending}
                    onClick={() => moveAttr(idx, 1)} sx={{ p: 0.25 }}>
                    <ArrowDownwardIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                </Stack>
                <Typography variant="body2" fontWeight="medium" sx={{ flex: 1 }}>{attr.name}</Typography>
                <Chip label={attr.attributeType} size="small" variant="outlined" sx={{ height: 16, fontSize: "0.6rem" }} />
                {attr.values.length > 1 && (
                  <Tooltip title="Sort values A→Z">
                    <IconButton size="small" disabled={reorderAttrValues.isPending} onClick={() => {
                      const sorted = [...attr.values].sort((a, b) => a.value.localeCompare(b.value));
                      reorderAttrValues.mutate(sorted.map((v, i) => ({ id: v.id, sortOrder: i })));
                    }}>
                      <SortIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={t("variants.renameAttributeTooltip")}>
                  <IconButton size="small" onClick={() => openEditAttr(attr)}>
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("variants.deleteAttributeTooltip")}>
                  <IconButton size="small" color="error" onClick={async () => {
                    if (!await confirm(t("variants.deleteAttributeConfirm", { name: attr.name }), { title: t("variants.deleteAttributeTitle"), confirmLabel: t("common.delete") })) return;
                    await deleteAttr.mutateAsync(attr.id);
                    toast.success(t("variants.attributeDeleted"));
                  }}>
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
                {attr.values.map((v) => (
                  <Chip
                    key={v.id}
                    label={(() => {
                      const pd = parseFloat(v.priceDelta);
                      const cd = parseFloat(v.costDelta);
                      const parts = [v.value];
                      const deltas = [];
                      if (pd !== 0) deltas.push(`p${pd > 0 ? "+" : ""}€${pd}`);
                      if (cd !== 0) deltas.push(`c${cd > 0 ? "+" : ""}€${cd}`);
                      if (deltas.length) parts.push(deltas.join(" "));
                      return parts.join(" · ");
                    })()}
                    size="small"
                    icon={v.colorHex ? (
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: v.colorHex, ml: 0.5 }} />
                    ) : undefined}
                    onClick={() => openEditValue(attr, v)}
                    onDelete={async () => {
                      if (!await confirm(`${t("variants.deleteValueConfirm", { value: v.value })}\n\n${t("variants.deleteValueWarning")}`, { title: t("variants.deleteValueTitle"), confirmLabel: t("common.delete") })) return;
                      await deleteAttrValue.mutateAsync(v.id);
                      toast.success(t("variants.valueDeleted"));
                    }}
                  />
                ))}
                <Button size="small" sx={{ minWidth: 0, px: 1, py: 0.25 }} onClick={() => openNewValue(attr)}>
                  + value
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Divider />

      {/* Variants section */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2" fontWeight="bold">{t("variants.variants")}</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant={batchStockOpen ? "contained" : "outlined"}
            color="success"
            onClick={() => setBatchStockOpen((v) => !v)}
          >
            {t("variants.batchStock.button")}
          </Button>
          {activeVariants.length > 1 && (
            <Button size="small" variant="outlined" onClick={() => {
              // Auto-select location: use the first location that has stock
              const firstLoc = batchLocations?.find((l) =>
                activeVariants.some((v) => (v.stockByLocation?.[l.id] ?? 0) > 0)
              );
              setRedistLocationId(firstLoc?.id ?? batchLocations?.[0]?.id ?? "");
              openRedistribute();
            }}>
              {t("variants.redistribute.button")}
            </Button>
          )}
          {attributes.length > 0 && attributes.some((a) => a.values.length > 0) && (
            <Button size="small" variant="outlined" onClick={openGenDialog}>
              {t("variants.generateCombinations")}
            </Button>
          )}
          {attributes.length > 0 && (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setVariantDialogOpen(true)}>
              {t("variants.addVariant")}
            </Button>
          )}
        </Stack>
      </Stack>

      {/* ── Batch Add Stock panel ── */}
      {batchStockOpen && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ flex: 1 }}>
              {t("variants.batchStock.title")}
              {batchStockTotal > 0 && <Chip label={`${batchStockTotal} units`} size="small" color="success" sx={{ ml: 1 }} />}
            </Typography>
            {Object.keys(batchStockCart).length > 0 && (
              <IconButton size="small" onClick={() => setBatchStockCart({})} title={t("variants.batchStock.clear")}>
                <DeleteIcon sx={{ fontSize: 16, color: "text.disabled" }} />
              </IconButton>
            )}
          </Stack>

          <Stack spacing={0.5} sx={{ mb: 2 }}>
            {activeVariants.map((v) => {
              const vLabel = v.isDefault ? productName : (variantLabel(v.attributeValues) || t("common.default"));
              const qty = batchStockCart[v.id] ?? 0;
              return (
                <Stack key={v.id} direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{vLabel}</Typography>
                  <Chip label={`${v.totalStock}`} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.7rem" }} />
                  {[10, 5, 1].map((n) => (
                    <Button key={-n} size="small" variant="outlined" color="error" disabled={qty < n}
                      sx={{ minWidth: 32, px: 0.5, fontSize: "0.7rem" }}
                      onClick={() => batchStockAdjust(v.id, -n)}>
                      -{n}
                    </Button>
                  ))}
                  <TextField
                    size="small"
                    type="number"
                    value={qty || ""}
                    placeholder="0"
                    onChange={(e) => {
                      const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                      setBatchStockCart((prev) => {
                        const next = { ...prev };
                        if (val <= 0) { delete next[v.id]; } else { next[v.id] = val; }
                        return next;
                      });
                    }}
                    slotProps={{ htmlInput: { min: 0, step: 1, style: { textAlign: "center", padding: "2px 0" } } }}
                    sx={{ width: 48, flexShrink: 0, "& .MuiOutlinedInput-root": { height: 26 }, "& input[type=number]::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 }, "& input[type=number]::-webkit-outer-spin-button": { WebkitAppearance: "none", margin: 0 }, "& input[type=number]": { MozAppearance: "textfield" } }}
                  />
                  {[1, 5, 10].map((n) => (
                    <Button key={n} size="small" variant="outlined" sx={{ minWidth: 32, px: 0.5, fontSize: "0.7rem" }}
                      onClick={() => batchStockAdjust(v.id, n)}>
                      +{n}
                    </Button>
                  ))}
                </Stack>
              );
            })}
          </Stack>

          <Divider sx={{ mb: 1.5 }} />

          <Stack spacing={1.5}>
            {batchLocations && batchLocations.length > 1 && (
              <FormControl size="small" fullWidth>
                <InputLabel>{t("common.location")}</InputLabel>
                <Select label={t("common.location")} value={batchStockLocationId} onChange={(e) => setBatchStockLocationId(e.target.value)}>
                  {batchLocations.map((l) => (
                    <MenuItem key={l.id} value={l.id}>{l.name}{l.isDefault ? " ★" : ""}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <TextField
              label={t("common.date")} type="datetime-local" size="small" fullWidth
              value={batchStockDate} onChange={(e) => setBatchStockDate(e.target.value)}
            />
            <TextField
              label={t("common.noteOptional")} size="small" fullWidth
              value={batchStockNote} onChange={(e) => setBatchStockNote(e.target.value)}
            />
            <Button
              variant="contained" color="success" fullWidth
              disabled={batchStockTotal === 0 || batchAddStock.isPending}
              onClick={batchStockSubmit}
            >
              {batchStockTotal > 0
                ? t("variants.batchStock.submit", { count: batchStockTotal })
                : t("variants.batchStock.submitEmpty")}
            </Button>
          </Stack>
        </Paper>
      )}

      {variants.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{t("variants.noVariants")}</Typography>
      ) : (
        <Stack spacing={1}>
          {/* Aggregate stock summary across all active variants */}
          {activeVariants.length > 0 && (() => {
            const agg: Record<string, number> = {};
            let total = 0;
            for (const v of activeVariants) {
              total += v.totalStock;
              for (const [locId, qty] of Object.entries(v.stockByLocation ?? {})) {
                agg[locId] = (agg[locId] ?? 0) + qty;
              }
            }
            const locsWithStock = locations.filter((l) => agg[l.id] > 0);
            return locsWithStock.length > 0 ? (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" alignItems="center" sx={{ px: 1, py: 0.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">{t("variants.totalStock")}:</Typography>
                {locsWithStock.map((loc) => (
                  <Chip key={loc.id} label={`${loc.name}: ${agg[loc.id]}`} size="small" variant="outlined" />
                ))}
                {locsWithStock.length > 1 && (
                  <Chip label={`Σ ${total}`} size="small" color={total === 0 ? "error" : "success"} />
                )}
              </Stack>
            ) : null;
          })()}

          {/* Active variants */}
          {activeVariants.length > 0 && (
            <Paper variant="outlined">
              <Stack divider={<Divider />}>
                {activeVariants.map((v) => (
                  <Box key={v.id}>
                    <VariantRow
                      variant={v}
                      locations={locations}
                      photos={photos}
                      productName={productName}
                      isOnlyVariant={activeVariants.length === 1}
                      attributes={attributes}
                      productLowStockThreshold={productLowStockThreshold}
                      basePrice={basePrice}
                      baseCost={baseCost}
                    />
                    {v.isDefault && v.attributeValues.length === 0 && attributes.length > 0 && (
                      <Box sx={{ px: 2, pb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("variants.noAttributeValues")}{" "}
                        </Typography>
                        <Typography
                          variant="caption" color="primary"
                          sx={{ cursor: "pointer", textDecoration: "underline" }}
                          onClick={() => { setAssignDialogVariant(v); setAssignValueIds({}); }}
                        >
                          {t("variants.assignValues")}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Archived variants */}
          {archivedVariants.length > 0 && (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <ArchiveIcon sx={{ fontSize: 13 }} /> {t("variants.archivedCount", { count: archivedVariants.length })}
              </Typography>
              <Paper variant="outlined" sx={{ opacity: 0.7 }}>
                <Stack divider={<Divider />}>
                  {archivedVariants.map((v) => (
                    <VariantRow
                      key={v.id}
                      variant={v}
                      locations={locations}
                      photos={photos}
                      productName={productName}
                      isOnlyVariant={false}
                      attributes={attributes}
                      productLowStockThreshold={productLowStockThreshold}
                      basePrice={basePrice}
                      baseCost={baseCost}
                    />
                  ))}
                </Stack>
              </Paper>
            </Stack>
          )}
        </Stack>
      )}

      {/* ── Redistribute dialog ── */}
      <Dialog open={redistOpen} onClose={() => setRedistOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("variants.redistribute.title")}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {batchLocations && batchLocations.length > 1 && (
              <FormControl size="small" fullWidth>
                <InputLabel>{t("common.location")}</InputLabel>
                <Select label={t("common.location")} value={redistLocationId} onChange={(e) => setRedistLocationId(e.target.value)}>
                  {batchLocations.map((l) => (
                    <MenuItem key={l.id} value={l.id}>{l.name}{l.isDefault ? " ★" : ""}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {activeVariants.map((v) => {
              const vLabel = v.isDefault && v.attributeValues.length === 0
                ? t("common.default")
                : (variantLabel(v.attributeValues) || productName);
              const currentStock = redistLocationId
                ? (v.stockByLocation?.[redistLocationId] ?? 0)
                : v.totalStock;
              const delta = redistDeltas[v.id] ?? 0;
              return (
                <Stack key={v.id} direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{vLabel}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 24, textAlign: "right" }}>{currentStock}</Typography>
                  <TextField
                    size="small" type="number"
                    value={delta || ""}
                    placeholder="0"
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setRedistDeltas((prev) => ({ ...prev, [v.id]: val }));
                    }}
                    slotProps={{ htmlInput: { style: { textAlign: "center", padding: "4px 0" } }, inputLabel: { shrink: true } }}
                    sx={{ width: 72, "& .MuiOutlinedInput-root": { height: 30 } }}
                  />
                  <Typography variant="caption" color={currentStock + delta < 0 ? "error.main" : "text.secondary"} sx={{ minWidth: 24 }}>
                    →{currentStock + delta}
                  </Typography>
                </Stack>
              );
            })}
            <Divider />
            {(() => {
              const hasNegative = activeVariants.some((v) => (v.stockByLocation?.[redistLocationId] ?? 0) + (redistDeltas[v.id] ?? 0) < 0);
              const isBalanced = redistTotal === 0;
              const hasChanges = Object.values(redistDeltas).some((d) => d !== 0);
              return (
                <Stack spacing={0.5}>
                  <Typography variant="body2" fontWeight="bold" color={isBalanced ? "success.main" : "error.main"} textAlign="center">
                    {isBalanced ? t("variants.redistribute.balanced") : t("variants.redistribute.remaining", { count: Math.abs(redistTotal) }) + ` (${redistTotal > 0 ? "+" : ""}${redistTotal})`}
                  </Typography>
                  {hasNegative && (
                    <Typography variant="caption" color="error.main" textAlign="center">
                      {t("variants.redistribute.negativeError")}
                    </Typography>
                  )}
                  {!hasChanges && (
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      {t("variants.redistribute.noChanges")}
                    </Typography>
                  )}
                </Stack>
              );
            })()}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRedistOpen(false)}>{t("common.cancel")}</Button>
          <Tooltip title={
            redistTotal !== 0 ? t("variants.redistribute.mustSumToZero")
            : activeVariants.some((v) => (v.stockByLocation?.[redistLocationId] ?? 0) + (redistDeltas[v.id] ?? 0) < 0) ? t("variants.redistribute.negativeError")
            : ""
          }>
            <span>
              <Button
                variant="contained"
                disabled={redistTotal !== 0 || redistribute.isPending || !redistLocationId || !Object.values(redistDeltas).some((d) => d !== 0) || activeVariants.some((v) => (v.stockByLocation?.[redistLocationId] ?? 0) + (redistDeltas[v.id] ?? 0) < 0)}
                onClick={handleRedistribute}
              >
                {t("variants.redistribute.submit")}
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

      {/* ── Add/Edit Attribute dialog ── */}
      <Dialog open={attrDialog.open} onClose={() => setAttrDialog({ open: false, editing: null })} maxWidth="xs" fullWidth>
        <DialogTitle>{attrDialog.editing ? t("variants.addAttributeDialog.editTitle") : t("variants.addAttributeDialog.title")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("variants.addAttributeDialog.namePlaceholder")}
              fullWidth size="small" autoFocus
              value={attrName}
              onChange={(e) => setAttrName(e.target.value)}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>{t("common.type")}</InputLabel>
              <Select label={t("common.type")} value={attrType} onChange={(e) => {
                const newType = e.target.value as "text" | "color" | "number";
                setAttrType(newType);
                if (newType === "color" && !attrName.trim() && !attrDialog.editing) {
                  setAttrName(t("variants.addAttributeDialog.colorDefault"));
                }
              }}>
                <MenuItem value="text">{t("variants.addAttributeDialog.typeText")}</MenuItem>
                <MenuItem value="color">{t("variants.addAttributeDialog.typeColor")}</MenuItem>
                <MenuItem value="number">{t("variants.addAttributeDialog.typeNumber")}</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAttrDialog({ open: false, editing: null })}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleSaveAttr}
            disabled={!attrName || createAttr.isPending || updateAttr.isPending}>
            {attrDialog.editing ? t("common.save") : t("common.create")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add/Edit Value dialog ── */}
      <Dialog open={!!valueDialog.attr} onClose={() => setValueDialog({ attr: null, editing: null })} maxWidth="xs" fullWidth>
        <DialogTitle>
          {valueDialog.editing ? t("variants.addValueDialog.editTitle") : t("variants.addValueDialog.addTitle", { attrName: valueDialog.attr?.name })}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("variants.addValueDialog.valuePlaceholder")} fullWidth size="small" autoFocus
              value={valueName}
              onChange={(e) => setValueName(e.target.value)}
            />
            {valueDialog.attr?.attributeType === "color" && (
              <>
                <Box>
                  {hasFavorites ? (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: "block" }}>
                        {t("variants.addValueDialog.favorites")}
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                        {favoriteColors.map((c) => (
                          <Tooltip key={c.hex} title={c.name} placement="top">
                            <Box
                              onClick={() => { if (!valueName.trim()) setValueName(c.name); setValueColor(c.hex); }}
                              sx={{
                                width: 24, height: 24, borderRadius: "50%",
                                bgcolor: c.hex, border: "2px solid",
                                borderColor: valueColor === c.hex ? "primary.main" : "divider",
                                cursor: "pointer", transition: "border-color 0.15s, transform 0.1s",
                                "&:hover": { transform: "scale(1.2)", borderColor: "primary.main" },
                              }}
                            />
                          </Tooltip>
                        ))}
                      </Box>
                      {normalColors.length > 0 && (
                        <>
                          <Button size="small" sx={{ mt: 0.5, textTransform: "none", fontSize: "0.7rem", p: 0 }} onClick={() => setShowAllColors((v) => !v)}>
                            {showAllColors ? t("variants.addValueDialog.hideDefaults") : t("variants.addValueDialog.showDefaults")}
                          </Button>
                          {showAllColors && (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
                              {normalColors.map((c) => (
                                <Tooltip key={c.hex} title={c.name} placement="top">
                                  <Box
                                    onClick={() => { if (!valueName.trim()) setValueName(c.name); setValueColor(c.hex); }}
                                    sx={{
                                      width: 20, height: 20, borderRadius: "50%",
                                      bgcolor: c.hex, border: "2px solid",
                                      borderColor: valueColor === c.hex ? "primary.main" : "divider",
                                      cursor: "pointer", opacity: 0.7,
                                      "&:hover": { opacity: 1, borderColor: "primary.main" },
                                    }}
                                  />
                                </Tooltip>
                              ))}
                            </Box>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: "block" }}>
                        {t("variants.addValueDialog.presetsLabel")}
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                        {normalColors.map((c) => (
                          <Tooltip key={c.hex} title={c.name} placement="top">
                            <Box
                              onClick={() => { if (!valueName.trim()) setValueName(c.name); setValueColor(c.hex); }}
                              sx={{
                                width: 24, height: 24, borderRadius: "50%",
                                bgcolor: c.hex, border: "2px solid",
                                borderColor: valueColor === c.hex ? "primary.main" : "divider",
                                cursor: "pointer", transition: "border-color 0.15s, transform 0.1s",
                                "&:hover": { transform: "scale(1.2)", borderColor: "primary.main" },
                              }}
                            />
                          </Tooltip>
                        ))}
                      </Box>
                    </>
                  )}
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label={t("variants.addValueDialog.hexColor")} size="small"
                    value={valueColor}
                    onChange={(e) => setValueColor(e.target.value)}
                    placeholder="#ff0000"
                    sx={{ flex: 1 }}
                  />
                  <Box sx={{ position: "relative" }}>
                    <Box
                      component="input"
                      type="color"
                      value={valueColor || "#ffffff"}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValueColor(e.target.value)}
                      sx={{
                        position: "absolute", inset: 0, opacity: 0,
                        width: "100%", height: "100%", cursor: "pointer", border: "none", p: 0,
                      }}
                    />
                    <Box sx={{
                      width: 32, height: 32, borderRadius: "50%",
                      bgcolor: valueColor || "grey.200",
                      border: "2px solid", borderColor: "divider",
                      cursor: "pointer", pointerEvents: "none",
                    }} />
                  </Box>
                </Stack>
              </>
            )}
            <Divider />
            <Stack direction="row" spacing={1}>
              <TextField
                label="Price delta (€)" size="small" type="number" sx={{ flex: 1 }}
                value={valuePriceDelta}
                onChange={(e) => setValuePriceDelta(e.target.value)}
                onKeyDown={blockNonDecimal}
                placeholder="0"
                slotProps={{ htmlInput: { step: "0.01" } }}
                helperText="Added to variant price"
              />
              <TextField
                label="Cost delta (€)" size="small" type="number" sx={{ flex: 1 }}
                value={valueCostDelta}
                onChange={(e) => setValueCostDelta(e.target.value)}
                onKeyDown={blockNonDecimal}
                placeholder="0"
                slotProps={{ htmlInput: { step: "0.01" } }}
                helperText="Added to variant cost"
              />
            </Stack>
            <TextField
              label="Weight delta (g)" size="small" type="number" fullWidth
              value={valueWeightDelta}
              onChange={(e) => setValueWeightDelta(e.target.value)}
              onKeyDown={blockNonDecimal}
              placeholder="0"
              slotProps={{ htmlInput: { step: "0.001" } }}
              helperText="Added to variant weight"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValueDialog({ attr: null, editing: null })}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleSaveValue}
            disabled={!valueName || createAttrValue.isPending || updateAttrValue.isPending}>
            {valueDialog.editing ? t("common.save") : t("variants.addValueDialog.add")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Assign values to default variant dialog ── */}
      <Dialog open={!!assignDialogVariant} onClose={() => setAssignDialogVariant(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("variants.assignValuesDialog.title")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {attributes.map((attr) => (
              <FormControl key={attr.id} size="small" fullWidth>
                <InputLabel>{attr.name}</InputLabel>
                <Select
                  label={attr.name}
                  value={assignValueIds[attr.id] ?? ""}
                  onChange={(e) => setAssignValueIds({ ...assignValueIds, [attr.id]: e.target.value })}
                >
                  <MenuItem value="">— {t("common.default")} —</MenuItem>
                  {attr.values.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.colorHex && <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", bgcolor: v.colorHex, mr: 1 }} />}
                      {v.value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogVariant(null)}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleAssignValues} disabled={updateVariant.isPending}>{t("common.save")}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Add Variant dialog ── */}
      <Dialog open={variantDialogOpen} onClose={() => setVariantDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("variants.addVariantDialog.title")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {attributes.map((attr) => (
              <FormControl key={attr.id} size="small" fullWidth>
                <InputLabel>{attr.name}</InputLabel>
                <Select
                  label={attr.name}
                  value={variantValueIds[attr.id] ?? ""}
                  onChange={(e) => setVariantValueIds({ ...variantValueIds, [attr.id]: e.target.value })}
                >
                  <MenuItem value="">— {t("common.default")} —</MenuItem>
                  {attr.values.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.colorHex && <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", bgcolor: v.colorHex, mr: 1 }} />}
                      {v.value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
            <TextField
              label={t("variants.addVariantDialog.skuOptional")} size="small" fullWidth
              value={variantSku}
              onChange={(e) => setVariantSku(e.target.value)}
            />
            <TextField
              label={t("variants.addVariantDialog.priceDelta")}
              type="number" size="small" fullWidth
              value={variantPriceDelta}
              onChange={(e) => setVariantPriceDelta(e.target.value)}
              onKeyDown={blockNonDecimal}
              slotProps={{ htmlInput: { step: "0.01" } }}
              helperText={t("variants.addVariantDialog.priceDeltaHelper")}
            />
            <TextField
              label={t("variants.addVariantDialog.costDelta")}
              type="number" size="small" fullWidth
              value={variantCostDelta}
              onChange={(e) => setVariantCostDelta(e.target.value)}
              onKeyDown={blockNonDecimal}
              slotProps={{ htmlInput: { step: "0.01" } }}
              helperText={t("variants.addVariantDialog.costDeltaHelper")}
            />
            <TextField
              label={t("variants.addVariantDialog.weight")}
              type="number" size="small" fullWidth
              value={variantWeight}
              onChange={(e) => setVariantWeight(e.target.value)}
              onKeyDown={blockNonDecimal}
              slotProps={{ htmlInput: { step: "0.001", min: 0 }, inputLabel: { shrink: true } }}
              placeholder="—"
              helperText={t("variants.addVariantDialog.weightHelper")}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVariantDialogOpen(false)}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleCreateVariant} disabled={createVariant.isPending}>{t("common.create")}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Generate combinations dialog ── */}
      <Dialog open={genOpen} onClose={() => setGenOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("variants.generateDialog.title")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t("variants.generateDialog.description")}
            </Typography>

            {attributes.map((attr) => (
              <Box key={attr.id}>
                <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {attr.name}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 0.5 }}>
                  {attr.values.map((v) => {
                    const selected = genSelected[attr.id]?.has(v.id) ?? false;
                    return (
                      <Chip
                        key={v.id}
                        label={v.value}
                        size="small"
                        variant={selected ? "filled" : "outlined"}
                        color={selected ? "primary" : "default"}
                        icon={v.colorHex ? (
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: v.colorHex, ml: 0.5 }} />
                        ) : undefined}
                        onClick={() => toggleGenValue(attr.id, v.id)}
                        sx={{ cursor: "pointer" }}
                      />
                    );
                  })}
                </Stack>
              </Box>
            ))}

            <Divider />

            {/* Preview */}
            {selectedSets.some((s) => s.length > 0) ? (
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  {t(allCombinations.length !== 1 ? "variants.generateDialog.combinationsSummary_other" : "variants.generateDialog.combinationsSummary_one", {
                    total: allCombinations.length,
                    new: newCombinations.length,
                    existing: allCombinations.length - newCombinations.length,
                  })}
                </Typography>
                {newCombinations.length > 50 && (
                  <Typography variant="body2" color="warning.main" fontWeight="bold">
                    {t("variants.generateDialog.largeWarning", { count: newCombinations.length })}
                  </Typography>
                )}
                {newCombinations.length > 0 && newCombinations.length <= 20 && (
                  <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                    {newCombinations.map((ids) => {
                      const labels = ids.map((id) => {
                        for (const attr of sortedAttributes) {
                          const val = attr.values.find((v) => v.id === id);
                          if (val) return val.value;
                        }
                        return id;
                      });
                      return (
                        <Chip key={ids.join("+")} label={labels.join(" | ")} size="small" variant="outlined" />
                      );
                    })}
                  </Stack>
                )}
                {newCombinations.length > 20 && (
                  <Typography variant="caption" color="text.secondary">
                    {t("variants.generateDialog.hiddenList")}
                  </Typography>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t("variants.generateDialog.selectAtLeastOne")}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenOpen(false)}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            disabled={newCombinations.length === 0 || genCreating}
            onClick={handleGenerate}
          >
            {genCreating
              ? t("variants.generateDialog.creating")
              : t(newCombinations.length !== 1 ? "variants.generateDialog.createCount_other" : "variants.generateDialog.createCount_one", { count: newCombinations.length })}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

// ─── Production panel (tab 3) ─────────────────────────────────────────────────

const PROD_STATUS_COLORS: Record<ProductionRequest["status"], "warning" | "info" | "success" | "default"> = {
  pending: "warning",
  in_progress: "info",
  fulfilled: "success",
  cancelled: "default",
};

const PROD_QUICK_AMOUNTS = [1, 5, 10, 50];

interface ProdCartLine {
  variantId: string;
  variantLabel: string;
  quantity: number;
}

function ProductionPanel({
  productId,
  variants,
}: {
  productId: string;
  variants: ProductVariant[];
}) {
  const { t } = useTranslation();
  const [cart, setCart] = useState<ProdCartLine[]>([]);
  const [note, setNote] = useState("");
  const [fulfillOpen, setFulfillOpen] = useState<string | null>(null);
  const confirm = useConfirm();
  const [fulfillQty, setFulfillQty] = useState("");
  const [fulfillNote, setFulfillNote] = useState("");

  const { data, isLoading: reqLoading } = useProductionRequests({ "variant__product": productId });
  const create = useCreateProductionRequest();
  const fulfill = useFulfillProductionRequest();
  const cancel = useCancelProductionRequest();

  const requests = data?.results ?? [];
  const openReqs = requests.filter((r) => r.status === "pending" || r.status === "in_progress");
  const doneReqs = requests.filter((r) => r.status === "fulfilled" || r.status === "cancelled");

  // Sort variants by totalStock ascending (lowest first)
  const sortedVariants = [...variants.filter((v) => v.isActive)]
    .sort((a, b) => a.totalStock - b.totalStock);

  const handleAdd = (line: ProdCartLine) => {
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

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        {/* Left: variant quick-add rows */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              {t("variants.sortedByLowestStock")}
            </Typography>
            <Paper variant="outlined">
              <Stack divider={<Divider />}>
                {sortedVariants.map((v) => {
                  const label = v.isDefault ? t("common.default") : variantLabel(v.attributeValues);
                  const displayLabel = label;
                  const stockColor = v.totalStock === 0 ? "error" : v.isLowStock ? "warning" : "success";
                  const photoUrl = v.galleryPhotoUrl ?? v.photo ?? null;
                  const colorHex = v.attributeValues.find((av) => av.colorHex)?.colorHex ?? null;

                  return (
                    <Stack key={v.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.75, px: 1.5 }}>
                      {photoUrl && (
                        <Box component="img" src={photoUrl} sx={{ width: 24, height: 24, borderRadius: 0.5, objectFit: "cover" }} />
                      )}
                      {!photoUrl && colorHex && (
                        <Box sx={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, bgcolor: colorHex }} />
                      )}
                      <Typography variant="body2" sx={{ flex: 1 }} noWrap>{displayLabel}</Typography>
                      <Chip label={`${v.totalStock}`} size="small" color={stockColor} variant="outlined" sx={{ minWidth: 48 }} />
                      <Stack direction="row" spacing={0.5}>
                        {PROD_QUICK_AMOUNTS.map((n) => (
                          <Button
                            key={n}
                            size="small"
                            variant="outlined"
                            sx={{ minWidth: 32, px: 0.5, fontSize: "0.7rem" }}
                            onClick={() => handleAdd({ variantId: v.id, variantLabel: displayLabel, quantity: n })}
                          >
                            +{n}
                          </Button>
                        ))}
                      </Stack>
                    </Stack>
                  );
                })}
                {sortedVariants.length === 0 && (
                  <Box sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">{t("variants.noActiveVariants")}</Typography>
                  </Box>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Grid>

        {/* Right: cart */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper variant="outlined" sx={{ p: 1.5, position: "sticky", top: 16 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              {t("production.panel.requestsToCreate")}
              {totalRequested > 0 && (
                <Chip label={`${totalRequested}`} size="small" color="primary" sx={{ ml: 1 }} />
              )}
            </Typography>

            {cart.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {t("production.panel.clickToAdd")}
              </Typography>
            ) : (
              <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                {cart.map((line) => (
                  <Stack key={line.variantId} direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                      {line.variantLabel}
                    </Typography>
                    <IconButton size="small" onClick={() => adjustQty(line.variantId, -1)}>
                      <RemoveCircleOutlineIcon sx={{ fontSize: 16, color: "error.light" }} />
                    </IconButton>
                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 20, textAlign: "center" }}>
                      {line.quantity}
                    </Typography>
                    <IconButton size="small" onClick={() => adjustQty(line.variantId, 1)}>
                      <AddCircleOutlineIcon sx={{ fontSize: 16, color: "success.main" }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setCart((p) => p.filter((l) => l.variantId !== line.variantId))}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 1 }} />

            <Stack spacing={1}>
              <TextField
                label={t("common.noteOptional")}
                size="small"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                color="primary"
                size="small"
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

      {/* Existing requests */}
      {reqLoading && <CircularProgress size={20} />}

      {!reqLoading && openReqs.length > 0 && (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">{t("production.panel.openRequests")}</Typography>
          <Paper variant="outlined">
            <Stack divider={<Divider />}>
              {openReqs.map((req) => (
                <Stack key={req.id}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, px: 1.5 }}>
                    <Chip
                      label={req.status.replace("_", " ")}
                      color={PROD_STATUS_COLORS[req.status]}
                      size="small"
                      variant="outlined"
                      sx={{ minWidth: 72 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{req.variantName}</Typography>
                      {req.note && (
                        <Typography variant="caption" color="text.secondary" noWrap>{req.note}</Typography>
                      )}
                      {req.trigger === "auto" && (
                        <Chip
                          label="auto"
                          size="small"
                          icon={<AutoAwesomeIcon sx={{ fontSize: 10 }} />}
                          sx={{ fontSize: "0.6rem", height: 16, ml: 0.5 }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" fontWeight="bold">×{req.quantityRequested}</Typography>
                    <Stack direction="row" spacing={0.5}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        startIcon={<CheckIcon />}
                        onClick={() => {
                          setFulfillOpen(req.id);
                          setFulfillQty(String(req.quantityRequested));
                          setFulfillNote("");
                        }}
                        disabled={fulfill.isPending}
                      >
                        {t("production.fulfill")}
                      </Button>
                      <Tooltip title={t("production.panel.cancelTooltip")}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={async () => {
                              if (!await confirm(t("production.panel.cancelConfirm"), { title: t("production.panel.cancelRequestTitle"), confirmLabel: t("production.panel.cancelRequestLabel") })) return;
                              await cancel.mutateAsync(req.id);
                              toast.success(t("production.panel.cancelled"));
                            }}
                            disabled={cancel.isPending}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                  {fulfillOpen === req.id && (
                    <Box sx={{ px: 1.5, pb: 1.5 }}>
                      <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Stack spacing={1}>
                          <Stack direction="row" spacing={1}>
                            <TextField
                              label={t("production.panel.qtyProduced")}
                              type="number"
                              size="small"
                              value={fulfillQty}
                              onChange={(e) => setFulfillQty(e.target.value)}
                              sx={{ flex: 1 }}
                              helperText={t("production.panel.emptyFulfillOnly")}
                            />
                            <TextField
                              label={t("production.panel.noteLabel")}
                              size="small"
                              value={fulfillNote}
                              onChange={(e) => setFulfillNote(e.target.value)}
                              sx={{ flex: 1 }}
                            />
                          </Stack>
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" onClick={() => setFulfillOpen(null)}>{t("common.cancel")}</Button>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<CheckIcon />}
                              disabled={fulfill.isPending}
                              onClick={async () => {
                                await fulfill.mutateAsync({
                                  id: req.id,
                                  quantity: fulfillQty ? Number(fulfillQty) : undefined,
                                  note: fulfillNote || undefined,
                                });
                                toast.success(t("production.panel.fulfilled"));
                                setFulfillOpen(null);
                              }}
                            >
                              {t("production.panel.confirm")}
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    </Box>
                  )}
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Stack>
      )}

      {!reqLoading && doneReqs.length > 0 && (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">{t("production.panel.history")}</Typography>
          <Paper variant="outlined">
            <Stack divider={<Divider />}>
              {doneReqs.slice(0, 10).map((req) => (
                <Stack key={req.id} direction="row" alignItems="center" spacing={1.5} sx={{ py: 0.75, px: 1.5 }}>
                  <Chip
                    label={req.status.replace("_", " ")}
                    color={PROD_STATUS_COLORS[req.status]}
                    size="small"
                    variant="outlined"
                    sx={{ minWidth: 72 }}
                  />
                  <Typography variant="body2" sx={{ flex: 1 }} noWrap>{req.variantName}</Typography>
                  <Typography variant="body2" fontWeight="bold">×{req.quantityRequested}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </Typography>
                  {req.trigger === "auto" && (
                    <AutoAwesomeIcon sx={{ fontSize: 14, color: "primary.main" }} />
                  )}
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Stack>
      )}

      {!reqLoading && requests.length === 0 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {t("production.panel.noRequests")}
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const TAB_NAMES = ["overview", "variants", "cost", "production"] as const;
  const tabParam = searchParams.get("tab");
  const tab = Math.max(0, TAB_NAMES.indexOf(tabParam as typeof TAB_NAMES[number]));
  const setTab = (v: number) =>
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set("tab", TAB_NAMES[v]); return n; }, { replace: true });
  const [overviewEdit, setOverviewEdit] = useState(false);
  const [overviewForm, setOverviewForm] = useState<ProductUpdate>({});
  const [costEdit, setCostEdit] = useState(false);
  const [photoDragging, setPhotoDragging] = useState(false);
  const [costForm, setCostForm] = useState<ProductCostWrite>({ material: "0", energyKwh: "0", energyRate: "0", laborHours: "0", laborRate: "0", other: "0", notes: "" });

  const { t } = useTranslation();
  const { data: product, isLoading } = useProduct(productId!);
  const { data: tree } = useProductTree(productId!);
  const { data: wSettings } = useWarehouseSettings();
  const { data: categories } = useCategories();
  const createCategory = useCreateCategory();
  const update = useUpdateProduct(productId!);
  const deleteProduct = useDeleteProduct();
  const confirm = useConfirm();
  const [newCategoryName, setNewCategoryName] = useState("");
  const uploadPhoto = useUploadProductPhoto(productId!);
  const deletePhoto = useDeleteProductPhoto(productId!);
  const setPrimary = useSetPrimaryPhoto(productId!);
  const reorderPhotos = useReorderPhotos(productId!);
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (!product) return <Typography>{t("productDetail.notFound")}</Typography>;

  type TreeData = {
    variants: Array<{ variant: ProductVariant; stockByLocation: Record<string, number>; totalStock: number }>;
    locations: Array<{ id: string; name: string }>;
  };
  const treeData = tree ? (tree as TreeData) : null;
  const locationsForVariants = treeData?.locations ?? [];

  const variantsWithStock = sortVariants(product.variants.map((v) => {
    const treeVariant = treeData?.variants.find((tv) => tv.variant.id === v.id);
    return { ...v, stockByLocation: treeVariant?.stockByLocation ?? {} };
  }));

  const handleOverviewSave = async () => {
    await update.mutateAsync(overviewForm);
    setOverviewEdit(false);
    setOverviewForm({});
    toast.success(t("productDetail.productSaved"));
  };

  const handleToggleActive = async () => {
    await update.mutateAsync({ isActive: !product.isActive });
    toast.success(product.isActive ? t("productDetail.productArchived") : t("productDetail.productRestored"));
  };

  const handleDelete = async () => {
    if (!await confirm(t("productDetail.deleteConfirm"), { title: t("productDetail.deleteTitle") })) return;
    try {
      await deleteProduct.mutateAsync(product.id);
      navigate("/catalog");
      toast.success(t("productDetail.productDeleted"));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("common.deleteFailed");
      toast.error(msg);
    }
  };

  const overviewFormCategories = (overviewForm.categories ?? product.categories) as string[];
  const toggleOverviewCategory = (id: string) => setOverviewForm({
    ...overviewForm,
    categories: overviewFormCategories.includes(id)
      ? overviewFormCategories.filter((c) => c !== id)
      : [...overviewFormCategories, id],
  });

  return (
    <Stack spacing={2}>
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <IconButton onClick={() => navigate("/catalog")}><ArrowBackIcon /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <Typography variant="h5" fontWeight="bold">{product.name}</Typography>
          </Stack>
          {product.categoryNames.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5, gap: 0.5 }}>
              {product.categoryNames.map((n) => (
                <Chip key={n} label={n} size="small" variant="outlined" />
              ))}
            </Stack>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title={t("productDetail.deleteTooltip")}>
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={handleDelete}
                disabled={deleteProduct.isPending}
              >
                <DeleteIcon />
              </IconButton>
            </span>
          </Tooltip>
          <FormControlLabel
            control={
              <Switch
                checked={product.isActive}
                onChange={handleToggleActive}
                disabled={update.isPending}
                size="small"
                color="success"
              />
            }
            label={
              <Typography variant="caption" color={product.isActive ? "success.main" : "text.secondary"}>
                {product.isActive ? t("common.active") : t("common.archived")}
              </Typography>
            }
          />
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label={t("productDetail.tabs.overview")} />
        <Tab label={t("productDetail.tabs.variantsStock")} />
        <Tab label={t("productDetail.tabs.cost")} />
        <Tab label={t("productDetail.tabs.production")} />
      </Tabs>

      {/* ── Overview ── */}
      {tab === 0 && (
        <Stack spacing={2}>
          {/* Info */}
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            {overviewEdit ? (
              <>
                <Button size="small" onClick={() => { setOverviewEdit(false); setOverviewForm({}); }}>{t("common.cancel")}</Button>
                <Button size="small" variant="contained" onClick={handleOverviewSave} disabled={update.isPending}>{t("common.save")}</Button>
              </>
            ) : (
              <Button size="small" startIcon={<EditIcon />} variant="outlined" onClick={() => {
                setOverviewEdit(true);
                setOverviewForm({
                  name: product.name,
                  description: product.description,
                  basePrice: product.basePrice,
                  baseWeight: product.baseWeight,
                  hourlyRate: product.hourlyRate,
                  lowStockThreshold: product.lowStockThreshold,
                  categories: product.categories,
                  itemType: product.itemType,
                  servicePricing: product.servicePricing,
                });
              }}>{t("productDetail.edit")}</Button>
            )}
          </Stack>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                {overviewEdit ? (
                  <Stack spacing={1.5}>
                    <TextField size="small" fullWidth label={t("productDetail.editDialog.name")} value={overviewForm.name ?? ""} onChange={(e) => setOverviewForm({ ...overviewForm, name: e.target.value })} />
                    <TextField size="small" fullWidth multiline rows={2} label={t("productDetail.editDialog.description")} value={overviewForm.description ?? ""} onChange={(e) => setOverviewForm({ ...overviewForm, description: e.target.value })} />
                    <MathTextField size="small" fullWidth label={t("productDetail.editDialog.basePrice")} value={overviewForm.basePrice ?? ""} onChange={(v) => setOverviewForm({ ...overviewForm, basePrice: v })} />
                    {overviewForm.itemType === "service" && (
                      <TextField size="small" fullWidth type="number" label="Hourly rate (€/h)" value={overviewForm.hourlyRate ?? ""} onChange={(e) => setOverviewForm({ ...overviewForm, hourlyRate: e.target.value || null })} onKeyDown={blockNonDecimal} slotProps={{ htmlInput: { step: "0.01" } }} />
                    )}
                    {overviewForm.itemType === "service" && (
                      <FormControl size="small" fullWidth>
                        <InputLabel>Pricing mode</InputLabel>
                        <Select label="Pricing mode" value={overviewForm.servicePricing ?? ""} onChange={(e) => setOverviewForm({ ...overviewForm, servicePricing: e.target.value as "flat" | "hourly" | null })}>
                          <MenuItem value="flat">Flat price</MenuItem>
                          <MenuItem value="hourly">Hourly rate</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                    {overviewForm.itemType === "physical" && (
                      <TextField size="small" fullWidth type="number" label={t("productDetail.editDialog.lowStockThreshold")} value={overviewForm.lowStockThreshold ?? ""} onChange={(e) => setOverviewForm({ ...overviewForm, lowStockThreshold: e.target.value !== "" ? Number(e.target.value) : null })} slotProps={{ htmlInput: { min: 0, step: 1 } }} helperText={t("productDetail.editDialog.lowStockHelper")} />
                    )}
                    <MathTextField size="small" fullWidth label={t("productDetail.editDialog.baseWeight")} decimals={3} value={overviewForm.baseWeight ?? ""} onChange={(v) => setOverviewForm({ ...overviewForm, baseWeight: v || null })} placeholder="—" helperText={t("productDetail.editDialog.baseWeightHelper")} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                        {t("productDetail.editDialog.categoriesTags")}
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
                        {categories?.map((c) => (
                          <Chip
                            key={c.id}
                            label={c.name}
                            size="small"
                            onClick={() => toggleOverviewCategory(c.id)}
                            color={overviewFormCategories.includes(c.id) ? "primary" : "default"}
                            variant={overviewFormCategories.includes(c.id) ? "filled" : "outlined"}
                          />
                        ))}
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <TextField
                            size="small"
                            placeholder={t("productDetail.editDialog.newTagPlaceholder")}
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" && newCategoryName.trim()) {
                                const created = await createCategory.mutateAsync({ name: newCategoryName.trim() });
                                setNewCategoryName("");
                                setOverviewForm((f) => ({ ...f, categories: [...overviewFormCategories, created.id] }));
                              }
                            }}
                            sx={{ "& .MuiInputBase-root": { height: 28, fontSize: "0.8rem" }, width: 120 }}
                          />
                          {newCategoryName.trim() && (
                            <Button
                              size="small"
                              onClick={async () => {
                                const created = await createCategory.mutateAsync({ name: newCategoryName.trim() });
                                setNewCategoryName("");
                                setOverviewForm((f) => ({ ...f, categories: [...overviewFormCategories, created.id] }));
                              }}
                              disabled={createCategory.isPending}
                              sx={{ minWidth: 0, px: 1, py: 0.25, height: 28 }}
                            >
                              {t("productDetail.editDialog.add")}
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </Box>
                  </Stack>
                ) : (
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">{t("productDetail.basePrice")}</Typography>
                      <Typography fontWeight="bold">€{product.basePrice}</Typography>
                    </Stack>
                    {product.itemType === "service" && product.hourlyRate && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">{t("productDetail.hourlyRate")}</Typography>
                        <Typography>{t("productDetail.hourlyRateValue", { rate: product.hourlyRate })}</Typography>
                      </Stack>
                    )}
                    {product.description && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">{t("productDetail.description")}</Typography>
                        <Typography variant="body2">{product.description}</Typography>
                      </Box>
                    )}
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">{t("productDetail.baseWeight")}</Typography>
                      <Typography variant="body2" color={product.baseWeight ? "text.primary" : "text.disabled"}>
                        {product.baseWeight ? `${product.baseWeight}g` : "—"}
                      </Typography>
                    </Stack>
                    {product.itemType === "physical" && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">{t("productDetail.lowStockThreshold")}</Typography>
                        <Typography variant="body2" color={product.lowStockThreshold != null ? "text.primary" : "text.disabled"}>
                          {product.lowStockThreshold != null ? product.lowStockThreshold : t("productDetail.lowStockDisabled")}
                        </Typography>
                      </Stack>
                    )}
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t("productDetail.categories")}</Typography>
                      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                        <Chip
                          label={product.itemType === "service" ? t("common.service") : t("common.physical")}
                          size="small"
                          variant="outlined"
                          color={product.itemType === "service" ? "info" : "default"}
                        />
                        {product.categoryNames.map((n) => (
                          <Chip key={n} label={n} size="small" variant="outlined" />
                        ))}
                      </Stack>
                      </Box>
                  </Stack>
                )}
              </Paper>
            </Grid>

            {product.cost && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                  <Typography variant="caption" color="text.secondary">{t("productDetail.costBreakdown")}</Typography>
                  <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                    {parseFloat(product.cost.material) > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption">{t("productDetail.material")}</Typography>
                        <Typography variant="caption">€{product.cost.material}</Typography>
                      </Stack>
                    )}
                    {parseFloat(product.cost.energyKwh) > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption">{t("productDetail.energy")}</Typography>
                        <Typography variant="caption">{product.cost.energyKwh} kWh × €{product.cost.energyRate}</Typography>
                      </Stack>
                    )}
                    {parseFloat(product.cost.laborHours) > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption">{t("productDetail.labor")}</Typography>
                        <Typography variant="caption">{product.cost.laborHours}h × €{product.cost.laborRate}</Typography>
                      </Stack>
                    )}
                    {parseFloat(product.cost.other) > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption">{t("productDetail.other")}</Typography>
                        <Typography variant="caption">€{product.cost.other}</Typography>
                      </Stack>
                    )}
                    <Divider sx={{ my: 0.5 }} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" fontWeight="bold">{t("productDetail.totalCost")}</Typography>
                      <Typography variant="caption" fontWeight="bold">€{product.cost.total}</Typography>
                    </Stack>
                    {parseFloat(product.basePrice) > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {t("productDetail.margin", { value: ((1 - parseFloat(product.cost.total) / parseFloat(product.basePrice)) * 100).toFixed(1) })}
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              </Grid>
            )}
          </Grid>

          {/* Photos */}
          <Paper variant="outlined" sx={{ p: 2, position: "relative", transition: "border-color 0.15s", borderColor: photoDragging ? "primary.main" : undefined, borderStyle: photoDragging ? "dashed" : undefined }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setPhotoDragging(true); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPhotoDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setPhotoDragging(false); Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")).forEach((f) => uploadPhoto.mutate(f)); }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              {t("productDetail.photos")}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" sx={{ gap: 1 }}>
              {product.photos.map((photo) => (
                <Box
                  key={photo.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", photo.id); setDragPhotoId(photo.id); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPhotoId(photo.id); }}
                  onDragLeave={() => setDragOverPhotoId(null)}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    const fromId = e.dataTransfer.getData("text/plain");
                    if (!fromId || fromId === photo.id) { setDragPhotoId(null); setDragOverPhotoId(null); return; }
                    const ids = product.photos.map((p) => p.id);
                    const fromIdx = ids.indexOf(fromId);
                    const toIdx = ids.indexOf(photo.id);
                    ids.splice(fromIdx, 1);
                    ids.splice(toIdx, 0, fromId);
                    reorderPhotos.mutate(ids);
                    setDragPhotoId(null); setDragOverPhotoId(null);
                  }}
                  onDragEnd={() => { setDragPhotoId(null); setDragOverPhotoId(null); }}
                  onClick={() => { if (!photo.isPrimary) setPrimary.mutate(photo.id); }}
                  sx={{ position: "relative", opacity: dragPhotoId === photo.id ? 0.4 : 1, outline: dragOverPhotoId === photo.id && dragPhotoId !== photo.id ? "2px dashed" : "none", outlineColor: "primary.main", borderRadius: 1.5, cursor: photo.isPrimary ? "grab" : "pointer", transition: "opacity 0.15s" }}
                >
                  <Box component="img" src={photo.image} alt=""
                    sx={{ width: 90, height: 90,
                      borderRadius: 1.5, objectFit: "cover", display: "block",
                      border: "1px solid", borderColor: photo.isPrimary ? "#f59e0b" : "divider",
                      cursor: "inherit", userSelect: "none" }}
                  />
                  {photo.isPrimary && (
                    <Box sx={{ position: "absolute", inset: 0, borderRadius: 1.5, border: "5px solid #f59e0b", pointerEvents: "none" }} />
                  )}
                  {photo.isPrimary && <StarIcon sx={{ position: "absolute", top: 4, left: 4, fontSize: 14, color: "#fff", pointerEvents: "none" }} />}
                  <IconButton size="small"
                    sx={{ position: "absolute", top: 4, right: 4, bgcolor: "rgba(0,0,0,0.55)", color: "white", p: 0.5 }}
                    onClick={() => deletePhoto.mutate(photo.id)}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  {!photo.isPrimary && (
                    <Tooltip title={t("productDetail.setAsPrimary")} placement="bottom">
                      <StarIcon sx={{ position: "absolute", bottom: 4, right: 4, fontSize: 14, color: "rgba(255,255,255,0.7)", pointerEvents: "none" }} />
                    </Tooltip>
                  )}
                </Box>
              ))}
              <PhotoDropZone onFiles={(files) => files.forEach((f) => uploadPhoto.mutate(f))} pending={uploadPhoto.isPending} />
            </Stack>
            {photoDragging && (
              <Box sx={{ position: "absolute", inset: 0, borderRadius: "inherit", bgcolor: "primary.main", opacity: 0.06, pointerEvents: "none" }} />
            )}
          </Paper>

          {/* Variants stock summary (overview tab) — active only */}
          {product.itemType === "physical" && variantsWithStock.filter((v) => v.isActive).length > 0 && (
            <Paper variant="outlined">
              <Typography variant="subtitle2" fontWeight="bold" sx={{ p: 2, pb: 1 }}>{t("productDetail.stock")}</Typography>
              <Divider />
              <Stack divider={<Divider />}>
                {variantsWithStock.filter((v) => v.isActive).map((v) => (
                  <VariantRow
                    key={v.id}
                    variant={v}
                    locations={locationsForVariants}
                    photos={product.photos}
                    productName={product.name}
                    isOnlyVariant={variantsWithStock.filter((x) => x.isActive).length === 1}
                    attributes={product.attributes}
                    productLowStockThreshold={product.lowStockThreshold}
                    basePrice={product.basePrice}
                    baseCost={product.cost?.total ?? "0.00"}
                  />
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      )}

      {/* ── Variants & Stock tab ── */}
      {tab === 1 && (
        <VariantManager
          productId={product.id}
          attributes={product.attributes}
          variants={variantsWithStock}
          locations={locationsForVariants}
          photos={product.photos}
          productName={product.name}
          productLowStockThreshold={product.lowStockThreshold}
          basePrice={product.basePrice}
          baseCost={product.cost?.total ?? "0.00"}
        />
      )}

      {/* ── Cost tab ── */}
      {tab === 2 && (
        <Stack spacing={2}>
          {/* Base production cost */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">{t("productDetail.baseProductionCost")}</Typography>
              {costEdit ? (
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setCostEdit(false)}>{t("common.cancel")}</Button>
                  <Button size="small" variant="contained" disabled={update.isPending} onClick={async () => {
                    await update.mutateAsync({ cost: costForm });
                    setCostEdit(false);
                    toast.success(t("productDetail.productSaved"));
                  }}>{t("common.save")}</Button>
                </Stack>
              ) : (
                <Button size="small" startIcon={<EditIcon />} variant="outlined" onClick={() => {
                  setCostForm({
                    material: product.cost?.material ?? "0",
                    energyKwh: product.cost?.energyKwh ?? "0",
                    energyRate: product.cost?.energyRate ?? "0",
                    laborHours: product.cost?.laborHours ?? "0",
                    laborRate: product.cost?.laborRate ?? "0",
                    other: product.cost?.other ?? "0",
                    notes: product.cost?.notes ?? "",
                  });
                  setCostEdit(true);
                }}>{t("productDetail.edit")}</Button>
              )}
            </Stack>
            {costEdit ? (
              <CostFields cost={costForm} onChange={setCostForm} defaultOpen defaultEnergyRate={wSettings?.defaultEnergyRate} />
            ) : !product.cost ? (
              <Typography color="text.secondary" variant="body2">{t("productDetail.noCostData")}</Typography>
            ) : (
              <Stack spacing={1}>
                <Grid container spacing={2}>
                  {[[t("productDetail.material"), `€${product.cost.material}`], [t("productDetail.other"), `€${product.cost.other}`]].map(([l, v]) => (
                    <Grid key={l} size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">{l}</Typography>
                      <Typography>{v}</Typography>
                    </Grid>
                  ))}
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">{t("productDetail.energy")}</Typography>
                    <Typography>{t("productDetail.energyValue", { kwh: product.cost.energyKwh, rate: product.cost.energyRate })}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">{t("productDetail.labor")}</Typography>
                    <Typography>{t("productDetail.laborValue", { hours: product.cost.laborHours, rate: product.cost.laborRate })}</Typography>
                  </Grid>
                </Grid>
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography fontWeight="bold">{t("productDetail.baseCost")}</Typography>
                  <Typography fontWeight="bold">€{product.cost.total}</Typography>
                </Stack>
                {parseFloat(product.basePrice) > 0 && parseFloat(product.cost.total) > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {t("productDetail.baseMargin", { value: ((1 - parseFloat(product.cost.total) / parseFloat(product.basePrice)) * 100).toFixed(1) })}
                  </Typography>
                )}
                {product.cost.notes && (
                  <Typography variant="body2" color="text.secondary">{product.cost.notes}</Typography>
                )}
              </Stack>
            )}
          </Paper>

          {/* Per-variant cost breakdown (only when there are real variants or cost deltas) */}
          {product.variants.length > 0 && (product.variants.length > 1 || !product.variants[0]?.isDefault || parseFloat(product.variants[0]?.costDelta ?? "0") !== 0) && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>{t("productDetail.perVariantCost")}</Typography>
              <Stack divider={<Divider />}>
                {product.variants.filter((v) => v.isActive).map((v) => {
                  const isOnlyVariant = product.variants.length === 1;
                  const label = isOnlyVariant
                    ? product.name
                    : (variantLabel(v.attributeValues) || t("common.default"));
                  const priceDelta = parseFloat(v.priceDelta);
                  const costDelta = parseFloat(v.costDelta);
                  const effectivePrice = parseFloat(v.effectivePrice);
                  const effectiveCost = parseFloat(v.effectiveCost);
                  const margin = effectivePrice > 0
                    ? ((1 - effectiveCost / effectivePrice) * 100).toFixed(1)
                    : "—";

                  return (
                    <Stack key={v.id} direction="row" alignItems="center" spacing={2} sx={{ py: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight="medium" noWrap>{label}</Typography>
                        {v.sku && <Typography variant="caption" color="text.secondary">{t("variants.sku", { sku: v.sku })}</Typography>}
                      </Box>
                      <Stack alignItems="flex-end" sx={{ minWidth: 80 }}>
                        <Typography variant="caption" color="text.secondary">{t("productDetail.variantCost")}</Typography>
                        <Typography variant="body2">€{effectiveCost.toFixed(2)}</Typography>
                        {costDelta !== 0 && (
                          <Typography variant="caption" color={costDelta > 0 ? "warning.main" : "success.main"}>
                            {costDelta > 0 ? "+" : ""}€{costDelta.toFixed(2)}
                          </Typography>
                        )}
                      </Stack>
                      <Stack alignItems="flex-end" sx={{ minWidth: 80 }}>
                        <Typography variant="caption" color="text.secondary">{t("productDetail.variantPrice")}</Typography>
                        <Typography variant="body2">€{effectivePrice.toFixed(2)}</Typography>
                        {priceDelta !== 0 && (
                          <Typography variant="caption" color={priceDelta > 0 ? "warning.main" : "success.main"}>
                            {priceDelta > 0 ? "+" : ""}€{priceDelta.toFixed(2)}
                          </Typography>
                        )}
                      </Stack>
                      <Stack alignItems="flex-end" sx={{ minWidth: 56 }}>
                        <Typography variant="caption" color="text.secondary">{t("productDetail.variantMargin")}</Typography>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          color={parseFloat(margin) > 30 ? "success.main" : parseFloat(margin) > 0 ? "warning.main" : "error.main"}
                        >
                          {margin}%
                        </Typography>
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>
            </Paper>
          )}
        </Stack>
      )}

      {/* ── Production tab ── */}
      {tab === 3 && (
        <ProductionPanel productId={product.id} variants={product.variants} />
      )}

    </Stack>
  );
}
