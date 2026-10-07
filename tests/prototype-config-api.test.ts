import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/prototype/configuration/route";

describe("prototype configuration API permissions", () => {
  it("denies exports to non-administrator profiles on the backend", async () => {
    const response = await GET(new Request("http://localhost/api/prototype/configuration?type=projects&profileId=alex-requester"));
    expect(response.status).toBe(403);
  });

  it("denies imports to non-administrator profiles on the backend", async () => {
    const response = await POST(new Request("http://localhost/api/prototype/configuration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: "taylor-reviewer", type: "payees", action: "preview", csv: "Payee/Vendor,Currency\nVendor,USD" }),
    }));
    expect(response.status).toBe(403);
  });
});
