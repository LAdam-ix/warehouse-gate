import { useState, useEffect } from "react";
import { Box, Button, Collapse, Grid, TextField, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import type { ProductCostWrite } from "../types/api";
import { useTranslation } from "react-i18next";

interface Props {
  cost: ProductCostWrite | null | undefined;
  onChange: (cost: ProductCostWrite) => void;
  defaultOpen?: boolean;
  defaultEnergyRate?: string | null;
}

const EMPTY: ProductCostWrite = {
  material: "", energyKwh: "", energyRate: "",
  laborHours: "", laborRate: "", other: "", notes: "",
};

export default function CostFields({ cost, onChange, defaultOpen = false, defaultEnergyRate }: Props) {
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
        {open ? t("costFields.hideCosts") : t("costFields.setCosts")}
      </Button>
      <Collapse in={open}>
        <Box sx={{ mt: 1, pl: 1.5, borderLeft: "2px solid", borderColor: "divider" }}>
          <Grid container spacing={1}>
            <Grid size={{ xs: 6 }}>
              <TextField label={t("costFields.material")} type="number" fullWidth size="small"
                value={get("material")} onChange={(e) => set("material", e.target.value)}
                inputProps={{ step: "0.01", min: 0 }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField label={t("costFields.other")} type="number" fullWidth size="small"
                value={get("other")} onChange={(e) => set("other", e.target.value)}
                inputProps={{ step: "0.01", min: 0 }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField label={t("costFields.energyKwh")} type="number" fullWidth size="small"
                value={get("energyKwh")} onChange={(e) => set("energyKwh", e.target.value)}
                inputProps={{ step: "0.001", min: 0 }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField label={t("costFields.energyRate")} type="number" fullWidth size="small"
                value={get("energyRate")} onChange={(e) => set("energyRate", e.target.value)}
                inputProps={{ step: "0.0001", min: 0 }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField label={t("costFields.laborHours")} type="number" fullWidth size="small"
                value={get("laborHours")} onChange={(e) => set("laborHours", e.target.value)}
                inputProps={{ step: "0.25", min: 0 }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField label={t("costFields.laborRate")} type="number" fullWidth size="small"
                value={get("laborRate")} onChange={(e) => set("laborRate", e.target.value)}
                inputProps={{ step: "0.01", min: 0 }} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label={t("costFields.costNotes")} fullWidth multiline rows={1} size="small"
                value={get("notes")} onChange={(e) => set("notes", e.target.value)} />
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
            {t("costFields.totalFormula")}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
}
