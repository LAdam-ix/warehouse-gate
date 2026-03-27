/**
 * Form utilities.
 *
 * The core problem: forms need string values (inputs are strings), no nulls.
 * API responses have nulls and sometimes numbers.
 * Instead of writing a bespoke toFormValues() per type, use these.
 */

/**
 * Convert null/undefined values in an object to empty strings.
 * Numbers and booleans are converted to their string representation.
 * Use as form defaultValues.
 *
 * @example
 * const defaults = nullsToEmpty({ name: product.name, category: product.category })
 * // { name: "Dragon", category: "" }  ← null became ""
 */
export function nullsToEmpty<T extends Record<string, unknown>>(
  obj: T
): { [K in keyof T]: string } {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      v == null ? "" : String(v),
    ])
  ) as { [K in keyof T]: string };
}

/**
 * Convert empty strings back to null for fields that the API expects as nullable.
 * Use before sending form values to a mutation.
 *
 * @example
 * const payload = emptyToNulls(formValues, ["category", "priceOverride"])
 * // { ..., category: null }  ← "" became null
 */
export function emptyToNulls<T extends Record<string, string>>(
  obj: T,
  nullableFields: (keyof T)[]
): { [K in keyof T]: T[K] | null } {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      nullableFields.includes(k as keyof T) && v === "" ? null : v,
    ])
  ) as { [K in keyof T]: T[K] | null };
}

/**
 * slotProps.htmlInput for integer-only quantity fields.
 * Blocks decimal point, comma, and scientific notation (e/E).
 * Allows digits and +/- signs only.
 *
 * @example
 * <TextField type="number" slotProps={{ htmlInput: intQtyInputProps }} />
 */
export const intQtyInputProps = {
  step: 1,
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['.', ',', 'e', 'E'].includes(e.key)) e.preventDefault();
  },
} as const;

/**
 * onKeyDown handler for decimal number fields (prices, rates, costs).
 * Blocks 'e', 'E' which browsers allow in type="number" inputs.
 * Allows digits, minus, plus, dot, comma, parentheses, *, / for inline math.
 *
 * @example
 * <TextField type="number" onKeyDown={blockNonDecimal} />
 */
export const blockNonDecimal = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['e', 'E'].includes(e.key)) e.preventDefault();
};

/**
 * Evaluate a simple math expression (+-/*() with numbers).
 * Returns the result rounded to `decimals` places, or null if invalid.
 * Only allows digits, operators, parentheses, dots, and spaces — no code injection.
 */
export function evalMath(expr: string, decimals = 2): number | null {
  const cleaned = expr.replace(/,/g, ".").trim();
  if (!cleaned || /^-?\d*\.?\d*$/.test(cleaned)) return null; // plain number, nothing to eval
  if (!/^[\d\s+\-*/.()]+$/.test(cleaned)) return null; // reject anything suspicious
  try {
    const result = new Function(`"use strict"; return (${cleaned});`)();
    if (typeof result !== "number" || !isFinite(result)) return null;
    return Math.round(result * 10 ** decimals) / 10 ** decimals;
  } catch {
    return null;
  }
}

/**
 * onKeyDown handler that evaluates inline math on Enter.
 * Attach to price/cost TextFields alongside onChange.
 *
 * @example
 * <TextField
 *   value={price}
 *   onChange={(e) => setPrice(e.target.value)}
 *   onKeyDown={mathKeyDown((result) => setPrice(String(result)))}
 * />
 */
export function mathKeyDown(onResult: (value: number) => void, decimals = 2) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    blockNonDecimal(e);
    if (e.key === "Enter") {
      const input = e.currentTarget.querySelector?.("input") as HTMLInputElement | null;
      const val = input?.value ?? (e.target as HTMLInputElement).value;
      const result = evalMath(val, decimals);
      if (result !== null) {
        e.preventDefault();
        onResult(result);
      }
    }
  };
}

/**
 * Strip keys from an object before sending to the API.
 * Use when your form type extends the API type with extra form-only fields.
 *
 * @example
 * type FormValues = SaleWrite & { applyDiscount: boolean }
 * const payload = stripKeys(formValues, ["applyDiscount"])
 */
export function stripKeys<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}
