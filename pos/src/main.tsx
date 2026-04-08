import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import App from "./App";

// Polyfill crypto.randomUUID for non-secure contexts (HTTP on LAN)
if (typeof crypto.randomUUID !== "function") {
  crypto.randomUUID = () =>
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
    ) as `${string}-${string}-${string}-${string}-${string}`;
}

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2e7d32" },   // green — POS accent
    secondary: { main: "#1976d2" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: "'Inter', 'Roboto', sans-serif",
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
