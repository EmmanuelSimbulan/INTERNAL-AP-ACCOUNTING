import { describe, expect, it } from "vitest";
import { PATCH } from "@/app/api/prototype/requests/bulk/route";

function request(profileId: string, fields: Record<string, string> = { company: "SVI" }) {
  return new Request("http://localhost/api/prototype/requests/bulk", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, requestIds: ["request-1"], fields, reason: "Correcting request details" }),
  });
}

describe("prototype bulk request edit API permissions", () => {
  it.each(["alex-requester", "jordan-approver", "riley-auditor"])("denies bulk edits for unauthorized profile %s", async (profileId) => {
    const response = await PATCH(request(profileId));
    expect(response.status).toBe(403);
  });

  it("rejects empty edits before accessing saved request data", async () => {
    const response = await PATCH(request("casey-ap", {}));
    expect(response.status).toBe(400);
  });

  it("requires a documented reason before editing requests", async () => {
    const response = await PATCH(new Request("http://localhost/api/prototype/requests/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: "avery-admin", requestIds: ["request-1"], fields: { company: "SVI" }, reason: " " }),
    }));
    expect(response.status).toBe(400);
  });
});
