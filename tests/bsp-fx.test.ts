import { describe, expect, it } from "vitest";
import { normalizeBspUsdPhpRate, signBspUsdPhpRate, verifyBspUsdPhpRate } from "@/lib/bsp-fx";

describe("parseBspDailyUsdPhp", () => {
  it("inverts the PHP-base BSP quote to a four-decimal PHP-per-USD rate", () => {
    expect(normalizeBspUsdPhpRate(1 / 62.893)).toBe("62.8930");
  });

  it("rejects invalid reciprocal rates", () => {
    expect(() => normalizeBspUsdPhpRate(0)).toThrow("Invalid BSP USD/PHP rate");
  });

  it("signs a quote so the state API can reject altered rates", () => {
    const previousSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "test-secret-for-bsp-signatures";
    try {
      const signed = signBspUsdPhpRate({ rate: "62.766", effectiveDate: "2026-10-09", source: "https://www.bsp.gov.ph/statistics/external/day99_data.aspx", retrievedAt: "2026-10-09T00:00:00.000Z" });
      expect(verifyBspUsdPhpRate(signed)).toBe(true);
      expect(verifyBspUsdPhpRate({ ...signed, rate: "60.000" })).toBe(false);
    } finally {
      if (previousSecret === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = previousSecret;
    }
  });
});
