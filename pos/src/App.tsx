import { useState, useEffect } from "react";
import { getConfig, type PosConfig } from "./lib/db";
import { setApiToken } from "./lib/api";
import SetupScreen from "./components/SetupScreen";
import PosScreen from "./components/PosScreen";
import { Box, CircularProgress } from "@mui/material";

export default function App() {
  const [config, setConfig] = useState<PosConfig | null | "loading">("loading");

  useEffect(() => {
    getConfig().then((c) => {
      if (c?.apiToken) setApiToken(c.apiToken);
      setConfig(c);
    });
  }, []);

  if (config === "loading") {
    return (
      <Box sx={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!config) {
    return <SetupScreen onComplete={(c) => { if (c.apiToken) setApiToken(c.apiToken); setConfig(c); }} />;
  }

  return <PosScreen config={config} onReset={() => setConfig(null)} />;
}
