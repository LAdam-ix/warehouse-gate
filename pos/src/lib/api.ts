/**
 * API client for the warehouse backend.
 * Used for syncing products and pushing completed sales.
 */

const BASE = "/api/v1";

let _apiToken = "";
export function setApiToken(token: string) { _apiToken = token; }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...init?.headers as Record<string, string>,
  };
  if (_apiToken) {
    headers["Authorization"] = `PosToken ${_apiToken}`;
  }
  const res = await fetch(BASE + url, { ...init, headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── Products ────────────────────────────────────────────────────────────────

interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
}

export interface ApiProduct {
  id: string;
  name: string;
  primaryPhoto: string | null;
  basePrice: string;
  itemType: "physical" | "service";
  categories: string[];
  categoryNames: string[];
}

export interface ApiProductDetail extends ApiProduct {
  variants: ApiVariant[];
}

export interface ApiVariant {
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

export interface ApiLocation {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
}

/** Strip internal hostname from media URLs — keep only the path (e.g. /media/...) */
function fixUrl(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).pathname; } catch { return url; }
}

export async function fetchProducts(): Promise<ApiProductDetail[]> {
  const list = await fetchJson<PaginatedResponse<ApiProduct>>("/products/?page_size=9999");
  const details: ApiProductDetail[] = [];
  for (const p of list.results) {
    const detail = await fetchJson<ApiProductDetail>(`/products/${p.id}/`);
    detail.primaryPhoto = fixUrl(detail.primaryPhoto);
    for (const v of detail.variants) {
      v.galleryPhotoUrl = fixUrl(v.galleryPhotoUrl);
    }
    details.push(detail);
  }
  return details;
}

export async function fetchLocations(): Promise<ApiLocation[]> {
  const res = await fetchJson<PaginatedResponse<ApiLocation>>("/locations/");
  return res.results;
}

// ─── Sales ───────────────────────────────────────────────────────────────────

interface SaleLinePayload {
  variant: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  location: string | null;
  discountAmount: string;
  discountNote: string;
}

export async function pushSale(sale: {
  lines: SaleLinePayload[];
  discountPercentage?: string;
  discountFixed?: string;
  note: string;
  deviceCreatedAt: string;
}): Promise<{ id: string }> {
  // Create sale with POS source
  const created = await fetchJson<{ id: string }>("/sales/", {
    method: "POST",
    body: JSON.stringify({
      note: sale.note || undefined,
      discountPercentage: sale.discountPercentage || undefined,
      discountFixed: sale.discountFixed || undefined,
      source: "pos",
      deviceCreatedAt: sale.deviceCreatedAt,
    }),
  });

  // Add lines
  for (const line of sale.lines) {
    await fetchJson(`/sales/${created.id}/lines/`, {
      method: "POST",
      body: JSON.stringify(line),
    });
  }

  // POS-finalize: deducts stock but sets status to pending_review (editable for 5 days)
  await fetchJson(`/sales/${created.id}/pos-finalize/`, { method: "POST" });

  return created;
}

// ─── Production ──────────────────────────────────────────────────────────────

export async function pushProductionRequest(req: {
  variantId: string;
  quantity: number;
  locationId: string;
  note: string;
}): Promise<{ id: string }> {
  return fetchJson<{ id: string }>("/production-requests/", {
    method: "POST",
    body: JSON.stringify({
      variant: req.variantId,
      quantity: req.quantity,
      targetLocation: req.locationId,
      note: req.note,
    }),
  });
}

export async function isOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const res = await fetch(BASE + "/settings/", { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}
