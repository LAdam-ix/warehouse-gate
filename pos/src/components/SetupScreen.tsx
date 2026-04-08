import { useState, useEffect } from "react";
import {
  Box, Button, CircularProgress, FormControl, InputLabel,
  MenuItem, Select, Stack, Typography,
} from "@mui/material";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import { fetchLocations, type ApiLocation } from "../lib/api";
import { setConfig, type PosConfig } from "../lib/db";
import { syncProducts } from "../lib/sync";

export default function SetupScreen({ onComplete }: { onComplete: (c: PosConfig) => void }) {
  const [locations, setLocations] = useState<ApiLocation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLocations()
      .then((locs) => {
        setLocations(locs);
        const def = locs.find((l) => l.isDefault) ?? locs[0];
        if (def) setSelectedId(def.id);
        setLoading(false);
      })
      .catch(() => {
        setError("Cannot connect to backend. Make sure the server is running.");
        setLoading(false);
      });
  }, []);

  const handleSetup = async () => {
    const loc = locations.find((l) => l.id === selectedId);
    if (!loc) return;

    setSyncing(true);
    const config: PosConfig = {
      locationId: loc.id,
      locationName: loc.name,
      lastProductSync: null,
      lastSaleSync: null,
    };
    await setConfig(config);

    try {
      await syncProducts();
      config.lastProductSync = new Date().toISOString();
      await setConfig(config);
    } catch {
      // Products will sync later — allow offline start with empty catalog
    }

    setSyncing(false);
    onComplete(config);
  };

  return (
    <Box sx={{
      display: "flex", height: "100vh", alignItems: "center", justifyContent: "center",
      bgcolor: "grey.50", p: 3,
    }}>
      <Stack spacing={3} alignItems="center" sx={{ maxWidth: 360, width: "100%" }}>
        <WarehouseIcon sx={{ fontSize: 48, color: "primary.main" }} />
        <Typography variant="h5" fontWeight="bold">POS Terminal Setup</Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Select the location this terminal serves. Products will be filtered to show stock at this location.
        </Typography>

        {loading ? (
          <CircularProgress />
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <>
            <FormControl fullWidth>
              <InputLabel>Location</InputLabel>
              <Select label="Location" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {locations.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name}{l.isDefault ? " (default)" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleSetup}
              disabled={!selectedId || syncing}
              startIcon={syncing ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {syncing ? "Syncing products..." : "Start POS"}
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
}
