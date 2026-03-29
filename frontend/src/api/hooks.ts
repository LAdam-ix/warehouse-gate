import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "./client/axiosInstance";
import type {
  Firm, FirmUpdate, WarehouseSettings, WarehouseSettingsUpdate,
  Category, CategoryCreate, CategoryUpdate,
  Product, ProductDetail, ProductCreate, ProductUpdate,
  ProductVariant, ProductVariantCreate, ProductVariantUpdate,
  VariantAttributeCreate, VariantAttributeUpdate,
  AttributeValueCreate, AttributeValueUpdate,
  Location, LocationCreate, LocationUpdate,
  StockEntry, StockMovement,
  AddStockPayload, AdjustStockPayload, TransferStockPayload, BatchTransferPayload,
  Sale, SaleCreate, SaleWrite,
  SaleLine, SaleLineCreate, SaleLineUpdate,
  DamageReport, DamageReportCreate,
  ProductionRequest, ProductionRequestCreate, ProductionRequestFulfill,
  DashboardData, DashboardPeriod,
  PaginatedResponse,
} from "../types/api";

const get = <T>(url: string, params?: Record<string, unknown>) =>
  axiosInstance.get<T>(url, { params }).then((r) => r.data);

const post = <T>(url: string, data?: unknown) =>
  axiosInstance.post<T>(url, data).then((r) => r.data);

const patch = <T>(url: string, data?: unknown) =>
  axiosInstance.patch<T>(url, data).then((r) => r.data);

const del = (url: string) => axiosInstance.delete(url).then((r) => r.data);

// ─── Firm / Settings ──────────────────────────────────────────────────────────

export const useFirm = () =>
  useQuery({ queryKey: ["firm"], queryFn: () => get<Firm>("/firm/") });

export const useUpdateFirm = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FirmUpdate) => patch<Firm>("/firm/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firm"] }),
  });
};

export const useWarehouseSettings = () =>
  useQuery({ queryKey: ["warehouse-settings"], queryFn: () => get<WarehouseSettings>("/settings/") });

export const useUpdateWarehouseSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WarehouseSettingsUpdate) => patch<WarehouseSettings>("/settings/", data),
    onSuccess: () => qc.refetchQueries({ queryKey: ["warehouse-settings"] }),
  });
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const useDashboard = (period: DashboardPeriod = "month") =>
  useQuery({
    queryKey: ["dashboard", period],
    queryFn: () => get<DashboardData>("/dashboard/", { period }),
  });

// ─── Categories ───────────────────────────────────────────────────────────────

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: () => get<PaginatedResponse<Category>>("/categories/").then((r) => r.results),
  });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoryCreate) => post<Category>("/categories/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
};

export const useUpdateCategory = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoryUpdate) => patch<Category>(`/categories/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/categories/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
};

// ─── Products ─────────────────────────────────────────────────────────────────

// TODO(pagination): currently fetches only the first backend page — silent data loss once catalog grows.
// Plan: CatalogPage → standard DRF pagination (page param, prev/next buttons) so product X is always on page N.
// Plan: picker panels (ProductPickerPanel and similar) → useInfiniteQuery + IntersectionObserver sentinel at
//       list bottom to auto-load next page on scroll; search already hits server so it works at any scale.
// React Query supports both patterns: useQuery for paged catalog, useInfiniteQuery for picker scroll.
export const useProducts = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ["products", params],
    queryFn: () => get<PaginatedResponse<Product>>("/products/", params),
  });

export const useProduct = (id: string) =>
  useQuery({
    queryKey: ["products", id],
    queryFn: () => get<ProductDetail>(`/products/${id}/`),
    enabled: !!id,
  });

export const useProductTree = (id: string) =>
  useQuery({
    queryKey: ["products", id, "tree"],
    queryFn: () => get<unknown>(`/products/${id}/tree/`),
    enabled: !!id,
  });

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductCreate) => post<ProductDetail>("/products/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useUpdateProduct = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductUpdate) => patch<ProductDetail>(`/products/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", id] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/products/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useUploadProductPhoto = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("image", file);
      return axiosInstance
        .post(`/products/${productId}/upload-photo/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useDeleteProductPhoto = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => del(`/products/${productId}/photos/${photoId}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useSetPrimaryPhoto = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) =>
      axiosInstance.patch(`/products/${productId}/photos/${photoId}/set-primary/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useReorderPhotos = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: string[]) =>
      axiosInstance.post(`/products/${productId}/reorder-photos/`, { order }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};


// ─── Variants ────────────────────────────────────────────────────────────────

export const useVariants = (productId?: string) =>
  useQuery({
    queryKey: ["variants", productId],
    queryFn: () =>
      get<PaginatedResponse<ProductVariant>>("/variants/", productId ? { product: productId } : undefined).then(
        (r) => r.results
      ),
  });

export const useCreateVariant = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductVariantCreate) => post<ProductVariant>("/variants/", data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["variants"] });
      qc.invalidateQueries({ queryKey: ["products", vars.product] });
    },
  });
};

export const useUpdateVariant = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductVariantUpdate) => patch<ProductVariant>(`/variants/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["variants"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useDeleteVariant = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/variants/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["variants"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

// ─── Attributes ──────────────────────────────────────────────────────────────

export const useCreateAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: VariantAttributeCreate) => post<unknown>("/attributes/", data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["products", vars.product] }),
  });
};

export const useUpdateAttribute = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: VariantAttributeUpdate) => patch<unknown>(`/attributes/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

// Used for reordering: payload includes the id so two attributes can be patched in one handler
export const useReorderAttributes = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (swaps: { id: string; sortOrder: number }[]) => {
      for (const { id, sortOrder } of swaps) {
        await patch(`/attributes/${id}/`, { sortOrder });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useDeleteAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/attributes/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useCreateAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AttributeValueCreate) => post<unknown>("/attribute-values/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useReorderAttributeValues = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { id: string; sortOrder: number }[]) => {
      for (const { id, sortOrder } of values) {
        await patch(`/attribute-values/${id}/`, { sortOrder });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useUpdateAttributeValue = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AttributeValueUpdate) => patch<unknown>(`/attribute-values/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useDeleteAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/attribute-values/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useUploadVariantPhoto = (variantId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("photo", file);
      return axiosInstance.post<ProductVariant>(`/variants/${variantId}/upload-photo/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((r) => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

// ─── Locations ───────────────────────────────────────────────────────────────

export const useLocations = () =>
  useQuery({
    queryKey: ["locations"],
    queryFn: () => get<PaginatedResponse<Location>>("/locations/").then((r) => r.results),
  });

export const useCreateLocation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LocationCreate) => post<Location>("/locations/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });
};

export const useUpdateLocation = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LocationUpdate) => patch<Location>(`/locations/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });
};

export const useDeleteLocation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/locations/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });
};

export const useMoveLocation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: "up" | "down" }) =>
      post<Location[]>(`/locations/${id}/move-${direction}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });
};

// ─── Stock ───────────────────────────────────────────────────────────────────

export const useStockEntries = (params?: Record<string, unknown>, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: ["stock-entries", params],
    queryFn: () =>
      get<PaginatedResponse<StockEntry>>("/stock-entries/", params).then((r) => r.results),
    enabled: options.enabled ?? true,
  });

export const useStockMovements = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ["stock-movements", params],
    queryFn: () => get<PaginatedResponse<StockMovement>>("/stock-movements/", params),
  });

export const useAddStock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddStockPayload) => post<{ movementsCreated: number; errors: unknown[] }>("/stock/add/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["variants"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useAdjustStock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AdjustStockPayload) => post<StockMovement>("/stock/adjust/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["variants"] });
    },
  });
};

export const useTransferStock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TransferStockPayload) =>
      post<{ out: StockMovement; in: StockMovement }>("/stock/transfer/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useBatchTransfer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchTransferPayload) =>
      post<{ transfersCompleted: number; errors: unknown[]; batchId: string }>("/stock/batch-transfer/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["variants"] });
    },
  });
};

export const useRevertMovement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (movementId: string) =>
      post(`/stock-movements/${movementId}/revert/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["variants"] });
    },
  });
};

// ─── Sales ───────────────────────────────────────────────────────────────────

export const useSales = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ["sales", params],
    queryFn: () => get<PaginatedResponse<Sale>>("/sales/", params),
  });

export const useSale = (id: string) =>
  useQuery({
    queryKey: ["sales", id],
    queryFn: () => get<Sale>(`/sales/${id}/`),
    enabled: !!id,
  });

export const useCreateSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SaleCreate) => post<Sale>("/sales/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
};

export const useQuickSell = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      variantId: string | null;
      description: string;
      quantity: string;
      unitPrice: string;
    }) => {
      const sale = await post<Sale>("/sales/", {});
      await post<SaleLine>(`/sales/${sale.id}/lines/`, {
        variant: payload.variantId,
        description: payload.description,
        quantity: payload.quantity,
        unitPrice: payload.unitPrice,
        discountAmount: "0",
        discountNote: "",
      });
      return post<Sale>(`/sales/${sale.id}/finalize/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useUpdateSale = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SaleWrite) => patch<Sale>(`/sales/${id}/`, data),
    onSuccess: () => qc.refetchQueries({ queryKey: ["sales", id] }),
  });
};

export const useFinalizeSale = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<Sale>(`/sales/${id}/finalize/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useVoidSale = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<Sale>(`/sales/${id}/void/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
    },
  });
};

export const useDeleteSale = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del(`/sales/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
};

export const useAddSaleLine = (saleId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SaleLineCreate) => post<SaleLine>(`/sales/${saleId}/lines/`, data),
    onSuccess: () => qc.refetchQueries({ queryKey: ["sales", saleId] }),
  });
};

export const useUpdateSaleLine = (saleId: string, lineId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SaleLineUpdate) => patch<SaleLine>(`/sales/${saleId}/lines/${lineId}/`, data),
    onSuccess: () => qc.refetchQueries({ queryKey: ["sales", saleId] }),
  });
};

export const useDeleteSaleLine = (saleId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => del(`/sales/${saleId}/lines/${lineId}/`),
    onSuccess: () => qc.refetchQueries({ queryKey: ["sales", saleId] }),
  });
};

// ─── Damage ───────────────────────────────────────────────────────────────────

export const useDamageReports = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ["damage-reports", params],
    queryFn: () => get<PaginatedResponse<DamageReport>>("/damage-reports/", params),
  });

export const useCreateDamageReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DamageReportCreate) => post<DamageReport>("/damage-reports/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["damage-reports"] });
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["variants"] });
    },
  });
};

// ─── Production Requests ─────────────────────────────────────────────────────

export const useProductionRequests = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ["production-requests", params],
    queryFn: () =>
      get<PaginatedResponse<ProductionRequest>>("/production-requests/", params),
  });

export const useCreateProductionRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductionRequestCreate) =>
      post<ProductionRequest>("/production-requests/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["production-requests"] }),
  });
};

export const useUpdateProductionRequest = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProductionRequestCreate>) =>
      patch<ProductionRequest>(`/production-requests/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["production-requests"] }),
  });
};

export const useFulfillProductionRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: ProductionRequestFulfill & { id: string }) =>
      post<ProductionRequest>(`/production-requests/${id}/fulfill/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-requests"] });
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["variants"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useCancelProductionRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<ProductionRequest>(`/production-requests/${id}/cancel/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["production-requests"] }),
  });
};
