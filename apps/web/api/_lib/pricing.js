/**
 * Pricing engine: compute line amount from measurement item, price item, and rule.
 */
export function computeLineAmount(measurementItem, priceItem, rule) {
  const w = Number(measurementItem.width) || 0;
  const h = Number(measurementItem.height) || 0;
  const qty = Number(measurementItem.qty) || 1;
  const unitPrice = Number(priceItem.unit_price) || 0;

  const ruleType = rule?.rule_type ?? "area_price";
  const areaDivisor = rule?.rule_json?.area_divisor ?? 10000; // cm² → m²

  let amount = 0;
  if (ruleType === "fixed_price") {
    amount = unitPrice * qty;
  } else {
    const areaM2 = (w * h) / areaDivisor;
    amount = Math.max(areaM2 * unitPrice * qty, unitPrice * qty);
  }

  return Math.round(amount * 100) / 100;
}
