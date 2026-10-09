import { createHmac, timingSafeEqual } from "node:crypto";

export type BspUsdPhpRate = {
  rate: string;
  effectiveDate: string;
  source: string;
};

export type SignedBspUsdPhpRate = BspUsdPhpRate & { retrievedAt: string; signature: string };

export function normalizeBspUsdPhpRate(phpPerUsdReciprocal: number) {
  if (!Number.isFinite(phpPerUsdReciprocal) || phpPerUsdReciprocal <= 0) throw new Error("Invalid BSP USD/PHP rate");
  return (1 / phpPerUsdReciprocal).toFixed(4);
}

function signaturePayload(quote: BspUsdPhpRate & { retrievedAt: string }) {
  return JSON.stringify([quote.rate, quote.effectiveDate, quote.source, quote.retrievedAt]);
}

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to sign BSP rates");
  return secret;
}

export function signBspUsdPhpRate(quote: BspUsdPhpRate & { retrievedAt: string }): SignedBspUsdPhpRate {
  const signature = createHmac("sha256", authSecret()).update(signaturePayload(quote)).digest("hex");
  return { ...quote, signature };
}

export function verifyBspUsdPhpRate(quote: SignedBspUsdPhpRate) {
  try {
    const expected = createHmac("sha256", authSecret()).update(signaturePayload(quote)).digest();
    const actual = Buffer.from(quote.signature, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
