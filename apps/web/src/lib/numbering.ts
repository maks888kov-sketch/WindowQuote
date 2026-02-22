/** Validate format: ORD-000001 (DB trigger generated) */
export function isValidOrderNumber(s: string | null | undefined): boolean {
  if (s == null || typeof s !== "string") return false;
  return /^ORD-\d{6}$/.test(s);
}

/** Validate format: Q-000001 (DB trigger generated) */
export function isValidQuoteNumber(s: string | null | undefined): boolean {
  if (s == null || typeof s !== "string") return false;
  return /^Q-\d{6}$/.test(s);
}
