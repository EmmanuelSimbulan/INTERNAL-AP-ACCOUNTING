import { describe, expect, it } from "vitest";
import {
  getPrototypeRequestErrors,
  parsePrototypeAmount,
} from "@/lib/prototype-validation";

describe("prototype request validation", () => {
  it("accepts formatted amounts and concise non-empty particulars", () => {
    expect(parsePrototypeAmount("₱ 1,500.00")).toBe(1500);
    expect(
      getPrototypeRequestErrors("Demo Vendor", "Cash Advance", [
        { project: "IT", particulars: "Taxi", amount: "1,500.00" },
      ]),
    ).toEqual([]);
  });

  it("returns a precise message for every invalid field", () => {
    expect(
      getPrototypeRequestErrors("", "", [
        { project: "", particulars: "", amount: "0" },
      ]),
    ).toEqual([
      "Select or enter a payee.",
      "Select a nature of payment.",
      "Line 1: select a project code.",
      "Line 1: enter particulars.",
      "Line 1: enter an amount greater than zero.",
    ]);
  });
});
