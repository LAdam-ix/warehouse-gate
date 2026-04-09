/**
 * Sync engine.
 * Products: auto-pulled from backend (safe, read-only).
 * Sales: pushed to backend ONLY on manual trigger (user controls when sales leave device).
 */
import {
  setCachedProducts,
  setLocalStock,
  getPendingSales, removePendingSale,
  getPendingProductions, removePendingProduction,
  getConfig, setConfig,
  type PosProduct,
} from "./db";
import { fetchProducts, pushSale, pushProductionRequest, isOnline } from "./api";

export async function syncProducts(): Promise<PosProduct[]> {
  const apiProducts = await fetchProducts();

  const products: PosProduct[] = apiProducts.map((p) => ({
    id: p.id,
    name: p.name,
    primaryPhoto: p.primaryPhoto,
    basePrice: p.basePrice,
    itemType: p.itemType,
    categories: p.categories,
    categoryNames: p.categoryNames,
    variants: p.variants
      .filter((v) => v.isActive)
      .map((v) => ({
        id: v.id,
        effectivePrice: v.effectivePrice,
        attributeValues: v.attributeValues,
        sku: v.sku,
        isActive: v.isActive,
        isDefault: v.isDefault,
        totalStock: v.totalStock,
        stockByLocation: v.stockByLocation,
        galleryPhotoUrl: v.galleryPhotoUrl,
      })),
  }));

  await setCachedProducts(products);

  // Rebuild local stock from backend data, but preserve local deductions for unsynced sales
  const config = await getConfig();
  const locationId = config?.locationId;
  if (locationId) {
    const stock: Record<string, number> = {};
    for (const p of products) {
      for (const v of p.variants) {
        const qty = v.stockByLocation?.[locationId] ?? 0;
        stock[`${v.id}:${locationId}`] = qty;
      }
    }
    // Deduct quantities from completed local sales (backend doesn't know about them yet)
    // Drafts don't deduct — the stock is only "reserved" when the sale is completed
    const pending = await getPendingSales();
    for (const sale of pending.filter((s) => s.status === "completed")) {
      for (const line of sale.lines) {
        const key = `${line.variantId}:${locationId}`;
        stock[key] = Math.max(0, (stock[key] ?? 0) - parseInt(line.quantity));
      }
    }
    await setLocalStock(stock);
  }

  if (config) {
    await setConfig({ ...config, lastProductSync: new Date().toISOString() });
  }

  return products;
}

/** Push completed sales to backend. Called manually only. Ignores drafts. */
export async function pushPendingSales(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSales();
  const completed = pending.filter((s) => s.status === "completed");

  let synced = 0;
  let failed = 0;

  for (const sale of completed) {
    try {
      await pushSale({
        lines: sale.lines.map((l) => ({
          variant: l.variantId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          location: l.location,
          discountAmount: l.discountAmount || "0",
          discountNote: l.discountNote || "",
        })),
        discountPercentage: sale.discountPercentage || "0",
        discountFixed: sale.discountFixed || "0",
        note: `[POS: ${sale.deviceName || sale.deviceId.slice(0, 8)} | ${new Date(sale.deviceCreatedAt).toLocaleString()}]${sale.note ? ` ${sale.note}` : ""}`,
        deviceCreatedAt: sale.deviceCreatedAt,
      });
      await removePendingSale(sale.id);
      synced++;
    } catch {
      failed++;
    }
  }

  if (synced > 0) {
    const config = await getConfig();
    if (config) {
      await setConfig({ ...config, lastSaleSync: new Date().toISOString() });
    }
  }

  return { synced, failed };
}

/** Push pending production requests to backend. */
export async function pushPendingProductions(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingProductions();
  let synced = 0;
  let failed = 0;

  for (const req of pending) {
    try {
      await pushProductionRequest({
        variantId: req.variantId,
        quantity: req.quantity,
        locationId: req.locationId,
        note: `[POS: ${req.deviceName || req.deviceId.slice(0, 8)} | ${new Date(req.deviceCreatedAt).toLocaleString()}]${req.note ? ` ${req.note}` : ""}`,
      });
      await removePendingProduction(req.id);
      synced++;
    } catch {
      failed++;
    }
  }
  return { synced, failed };
}

/** Auto-sync: only pulls products (safe). Does NOT push sales. */
export async function autoSync(): Promise<number> {
  const online = await isOnline();
  if (!online) return 0;
  const products = await syncProducts();
  return products.length;
}
