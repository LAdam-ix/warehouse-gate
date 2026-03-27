import { useState, useEffect } from "react";
import { Box, Button, Collapse, Grid, TextField, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import type { ProductCostWrite } from "../types/api";
import MathTextField from "./MathTextField";
import { useTranslation } from "react-i18next";

interface Props {
  cost: ProductCostWrite | null | undefined;
  onChange: (cost: ProductCostWrite) => void;
  defaultOpen?: boolean;
  defaultEnergyRate?: string | null;
  weight?: string | null;
  onWeightChange?: (weight: string | null) => void;
}

const EMPTY: ProductCostWrite = {
  material: "", energyKwh: "", energyRate: "",
  laborHours: "", laborRate: "", other: "", notes: "",
};

export default function CostFields({ cost, onChange, defaultOpen = false, defaultEnergyRate, weight, onWeightChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  const get = (key: keyof ProductCostWrite) =>
    (cost as Record<string, string> | undefined)?.[key] ?? "";

  const set = (key: keyof ProductCostWrite, value: string) =>
    onChange({ ...(cost ?? EMPTY), [key]: value });

  // Pre-fill energy rate from settings if not already set
  useEffect(() => {
    if (defaultEnergyRate && !get("energyRate")) {
      set("energyRate", defaultEnergyRate);
    }
  }, [defaultEnergyRate]);

  return (
    <Box>
      <Button
        size="small"
        endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => setOpen((v) => !v)}
        sx={{ textTransform: "none", color: "text.secondary", pl: 0 }}
      >
        {open ? t("costFields.hide") : t("costFields.show")}
      </Button>
      <Collapse in={open}>
        <Box sx={{ mt: 1, pl: 1.5, borderLeft: "2px solid", borderColor: "divider" }}>
          <Grid container spacing={1}>
            <Grid size={{ xs: 6 }}>
              <MathTextField label={t("costFields.material")} fullWidth size="small"
                value={get("material")} onChange={(v) => set("material", v)} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <MathTextField label={t("costFields.other")} fullWidth size="small"
                value={get("other")} onChange={(v) => set("other", v)} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <MathTextField label={t("costFields.energyKwh")} fullWidth size="small" decimals={3}
                value={get("energyKwh")} onChange={(v) => set("energyKwh", v)} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <MathTextField label={t("costFields.energyRate")} fullWidth size="small" decimals={4}
                value={get("energyRate")} onChange={(v) => set("energyRate", v)} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <MathTextField label={t("costFields.laborHours")} fullWidth size="small"
                value={get("laborHours")} onChange={(v) => set("laborHours", v)} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <MathTextField label={t("costFields.laborRate")} fullWidth size="small"
                value={get("laborRate")} onChange={(v) => set("laborRate", v)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label={t("costFields.costNotes")} fullWidth multiline rows={1} size="small"
                value={get("notes")} onChange={(e) => set("notes", e.target.value)} />
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
            {t("costFields.totalFormula")}
          </Typography>
          {onWeightChange && (
            <>
              <Typography variant="caption" color="text.secondary" fontWeight="medium" sx={{ mt: 1.5, mb: 0.5, display: "block" }}>
                {t("costFields.weightSection")}
              </Typography>
              <MathTextField
                label={t("costFields.baseWeight")}
                fullWidth size="small" decimals={3}
                value={weight ?? ""}
                onChange={(v) => onWeightChange(v || null)}
                placeholder="—"
              />
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
