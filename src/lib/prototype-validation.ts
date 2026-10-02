export type PrototypeLineInput = {
  project: string;
  particulars: string;
  amount: string;
};

export function parsePrototypeAmount(value: string): number {
  const normalized = value.replace(/[\s,₱$]/g, "").trim();
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

export function getPrototypeRequestErrors(
  payee: string,
  nature: string,
  lines: PrototypeLineInput[],
): string[] {
  const errors: string[] = [];
  if (!payee.trim()) errors.push("Select or enter a payee.");
  if (!nature.trim()) errors.push("Select a nature of payment.");
  if (!lines.length) errors.push("Add at least one request line.");

  lines.forEach((line, index) => {
    const label = `Line ${index + 1}`;
    if (!line.project.trim()) errors.push(`${label}: select a project code.`);
    if (!line.particulars.trim()) errors.push(`${label}: enter particulars.`);
    const amount = parsePrototypeAmount(line.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`${label}: enter an amount greater than zero.`);
    }
  });

  return errors;
}
