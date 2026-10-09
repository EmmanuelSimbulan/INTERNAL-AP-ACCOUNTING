import { NextResponse } from "next/server";
import { parseBspDailyUsdPhp } from "@/lib/bsp-fx";

export const dynamic = "force-dynamic";

async function getBspProviderRate() {
  const response = await fetch("https://api.frankfurter.dev/v2/providers/bsp/rate/php/usd", {
    headers: { Accept: "application/json" },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`BSP rate mirror returned HTTP ${response.status}`);
  const value = await response.json() as { date?: string; rate?: number };
  if (!value.date || !Number.isFinite(value.rate) || !value.rate || value.rate <= 0) throw new Error("BSP rate mirror returned an invalid rate");
  // The provider publishes PHP as the base; invert it to retain BSP's USD→PHP quote.
  return { rate: (1 / value.rate!).toFixed(3), effectiveDate: value.date, source: "https://www.bsp.gov.ph/statistics/external/day99_data.aspx" };
}

export async function GET() {
  try {
    let quote;
    try {
      const response = await fetch("https://www.bsp.gov.ph/statistics/external/day99_data.aspx", {
        headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; APWorkflow/1.0)" },
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`BSP returned HTTP ${response.status}`);
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      quote = parseBspDailyUsdPhp(await response.text(), today);
    } catch (error) {
      console.warn("Direct BSP rate page unavailable; trying BSP provider dataset", error);
      quote = await getBspProviderRate();
    }
    if (!quote) throw new Error("No published USD/PHP rate was found on BSP's daily rate page");
    return NextResponse.json({ ...quote, retrievedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("BSP USD/PHP lookup failed", error);
    return NextResponse.json({ error: "The official BSP USD/PHP rate is temporarily unavailable. Please try again before saving this USD request." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
