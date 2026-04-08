/**
 * API client for the warehouse backend.
 * Used for syncing products and pushing completed sales.
 */

const BASE = "/api/v1";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
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

export async function fetchProducts(): Promise<ApiProductDetail[]> {
  // Fetch product list, then fetch each product's detail for variants
  const list = await fetchJson<PaginatedResponse<ApiProduct>>("/products/?page_size=9999");
  const details: ApiProductDetail[] = [];
  for (const p of list.results) {
    const detail = await fetchJson<ApiProductDetail>(`/products/${p.id}/`);
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
  note: string;
}): Promise<{ id: string }> {
  // Create sale
  const created = await fetchJson<{ id: string }>("/sales/", {
    method: "POST",
    body: JSON.stringify({ note: sale.note || undefined }),
  });

  // Add lines
  for (const line of sale.lines) {
    await fetchJson(`/sales/${created.id}/lines/`, {
      method: "POST",
      body: JSON.stringify(line),
    });
  }

  // Finalize immediately — POS sales are completed transactions
  await fetchJson(`/sales/${created.id}/finalize/`, { method: "POST" });

  return created;
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
