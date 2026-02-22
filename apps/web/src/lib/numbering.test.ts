import { describe, it, expect } from "vitest";
import { isValidOrderNumber, isValidQuoteNumber } from "./numbering";

describe("numbering", () => {
  describe("isValidOrderNumber", () => {
    it("accepts ORD-000001", () => {
      expect(isValidOrderNumber("ORD-000001")).toBe(true);
    });
    it("accepts ORD-999999", () => {
      expect(isValidOrderNumber("ORD-999999")).toBe(true);
    });
    it("rejects invalid formats", () => {
      expect(isValidOrderNumber("ORD-1")).toBe(false);
      expect(isValidOrderNumber("ORD-0000001")).toBe(false);
      expect(isValidOrderNumber("ord-000001")).toBe(false);
      expect(isValidOrderNumber("")).toBe(false);
      expect(isValidOrderNumber(null)).toBe(false);
      expect(isValidOrderNumber(undefined)).toBe(false);
    });
  });

  describe("isValidQuoteNumber", () => {
    it("accepts Q-000001", () => {
      expect(isValidQuoteNumber("Q-000001")).toBe(true);
    });
    it("accepts Q-999999", () => {
      expect(isValidQuoteNumber("Q-999999")).toBe(true);
    });
    it("rejects invalid formats", () => {
      expect(isValidQuoteNumber("Q-1")).toBe(false);
      expect(isValidQuoteNumber("Q-0000001")).toBe(false);
      expect(isValidQuoteNumber("q-000001")).toBe(false);
      expect(isValidQuoteNumber(null)).toBe(false);
    });
  });
});
