/** Separator used between attribute values in variant labels everywhere. */
export const VARIANT_SEP = " | ";

/**
 * Builds a display label from a variant's attributeValues array.
 * The array must already be ordered by attribute sort_order — the backend
 * guarantees this order since the serializer sorts by attribute__sort_order.
 */
export function variantLabel(
  attributeValues: { value: string }[],
): string {
  return attributeValues.map((av) => av.value).join(VARIANT_SEP);
}

/**
 * Sort variants by their attribute values' sortOrder (matching product detail page order).
 * Falls back to label comparison for equal sortOrders.
 */
export function sortVariants<T extends { attributeValues: { value: string; sortOrder?: number }[] }>(
  variants: T[],
): T[] {
  return [...variants].sort((a, b) => {
    for (let i = 0; i < Math.max(a.attributeValues.length, b.attributeValues.length); i++) {
      const ao = a.attributeValues[i]?.sortOrder ?? 0;
      const bo = b.attributeValues[i]?.sortOrder ?? 0;
      if (ao !== bo) return ao - bo;
    }
    return variantLabel(a.attributeValues).localeCompare(variantLabel(b.attributeValues));
  });
}
