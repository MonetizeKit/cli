import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { formatRemediationMessage } from "../../src/lib/base-command.js";

describe("error remediation property tests", () => {
  // Feature: monetizekit-cli, Property 8: Error remediation messages
  it("returns auth and permission remediation guidance for 401 and 403 statuses", () => {
    const requiredPermissionArb = fc.stringMatching(/^[a-z:_-]{3,64}$/);

    fc.assert(
      fc.property(requiredPermissionArb, (requiredPermission) => {
        const authMessage = formatRemediationMessage(401);
        expect(authMessage).toContain("monetizekit auth login");
        expect(authMessage).toContain("monetizekit auth status");

        const permissionMessage = formatRemediationMessage(403, requiredPermission);
        expect(permissionMessage).toContain(requiredPermission);
        expect(permissionMessage.toLowerCase()).toContain("request access");
      }),
      { numRuns: 100 },
    );
  });
});
