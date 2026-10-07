export type AccountProjectMap = Record<string, string[]>;

export function accountIsApplicable(
  project: string,
  account: string,
  mapping: AccountProjectMap | undefined,
  legacyDefault = false,
) {
  if (!account) return true;
  if (!mapping) return legacyDefault;
  const normalizedAccount = account.trim().toLocaleLowerCase();
  const normalizedProject = project.trim().toLocaleLowerCase();
  const assignedProjects = mapping[account] ?? Object.entries(mapping).find(([name]) => name.trim().toLocaleLowerCase() === normalizedAccount)?.[1];
  return assignedProjects?.some((assignedProject) => assignedProject.trim().toLocaleLowerCase() === normalizedProject) ?? false;
}

export function getApplicableAccounts(
  project: string,
  accounts: string[],
  mapping: AccountProjectMap | undefined,
) {
  return accounts.filter((account) => accountIsApplicable(project, account, mapping));
}
