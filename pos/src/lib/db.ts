/**
 * Local IndexedDB store for offline-first POS.
 *
 * Stores:
 * - products: full product+variant list (synced from backend)
 * - stock: local stock counts per variant+location (updated on sale, refreshed on sync)
 * - pendingSales: sales completed offline, waiting to sync
 * - config: terminal settings (locationId, lastSync, etc.)
 */
import { get, set } from "idb-keyval";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PosProduct {
  id: string;
  name: string;
  primaryPhoto: string | null;
  basePrice: string;
  itemType: "physical" | "service";
  categories: string[];
  categoryNames: string[];
  variants: PosVariant[];
}

export interface PosVariant {
  id: string;
  effectivePrice: string;
  attributeValues: Array<{ id: string; value: string; colorHex: string | null }>;
  sku: string;
  isActive: boolean;
  isDefault: boolean;
  totalStock: number;
  stockByLocation?: Record<string, number>;
  galleryPhotoUrl: string | null;
}

export interface PendingSale {
  id: string; // client-generated UUID
  lines: Array<{
    variantId: string;
    description: string;
    quantity: string;
    unitPrice: string;
    location: string | null;
  }>;
  note: string;
  deviceCreatedAt: string; // ISO timestamp when the sale happened on device
  locationId: string;
  syncedAt: string | null; // null = not yet synced
}

export interface PosConfig {
  locationId: string;
  locationName: string;
  lastProductSync: string | null;
  lastSaleSync: string | null;
}

// ─── Products cache ──────────────────────────────────────────────────────────

export async function getCachedProducts(): Promise<PosProduct[]> {
  return (await get("pos_products")) ?? [];
}

export async function setCachedProducts(products: PosProduct[]): Promise<void> {
  await set("pos_products", products);
}

// ─── Local stock (mutable offline copy) ──────────────────────────────────────

/** stock key = `${variantId}:${locationId}` → quantity */
export async function getLocalStock(): Promise<Record<string, number>> {
  return (await get("pos_stock")) ?? {};
}

export async function setLocalStock(stock: Record<string, number>): Promise<void> {
  await set("pos_stock", stock);
}

export async function deductLocalStock(
  variantId: string,
  locationId: string,
  qty: number,
): Promise<void> {
  const stock = await getLocalStock();
  const key = `${variantId}:${locationId}`;
  stock[key] = Math.max(0, (stock[key] ?? 0) - qty);
  await setLocalStock(stock);
}

// ─── Pending sales queue ─────────────────────────────────────────────────────

export async function getPendingSales(): Promise<PendingSale[]> {
  return (await get("pos_pending_sales")) ?? [];
}

export async function addPendingSale(sale: PendingSale): Promise<void> {
  const pending = await getPendingSales();
  pending.push(sale);
  await set("pos_pending_sales", pending);
}

export async function removePendingSale(id: string): Promise<void> {
  const pending = await getPendingSales();
  await set("pos_pending_sales", pending.filter((s) => s.id !== id));
}

export async function clearSyncedSales(): Promise<void> {
  const pending = await getPendingSales();
  await set("pos_pending_sales", pending.filter((s) => !s.syncedAt));
}

// ─── Config ──────────────────────────────────────────────────────────────────

export async function getConfig(): Promise<PosConfig | null> {
  return (await get("pos_config")) ?? null;
}

export async function setConfig(config: PosConfig): Promise<void> {
  await set("pos_config", config);
}
