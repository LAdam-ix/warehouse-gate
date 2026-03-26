import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import InventoryIcon from "@mui/icons-material/Inventory2";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import BrokenImageIcon from "@mui/icons-material/BrokenImage";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import SettingsIcon from "@mui/icons-material/Settings";
import { useTranslation } from "react-i18next";
import { navLinkProps } from "../utils/navLink";

const DRAWER_WIDTH = 220;

export default function Layout() {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Scroll to top on sidebar navigation (fresh nav), but not on back/forward.
  // We track whether navigation came from the sidebar by storing the pathname
  // that was clicked — if it differs from the current, it was a fresh nav.
  const prevPathname = useRef(location.pathname);
  const sidebarNav = useRef(false);
  useEffect(() => {
    if (sidebarNav.current) {
      window.scrollTo({ top: 0 });
      sidebarNav.current = false;
    }
    prevPathname.current = location.pathname;
  }, [location.pathname]);

  const NAV_ITEMS = [
    { label: t("nav.dashboard"), path: "/dashboard", icon: <DashboardIcon /> },
    { label: t("nav.catalog"), path: "/catalog", icon: <InventoryIcon /> },
    { label: t("nav.stockLog"), path: "/stock", icon: <WarehouseIcon /> },
    { label: t("nav.sales"), path: "/sales", icon: <ShoppingCartIcon /> },
    { label: t("nav.writeOffs"), path: "/writeoffs", icon: <BrokenImageIcon /> },
    { label: t("nav.production"), path: "/production", icon: <PrecisionManufacturingIcon /> },
    { label: t("nav.settings"), path: "/settings", icon: <SettingsIcon /> },
  ];

  const drawer = (
    <Box>
      <Toolbar>
        <WarehouseIcon sx={{ mr: 1 }} />
        <Typography variant="subtitle1" fontWeight="bold">
          {t("nav.warehouse")}
        </Typography>
      </Toolbar>
      <List dense>
        {NAV_ITEMS.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              {...navLinkProps(item.path, navigate, () => { sidebarNav.current = true; setMobileOpen(false); })}
              selected={location.pathname.startsWith(item.path)}
              sx={{ borderRadius: 1, mx: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        elevation={1}
      >
        <Toolbar variant="dense">
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 1, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap>
            {t("nav.warehouse")}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", sm: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
        }}
      >
        {drawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: "48px",
          minHeight: "100vh",
          bgcolor: "grey.50",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
