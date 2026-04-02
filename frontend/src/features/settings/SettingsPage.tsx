import { useState, useEffect } from "react";
import { blockNonDecimal } from "../../utils/form";
import { COLOR_PRESETS } from "../../utils/colorPresets";
import {
  Box, Button, CircularProgress, Divider, FormControl, FormControlLabel, IconButton,
  InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { toast } from "react-toastify";
import {
  useFirm, useWarehouseSettings, useUpdateWarehouseSettings,
  useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation, useMoveLocation,
} from "../../api/hooks";
import { useConfirm } from "../../components/ConfirmDialog";
import { useTranslation } from "react-i18next";

function LocationRow({ loc, isFirst, isLast, onRefresh }: {
  loc: { id: string; name: string; isDefault: boolean; isActive: boolean };
  isFirst: boolean;
  isLast: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(loc.name);
  const update = useUpdateLocation(loc.id);
  const del = useDeleteLocation();
  const move = useMoveLocation();
  const confirm = useConfirm();

  const save = async () => {
    await update.mutateAsync({ name: editName.trim() });
    setEditing(false);
    toast.success(t("settings.locations.locationRenamed"));
  };

  const setDefault = async () => {
    await update.mutateAsync({ isDefault: true });
    toast.success(t("settings.locations.defaultUpdated"));
  };

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      {editing ? (
        <>
          <TextField size="small" value={editName} onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()} autoFocus sx={{ flex: 1 }} />
          <Button size="small" onClick={save} disabled={update.isPending}>{t("common.save")}</Button>
          <Button size="small" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
        </>
      ) : (
        <>
          {/* Up / Down arrows */}
          <Stack spacing={-0.5}>
            <IconButton size="small" disabled={isFirst || move.isPending}
              onClick={() => move.mutate({ id: loc.id, direction: "up" })}>
              <KeyboardArrowUpIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton size="small" disabled={isLast || move.isPending}
              onClick={() => move.mutate({ id: loc.id, direction: "down" })}>
              <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {loc.name}
            {loc.isDefault && <Typography component="span" variant="caption" color="primary" sx={{ ml: 0.75 }}>{t("settings.locations.defaultLabel")}</Typography>}
          </Typography>
          {!loc.isDefault && (
            <Tooltip title={t("settings.locations.setAsDefault")}>
              <IconButton size="small" onClick={setDefault}><StarBorderIcon sx={{ fontSize: 16 }} /></IconButton>
            </Tooltip>
          )}
          {loc.isDefault && <StarIcon sx={{ fontSize: 16, color: "warning.main" }} />}
          <Tooltip title={t("settings.locations.rename")}>
            <IconButton size="small" onClick={() => { setEditing(true); setEditName(loc.name); }}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={loc.isDefault ? t("settings.locations.cantDeleteDefault") : t("settings.locations.delete")}>
            <span>
              <IconButton size="small" color="error" disabled={loc.isDefault || del.isPending}
                onClick={async () => {
                  if (!await confirm(t("settings.locations.deleteConfirm", { name: loc.name }), { title: t("settings.locations.deleteTitle"), confirmLabel: t("common.delete") })) return;
                  await del.mutateAsync(loc.id);
                  toast.success(t("settings.locations.locationDeleted"));
                  onRefresh();
                }}>
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}
    </Stack>
  );
}

function EnergyRateField({ value, onSave, disabled }: { value: string | null; onSave: (v: string | null) => void; disabled: boolean }) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);

  const save = () => {
    const trimmed = local.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next !== value) onSave(next);
  };

  return (
    <Box>
      <Typography variant="body2" fontWeight="medium" gutterBottom>{t("settings.costDefaults")}</Typography>
      <TextField
        label={t("settings.defaultEnergyRate")}
        type="number"
        size="small"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { blockNonDecimal(e as React.KeyboardEvent<HTMLInputElement>); if (e.key === "Enter") save(); }}
        disabled={disabled}
        slotProps={{ htmlInput: { step: "0.0001", min: 0 } }}
        helperText={t("settings.defaultEnergyRateHelper")}
        sx={{ maxWidth: 220 }}
      />
    </Box>
  );
}

// ─── Color Manager ────────────────────────────────────────────────────────────

function ColorManager({
  colors,
  hiddenPresets,
  onSave,
  disabled,
}: {
  colors: { name: string; hex: string; favorite: boolean }[];
  hiddenPresets: string[];
  onSave: (colors: { name: string; hex: string; favorite: boolean }[], hidden: string[]) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [localColors, setLocalColors] = useState(colors);
  const [localHidden, setLocalHidden] = useState(hiddenPresets);
  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#42a5f5");
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => { setLocalColors(colors); }, [colors]);
  useEffect(() => { setLocalHidden(hiddenPresets); }, [hiddenPresets]);

  const isDirty = JSON.stringify(localColors) !== JSON.stringify(colors) || JSON.stringify(localHidden) !== JSON.stringify(hiddenPresets);

  const addColor = () => {
    if (!newName.trim() || !newHex) return;
    const updated = [...localColors, { name: newName.trim(), hex: newHex, favorite: true }];
    setLocalColors(updated);
    setNewName("");
    setNewHex("#42a5f5");
  };

  const toggleFavorite = (idx: number) => {
    const updated = [...localColors];
    updated[idx] = { ...updated[idx], favorite: !updated[idx].favorite };
    setLocalColors(updated);
  };

  const removeColor = (idx: number) => {
    setLocalColors((prev) => prev.filter((_, i) => i !== idx));
  };

  const togglePresetHidden = (hex: string) => {
    setLocalHidden((prev) => prev.includes(hex) ? prev.filter((h) => h !== hex) : [...prev, hex]);
  };

  const save = () => { onSave(localColors, localHidden); toast.success(t("settings.colorsSaved")); };

  return (
    <Box>
      <Typography variant="body2" fontWeight="medium" gutterBottom>{t("settings.colorLibrary")}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        {t("settings.colorLibraryDescription")}
      </Typography>

      {/* Custom colors */}
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        {localColors.map((c, i) => (
          <Stack key={i} direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 20, height: 20, borderRadius: "50%", bgcolor: c.hex, border: "1px solid", borderColor: "divider", flexShrink: 0 }} />
            <Typography variant="body2" sx={{ flex: 1 }}>{c.name}</Typography>
            <Typography variant="caption" color="text.secondary">{c.hex}</Typography>
            <IconButton size="small" onClick={() => toggleFavorite(i)}>
              {c.favorite ? <StarIcon sx={{ fontSize: 16, color: "#f59e0b" }} /> : <StarBorderIcon sx={{ fontSize: 16 }} />}
            </IconButton>
            <IconButton size="small" onClick={() => removeColor(i)}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      {/* Add new color */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <Box sx={{ position: "relative", flexShrink: 0 }}>
          <Box
            component="input" type="color" value={newHex}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewHex(e.target.value)}
            sx={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer", border: "none", p: 0 }}
          />
          <Box sx={{ width: 28, height: 28, borderRadius: "50%", bgcolor: newHex, border: "1px solid", borderColor: "divider", cursor: "pointer" }} />
        </Box>
        <TextField size="small" placeholder={t("settings.colorNamePlaceholder")} value={newName} onChange={(e) => setNewName(e.target.value)} sx={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") addColor(); }} />
        <Button size="small" variant="outlined" onClick={addColor} disabled={!newName.trim()}>
          <AddIcon sx={{ fontSize: 16 }} />
        </Button>
      </Stack>

      {/* Default presets — toggle visibility */}
      <Button size="small" sx={{ textTransform: "none", fontSize: "0.75rem", p: 0, mb: 0.5 }} onClick={() => setShowPresets((v) => !v)}>
        {showPresets ? t("settings.hidePresets") : t("settings.managePresets")}
      </Button>
      {showPresets && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
          {COLOR_PRESETS.map((c) => {
            const hidden = localHidden.includes(c.hex);
            return (
              <Tooltip key={c.hex} title={`${c.name}${hidden ? " (hidden)" : ""}`} placement="top">
                <Box
                  onClick={() => togglePresetHidden(c.hex)}
                  sx={{
                    width: 22, height: 22, borderRadius: "50%",
                    bgcolor: c.hex, border: "2px solid",
                    borderColor: hidden ? "error.main" : "divider",
                    opacity: hidden ? 0.3 : 1,
                    cursor: "pointer",
                    "&:hover": { opacity: 1 },
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>
      )}

      {isDirty && (
        <Button size="small" variant="contained" onClick={save} disabled={disabled}>
          {t("settings.saveColors")}
        </Button>
      )}
    </Box>
  );
}

function LocationsSettings() {
  const { t } = useTranslation();
  const { data: locations, refetch } = useLocations();
  const createLocation = useCreateLocation();
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createLocation.mutateAsync({ name: newName.trim(), description: "", isDefault: !locations?.length, isActive: true });
    setNewName("");
    toast.success(t("settings.locations.locationCreated"));
  };

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>{t("settings.locations.title")}</Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          {locations?.map((loc, i) => (
            <LocationRow key={loc.id} loc={loc} isFirst={i === 0} isLast={i === (locations.length - 1)} onRefresh={() => refetch()} />
          ))}

          <Divider />

          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              placeholder={t("settings.locations.newLocationPlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              sx={{ flex: 1 }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleCreate}
              disabled={!newName.trim() || createLocation.isPending}
            >
              {t("settings.locations.add")}
            </Button>
          </Stack>

          {(!locations || locations.length === 0) && (
            <Typography variant="caption" color="text.secondary">
              {t("settings.locations.noLocations")}
            </Typography>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

/**
 * Exportable component for embedding into fakturuj si's settings page.
 * Usage: <WarehouseSettings />
 */
export function WarehouseSettings() {
  const { t } = useTranslation();
  const { data: firm, isLoading } = useFirm();
  const { data: wSettings } = useWarehouseSettings();
  const updateWSettings = useUpdateWarehouseSettings();
  const [mode, setMode] = useState<string>("");

  // Sync local state when settings data loads
  useEffect(() => {
    if (wSettings) setMode(wSettings.warehouseMode);
  }, [wSettings]);

  const isDirty = wSettings && mode !== wSettings.warehouseMode;

  const handleSave = async () => {
    await updateWSettings.mutateAsync({ warehouseMode: mode as "strict" | "soft" | "disabled" });
    toast.success(t("settings.settingsSaved"));
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>{t("settings.warehouse")}</Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          {isLoading ? (
            <Box sx={{ py: 2, textAlign: "center" }}><CircularProgress size={24} /></Box>
          ) : (
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" fontWeight="medium">{t("settings.firm")}</Typography>
                  <Typography variant="caption" color="text.secondary">{firm?.name}</Typography>
                </Box>
              </Stack>
              <Divider />
              <Box>
                <Typography variant="body2" fontWeight="medium" gutterBottom>{t("settings.warehouseMode")}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                  {t("settings.warehouseModeDescription")}
                </Typography>
                <FormControl size="small" fullWidth>
                  <InputLabel>{t("settings.mode")}</InputLabel>
                  <Select label={t("settings.mode")} value={mode} onChange={(e) => setMode(e.target.value)}>
                    {(["strict", "soft", "disabled"] as const).map((value) => (
                      <MenuItem key={value} value={value}>
                        <Box>
                          <Typography variant="body2">{t(`settings.modes.${value}.label`)}</Typography>
                          <Typography variant="caption" color="text.secondary">{t(`settings.modes.${value}.description`)}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Divider />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" fontWeight="medium">{t("settings.currency")}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("settings.currencyDescription")}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">{t("settings.currencyValue")}</Typography>
              </Stack>
              <Divider />
              <Box>
                <Typography variant="body2" fontWeight="medium" gutterBottom>{t("settings.catalogDisplay")}</Typography>
                <Stack spacing={1.5}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={wSettings?.showSku ?? false}
                        onChange={(_, checked) => updateWSettings.mutate({ showSku: checked })}
                        disabled={updateWSettings.isPending}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">{t("settings.showSkuCodes")}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t("settings.showSkuDescription")}
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={wSettings?.skipConfirm ?? false}
                        onChange={(_, checked) => updateWSettings.mutate({ skipConfirm: checked })}
                        disabled={updateWSettings.isPending}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">{t("settings.skipConfirmDialogs")}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t("settings.skipConfirmDescription")}
                        </Typography>
                      </Box>
                    }
                  />
                </Stack>
              </Box>
              <Divider />
              <EnergyRateField
                value={wSettings?.defaultEnergyRate ?? null}
                onSave={(val) => updateWSettings.mutate({ defaultEnergyRate: val })}
                disabled={updateWSettings.isPending}
              />
              <Divider />
              <ColorManager
                colors={wSettings?.favoriteColors ?? []}
                hiddenPresets={wSettings?.hiddenPresetColors ?? []}
                onSave={(colors, hidden) => updateWSettings.mutate({ favoriteColors: colors, hiddenPresetColors: hidden })}
                disabled={updateWSettings.isPending}
              />
              {isDirty && (
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={updateWSettings.isPending}
                  sx={{ alignSelf: "flex-end" }}
                >
                  {t("settings.saveChanges")}
                </Button>
              )}
            </Stack>
          )}
        </Paper>
      </Box>

      <LocationsSettings />

      <Box>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>{t("settings.quickAddStock")}</Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={1}>
            {[1, 5, 10, 50].map((n) => (
              <Box
                key={n}
                sx={{
                  px: 1.5, py: 0.5, border: "1px solid", borderColor: "divider",
                  borderRadius: 1, typography: "body2",
                }}
              >
                +{n}
              </Box>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            {t("settings.quickAddFuture")}
          </Typography>
        </Paper>
      </Box>
    </Stack>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight="bold">{t("settings.title")}</Typography>
      <WarehouseSettings />
    </Stack>
  );
}
