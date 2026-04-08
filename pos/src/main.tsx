import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import App from "./App";

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
