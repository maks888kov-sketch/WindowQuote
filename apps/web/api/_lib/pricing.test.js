import { describe, it, expect } from "vitest";
import { computeLineAmount } from "./pricing.js";

describe("computeLineAmount", () => {
  const basePriceItem = { unit_price: 1 };
  const baseRule = { rule_type: "area_price", rule_json: { area_divisor: 10000 } };

  it("area_price: 1000×1000 cm (100 m²), unit_price 1, qty 1 → 100", () => {
    const mi = { width: 1000, height: 1000, qty: 1 };
    expect(computeLineAmount(mi, basePriceItem, baseRule)).toBe(100);
  });

  it("area_price: 2000×1500 cm (300 m²), unit_price 1, qty 2 → 600", () => {
    const mi = { width: 2000, height: 1500, qty: 2 };
    expect(computeLineAmount(mi, basePriceItem, baseRule)).toBe(600);
  });

  it("area_price: uses minimum unit_price * qty when area is small", () => {
    const mi = { width: 50, height: 50, qty: 1 };
    const priceItem = { unit_price: 100 };
    expect(computeLineAmount(mi, priceItem, baseRule)).toBe(100);
  });

  it("fixed_price: unit_price * qty", () => {
    const mi = { width: 1000, height: 1000, qty: 3 };
    const priceItem = { unit_price: 100 };
    const rule = { rule_type: "fixed_price" };
    expect(computeLineAmount(mi, priceItem, rule)).toBe(300);
  });

  it("respects custom area_divisor", () => {
    const mi = { width: 100, height: 100, qty: 1 };
    const priceItem = { unit_price: 1 };
    const rule = { rule_type: "area_price", rule_json: { area_divisor: 100 } };
    expect(computeLineAmount(mi, priceItem, rule)).toBe(100);
  });

  it("defaults to area_price when rule_type missing", () => {
    const mi = { width: 1000, height: 1000, qty: 1 };
    expect(computeLineAmount(mi, basePriceItem, null)).toBe(100);
  });

  it("handles null/undefined width and height", () => {
    const mi = { width: null, height: undefined, qty: 2 };
    const priceItem = { unit_price: 100 };
    expect(computeLineAmount(mi, priceItem, baseRule)).toBe(200);
  });

  it("rounds to 2 decimal places", () => {
    const mi = { width: 1111, height: 1111, qty: 1 };
    expect(computeLineAmount(mi, basePriceItem, baseRule)).toBe(123.43);
  });
});
