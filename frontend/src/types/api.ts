/**
 * API types — one type per entity matching the GET response shape.
 * Create/Update types are derived with Omit/Partial so adding a field
 * to the base type automatically flows through to everything else.
 *
 * Readonly fields stripped from write types: id, createdAt, updatedAt, createdBy, updatedBy
 */

// ─── Shared ───────────────────────────────────────────────────────────────────

/** Fields the backend always adds — never sent by the client */
type ReadonlyFields = "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy";

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Firm / Auth stubs ────────────────────────────────────────────────────────

export interface Firm {
  id: string;
  name: string;
}

export type FirmUpdate = Partial<Pick<Firm, "name">>;

export interface WarehouseSettings {
  showSku: boolean;
  skipConfirm: boolean;
  defaultEnergyRate: string | null;
  warehouseMode: "strict" | "soft" | "disabled";
}

export type WarehouseSettingsUpdate = Partial<WarehouseSettings>;

// ─── Category ─────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type CategoryCreate = Omit<Category, ReadonlyFields>;
export type CategoryUpdate = Partial<CategoryCreate>;

// ─── Product ──────────────────────────────────────────────────────────────────

/**
 * Returned by the list endpoint — compact, no nested objects.
 * The detail endpoint (ProductDetail) extends this with full nested data.
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  /** IDs of assigned categories */
  categories: string[];
  /** Names in same order as categories[] — read-only, derived */
  categoryNames: string[];
  itemType: "physical" | "service";
  servicePricing: "flat" | "hourly" | null;
  basePrice: string;
  baseWeight: string | null;
  hourlyRate: string | null;
  lowStockThreshold: number | null;
  isActive: boolean;
  variantCount: number;
  totalStock: number;
  primaryPhoto: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Returned by the detail endpoint — superset of Product */
export interface ProductDetail extends Product {
  cost: ProductCost | null;
  photos: ProductPhoto[];
  attributes: VariantAttribute[];
  variants: ProductVariant[];
}

/**
 * Fields the client sends when creating or updating a product.
 * Omits readonly fields and derived/nested-only fields (photos, variants, etc.
 * are managed through their own endpoints).
 */
export type ProductCreate = Omit<
  Product,
  ReadonlyFields | "categoryNames" | "variantCount" | "totalStock" | "primaryPhoto" | "baseWeight"
> & { cost?: ProductCostWrite | null; baseWeight?: string | null };

export type ProductUpdate = Partial<ProductCreate>;

// ─── Product Cost ─────────────────────────────────────────────────────────────

export interface ProductCost {
  material: string;
  energyKwh: string;
  energyRate: string;
  laborHours: string;
  laborRate: string;
  other: string;
  notes: string;
  total: string;
}

// Same fields are writable — no readonly fields on cost
export type ProductCostWrite = Omit<ProductCost, "total">;

// ─── Product Photos ───────────────────────────────────────────────────────────

export interface ProductPhoto {
  id: string;
  image: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
}

// ─── Variant Attributes ───────────────────────────────────────────────────────

export interface AttributeValue {
  id: string;
  value: string;
  colorHex: string | null;
  sortOrder: number;
  priceDelta: string;
  costDelta: string;
  weightDelta: string;
}

export type AttributeValueCreate = Omit<AttributeValue, "id"> & { attribute: string };
export type AttributeValueUpdate = Partial<Omit<AttributeValueCreate, "attribute">>;

export interface VariantAttribute {
  id: string;
  name: string;
  attributeType: "text" | "color" | "number";
  sortOrder: number;
  values: AttributeValue[];
}

export type VariantAttributeCreate = Omit<VariantAttribute, "id" | "values"> & { product: string };
export type VariantAttributeUpdate = Partial<Omit<VariantAttributeCreate, "product">>;

// ─── Product Variant ──────────────────────────────────────────────────────────

export interface ProductVariant {
  id: string;
  product: string;
  attributeValues: AttributeValue[];
  sku: string;
  priceDelta: string;
  costDelta: string;
  priceOverride: string | null;
  costOverride: string | null;
  weight: string | null;
  photo: string | null;
  /** FK to a ProductPhoto in the product gallery */
  galleryPhoto: string | null;
  /** Resolved URL: galleryPhoto.image if set, else photo, else null */
  galleryPhotoUrl: string | null;
  lowStockThreshold: number | null;
  isActive: boolean;
  isDefault: boolean;
  // Computed by backend, read-only
  effectivePrice: string;
  effectiveCost: string;
  effectiveWeight: string | null;
  totalStock: number;
  stockByLocation?: Record<string, number>;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductVariantCreate = Omit<
  ProductVariant,
  ReadonlyFields | "effectivePrice" | "effectiveCost" | "effectiveWeight" | "totalStock" | "stockByLocation" | "isLowStock" | "isDefault" | "attributeValues" | "galleryPhotoUrl" | "priceOverride" | "costOverride" | "weight"
> & {
  attributeValueIds?: string[];
  priceOverride?: string | null;
  costOverride?: string | null;
  weight?: string | null;
};

export type ProductVariantUpdate = Partial<ProductVariantCreate>;

// ─── Location ─────────────────────────────────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type LocationCreate = Omit<Location, ReadonlyFields | "sortOrder">;
export type LocationUpdate = Partial<LocationCreate>;

// ─── Stock ────────────────────────────────────────────────────────────────────

export interface StockEntry {
  id: string;
  variant: string;
  variantName: string;
  productName: string;
  location: string;
  locationName: string;
  quantity: number;
}

export interface StockMovement {
  id: string;
  variant: string;
  variantName: string;
  location: string;
  locationName: string;
  movementType:
    | "produced"
    | "sold"
    | "damaged"
    | "adjustment"
    | "returned"
    | "refund_return"
    | "transfer_out"
    | "transfer_in";
  quantityDelta: number;
  note: string;
  movementDate: string;
  batchId: string | null;
  saleLine: string | null;
  damageReport: string | null;
  isRevertable: boolean;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
}

// Stock action payloads — not derived from entity types since these are
// action-specific, not CRUD on a resource
export interface AddStockPayload {
  lines: Array<{ variantId: string; quantity: number; locationId?: string }>;
  locationId?: string;
  note?: string;
  movementDate?: string;
}

export interface AdjustStockPayload {
  variantId: string;
  locationId: string;
  newQuantity: number;
  note?: string;
  movementDate?: string;
}

export interface TransferStockPayload {
  variantId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  note?: string;
  movementDate?: string;
}

export interface BatchTransferPayload {
  lines: { variantId: string; fromLocationId: string; quantity: number }[];
  toLocationId: string;
  note?: string;
  movementDate?: string;
}

export interface RedistributePayload {
  locationId: string;
  lines: { variantId: string; delta: number }[];
  note?: string;
}

// ─── Sale ─────────────────────────────────────────────────────────────────────

export interface Sale {
  id: string;
  status: "draft" | "finalized" | "voided" | "discarded" | "refunded";
  note: string;
  customerLabel: string;
  invoiceId: string | null;
  creditNoteId: string | null;
  discountPercentage: string;
  discountFixed: string;
  finalizedAt: string | null;
  // Computed totals — read-only
  subtotal: string;
  discountTotal: string;
  total: string;
  costTotal: string;
  profit: string;
  lines: SaleLine[];
  lineCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fields editable by the client on a draft sale.
 * status, totals, finalizedAt are all controlled by backend actions.
 */
export type SaleWrite = Partial<Pick<Sale, "note" | "customerLabel" | "discountPercentage" | "discountFixed">> & {
  invoiceId?: string | null;
};

export type SaleCreate = Partial<SaleWrite>; // all optional — can create an empty draft

// ─── Sale Line ────────────────────────────────────────────────────────────────

export interface SaleLine {
  id: string;
  sale: string;
  variant: string | null;
  variantName: string | null;
  location: string | null;
  locationName: string | null;
  description: string;
  quantity: string;
  hours: string | null;
  unitPrice: string;
  discountAmount: string;
  discountNote: string;
  sortOrder: number;
  // Computed — read-only
  lineSubtotal: string;
  lineTotal: string;
  lineCost: string;
  lineProfit: string;
  createdAt: string;
  updatedAt: string;
}

export type SaleLineCreate = Omit<
  SaleLine,
  ReadonlyFields | "sale" | "variantName" | "locationName" | "lineSubtotal" | "lineTotal" | "lineCost" | "lineProfit" | "quantity" | "hours" | "sortOrder"
> & {
  quantity?: string;
  hours?: string | null;
};

export type SaleLineUpdate = Partial<SaleLineCreate>;

// ─── Damage Report ────────────────────────────────────────────────────────────

export interface DamageReport {
  id: string;
  variant: string;
  variantName: string;
  location: string;
  locationName: string;
  quantity: number;
  reason: string;
  note: string;
  estimatedValueLost: string;
  reportDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  createdByName: string | null;
}

export type DamageReportCreate = Omit<
  DamageReport,
  ReadonlyFields | "variantName" | "locationName" | "createdByName" | "estimatedValueLost" | "note" | "batchId"
> & { estimatedValueLost?: string; note?: string; batchId?: string };

// ─── Production Request ───────────────────────────────────────────────────────

export interface ProductionRequest {
  id: string;
  variant: string;
  variantName: string;
  productId: string;
  productName: string;
  quantityRequested: number;
  quantityTarget: number | null;
  status: "pending" | "in_progress" | "fulfilled" | "cancelled";
  trigger: "auto" | "manual" | "seasonal";
  note: string;
  fulfilledAt: string | null;
  fulfilledBy: string | null;
  fulfilledByName: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  createdByName: string | null;
}

export interface ProductionRequestCreate {
  variant: string;
  quantityRequested: number;
  quantityTarget?: number | null;
  trigger?: ProductionRequest["trigger"];
  note?: string;
}

export interface ProductionRequestFulfill {
  quantity?: number;
  locationId?: string;
  note?: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export type DashboardPeriod = "today" | "week" | "month" | "year" | "all" | "custom";

export interface DashboardData {
  period: DashboardPeriod;
  catalog: {
    totalProducts: number;
    totalVariants: number;
    totalStockUnits: number;
    stockValue: number;
    stockPotentialProfit: number;
    lowStockVariants: number;
  };
  salesPeriod: {
    count: number;
    revenue: number;
    cost: number;
    profit: number;
    netProfit: number;
  };
  salesAllTime: {
    revenue: number;
    profit: number;
  };
  damagePeriod: {
    count: number;
    estimatedValueLost: number;
  };
  // Dashboard returns a subset of Sale fields with total as number (float() in Python).
  // This differs from Sale.total which is string (DRF DecimalField serialization).
  recentSales: Array<Pick<Sale, "id" | "status" | "note" | "createdAt"> & { total: number }>;
}
