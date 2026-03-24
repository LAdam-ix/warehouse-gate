import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import Layout from "./components/Layout";
import { ConfirmProvider } from "./components/ConfirmDialog";
import DashboardPage from "./features/dashboard/DashboardPage";
import CatalogPage from "./features/catalog/CatalogPage";
import ProductDetailPage from "./features/catalog/ProductDetailPage";
import StockPage from "./features/stock/StockPage";
import AddStockPage from "./features/stock/AddStockPage";
import SalesPage from "./features/sales/SalesPage";
import SaleDetailPage from "./features/sales/SaleDetailPage";
import WriteOffPage from "./features/writeoffs/WriteOffPage";
import WriteOffNewPage from "./features/writeoffs/WriteOffNewPage";
import ProductionPage from "./features/production/ProductionPage";
import SettingsPage from "./features/settings/SettingsPage";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1976d2" },
    secondary: { main: "#dc004e" },
  },
  shape: { borderRadius: 8 },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ConfirmProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="catalog/:productId" element={<ProductDetailPage />} />
            <Route path="stock" element={<StockPage />} />
            <Route path="stock/add" element={<AddStockPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="sales/:saleId" element={<SaleDetailPage />} />
            <Route path="writeoffs" element={<WriteOffPage />} />
            <Route path="writeoffs/new" element={<WriteOffNewPage />} />
            <Route path="damage" element={<Navigate to="/writeoffs" replace />} />
            <Route path="production" element={<ProductionPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ConfirmProvider>
    </ThemeProvider>
  );
}
