import { it, expect } from "vitest";
import { supportDiagnostic } from "../src/lib/support-diagnostics";
it("distinguishes preconditions from indexes and removes credentials/customer error data", () => {
  expect(
    supportDiagnostic("list", {
      code: 9,
      message: "bad precondition secret-user-token",
    }),
  ).toEqual({ stage: "list", code: 9, kind: "backend-error" });
  expect(
    supportDiagnostic("list", {
      code: 9,
      message:
        "query requires an index https://console.firebase.google.com/project/throttlehub-9d6b9/firestore/indexes?create_composite=abc private@email.test",
    }),
  ).toMatchObject({
    kind: "index-required-or-building",
    indexUrl:
      "https://console.firebase.google.com/project/throttlehub-9d6b9/firestore/indexes?create_composite=abc",
  });
  expect(
    JSON.stringify(
      supportDiagnostic("init", {
        message: "Could not load default credentials SECRET",
      }),
    ),
  ).not.toContain("SECRET");
});
