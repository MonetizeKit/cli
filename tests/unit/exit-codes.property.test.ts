import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ExitCode, mapHttpStatusToExitCode } from "../../src/lib/exit-codes.js";

describe("exit-codes property tests", () => {
  // Feature: monetizekit-cli, Property 4: Exit code mapping from HTTP status
  it("maps known and class-based HTTP statuses to defined exit codes", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(401, 403, 404, 409, 422, 429),
          fc.integer({ min: 200, max: 299 }),
          fc.integer({ min: 500, max: 599 }),
          fc.integer({ min: 100, max: 699 }),
        ),
        (status) => {
          const mapped = mapHttpStatusToExitCode(status);

          if (status >= 200 && status < 300) {
            expect(mapped).toBe(ExitCode.Success);
            return;
          }

          if (status >= 500 && status < 600) {
            expect(mapped).toBe(ExitCode.NetworkError);
            return;
          }

          switch (status) {
            case 401:
              expect(mapped).toBe(ExitCode.AuthFailure);
              return;
            case 403:
              expect(mapped).toBe(ExitCode.PermissionDenied);
              return;
            case 404:
              expect(mapped).toBe(ExitCode.NotFound);
              return;
            case 409:
              expect(mapped).toBe(ExitCode.Conflict);
              return;
            case 422:
              expect(mapped).toBe(ExitCode.ValidationFailed);
              return;
            case 429:
              expect(mapped).toBe(ExitCode.RateLimited);
              return;
            default:
              expect(mapped).toBe(ExitCode.UnknownError);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
