import { describe, expect, it } from "vitest";
import { accountIsApplicable, getApplicableAccounts } from "@/lib/prototype-project-account";

describe("account and Project Code configuration", () => {
  it("supports the configured many-to-many relationship", () => {
    const mapping = { Transportation: ["Dealership", "Corporate"], Software: ["IT", "Corporate"] };
    expect(accountIsApplicable("Dealership", "Transportation", mapping)).toBe(true);
    expect(accountIsApplicable("Dealership", "Software", mapping)).toBe(false);
    expect(getApplicableAccounts("Corporate", ["Transportation", "Software"], mapping)).toEqual(["Transportation", "Software"]);
  });

  it("allows historical workspaces to retain their prior unrestricted behavior", () => {
    expect(accountIsApplicable("Dealership", "Old Account", undefined, true)).toBe(true);
    expect(accountIsApplicable("Dealership", "New Account", {})).toBe(false);
  });
});
