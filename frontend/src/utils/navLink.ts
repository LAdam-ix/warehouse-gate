import type { NavigateFunction } from "react-router-dom";

/**
 * Returns MUI component props that make any clickable element behave like a
 * proper anchor: left-click uses React Router (no reload), middle-click /
 * Ctrl+click / Cmd+click opens a new tab.
 *
 * Usage:
 *   <ListItemButton {...navLinkProps("/catalog", navigate)} />
 *   <TableRow {...navLinkProps(`/products/${id}`, navigate)} sx={{ cursor: "pointer" }} />
 */
export function navLinkProps(path: string, navigate: NavigateFunction, onNavigate?: () => void) {
  return {
    component: "a" as const,
    href: path,
    onClick: (e: React.MouseEvent) => {
      if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        navigate(path);
        onNavigate?.();
      }
    },
  };
}
