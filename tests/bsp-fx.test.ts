import { describe, expect, it } from "vitest";
import { parseBspDailyUsdPhp, signBspUsdPhpRate, verifyBspUsdPhpRate } from "@/lib/bsp-fx";

describe("parseBspDailyUsdPhp", () => {
  it("returns the latest published BSP rate not later than today", () => {
    const html = `<table>
      <tr><th>Date</th><th>Sep-26</th><th>Oct-26</th></tr>
      <tr><td>8</td><td>62.698</td><td>62.766</td></tr>
      <tr><td>9</td><td>62.568</td><td></td></tr>
    </table>`;
    expect(parseBspDailyUsdPhp(html, "2026-10-09")).toMatchObject({
      rate: "62.766",
      effectiveDate: "2026-10-08",
      source: "https://www.bsp.gov.ph/statistics/external/day99_data.aspx",
    });
    expect(parseBspDailyUsdPhp(html, "2026-10-07")?.effectiveDate).toBe("2026-09-09");
  });

  it("returns null for a page without rate data", () => {
    expect(parseBspDailyUsdPhp("<html>unavailable</html>", "2026-10-09")).toBeNull();
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
