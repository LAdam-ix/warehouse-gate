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
