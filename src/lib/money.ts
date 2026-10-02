import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function money(value: string | number | Decimal) {
  return new Decimal(value);
}

export function sumAmounts(values: Array<string | number | Decimal>): string {
  return values.reduce<Decimal>((total, value) => total.plus(value), new Decimal(0)).toFixed(4);
}

export function formatMoney(value: string | number | Decimal, currency: string, precision = 2): string {
  const amount = new Decimal(value).toDecimalPlaces(precision);
  return new Intl.NumberFormat("en-PH", { style: "currency", currency, minimumFractionDigits: precision }).format(amount.toNumber());
}

export function assertTotal(lineAmounts: string[], persistedTotal: string) {
  const calculated = new Decimal(sumAmounts(lineAmounts));
  if (!calculated.equals(new Decimal(persistedTotal))) throw new Error("Persisted total does not match request lines");
  return calculated.toFixed(4);
}
