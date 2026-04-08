/**
 * Sync engine: pulls products from backend, pushes pending sales.
 */
import {
  setCachedProducts,
  setLocalStock,
  getPendingSales, removePendingSale,
  getConfig, setConfig,
  type PosProduct,
} from "./db";
import { fetchProducts, pushSale, isOnline } from "./api";

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

  // Rebuild local stock from backend data
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
    await setLocalStock(stock);
  }

  // Update last sync time
  if (config) {
    await setConfig({ ...config, lastProductSync: new Date().toISOString() });
  }

  return products;
}

export async function syncPendingSales(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSales();
  const unsynced = pending.filter((s) => !s.syncedAt);

  let synced = 0;
  let failed = 0;

  for (const sale of unsynced) {
    try {
      await pushSale({
        lines: sale.lines.map((l) => ({
          variant: l.variantId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          location: l.location,
          discountAmount: "0",
          discountNote: "",
        })),
        note: sale.note
          ? `[POS ${new Date(sale.deviceCreatedAt).toLocaleString()}] ${sale.note}`
          : `[POS ${new Date(sale.deviceCreatedAt).toLocaleString()}]`,
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

export async function fullSync(): Promise<{ products: number; salesSynced: number; salesFailed: number }> {
  const online = await isOnline();
  if (!online) throw new Error("offline");

  const salesResult = await syncPendingSales();
  const products = await syncProducts();

  return {
    products: products.length,
    salesSynced: salesResult.synced,
    salesFailed: salesResult.failed,
  };
}
