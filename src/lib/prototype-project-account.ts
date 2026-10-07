export type AccountProjectMap = Record<string, string[]>;

export function accountIsApplicable(
  project: string,
  account: string,
  mapping: AccountProjectMap | undefined,
  legacyDefault = false,
) {
  if (!account) return true;
  if (!mapping) return legacyDefault;
  return mapping[account]?.includes(project) ?? false;
}

export function getApplicableAccounts(
  project: string,
  accounts: string[],
  mapping: AccountProjectMap | undefined,
) {
  return accounts.filter((account) => accountIsApplicable(project, account, mapping));
}
