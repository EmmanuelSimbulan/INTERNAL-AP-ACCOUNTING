import { NextResponse } from "next/server";
import { normalizeBspUsdPhpRate, signBspUsdPhpRate } from "@/lib/bsp-fx";

export const dynamic = "force-dynamic";

async function getBspProviderRate() {
  const response = await fetch("https://api.frankfurter.dev/v2/providers/bsp/rate/php/usd", {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`BSP rate mirror returned HTTP ${response.status}`);
  const value = await response.json() as { date?: string; rate?: number };
  if (!value.date || !Number.isFinite(value.rate) || !value.rate || value.rate <= 0) throw new Error("BSP reference-rate feed returned an invalid rate");
  // Query the BSP provider with PHP as base; invert its PHP/USD quote to USD/PHP.
  return { rate: normalizeBspUsdPhpRate(value.rate), effectiveDate: value.date, source: "https://www.bsp.gov.ph/SitePages/Statistics/DailyRERB.aspx" };
}

export async function GET() {
  try {
    const quote = await getBspProviderRate();
    return NextResponse.json(signBspUsdPhpRate({ ...quote, retrievedAt: new Date().toISOString() }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("BSP USD/PHP lookup failed", error);
    return NextResponse.json({ error: "The official BSP USD/PHP rate is temporarily unavailable. Please try again before saving this USD request." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
