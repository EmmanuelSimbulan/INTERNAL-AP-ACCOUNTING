import { describe, expect, it } from "vitest";
import { assertTotal, sumAmounts } from "@/lib/money";
describe("decimal-safe money", () => { it("sums without floating point drift", () => expect(sumAmounts(["0.10","0.20","1000.1234"])).toBe("1000.4234")); it("rejects a persisted total mismatch", () => expect(() => assertTotal(["10.00","5.00"],"14.99")).toThrow(/does not match/)); });
