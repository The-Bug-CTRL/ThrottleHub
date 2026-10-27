import { it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
it("uses only the canonical normal-operation Rules, with no retired overlay or membership dependency", () => {
  const config = JSON.parse(readFileSync("firebase.json", "utf8"));
  expect(config.firestore.rules).toBe("firestore.rules");
  expect(config.storage.rules).toBe("storage.rules");
  for (const file of ["firestore.rules", "storage.rules"]) {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(
      /privateTester|privateTesters|THROTTLEHUB_PRIVATE_TESTING/,
    );
    expect(source).toMatch(/allow read,\s*write:\s*if false/);
  }
  expect(existsSync("firebase.private.json")).toBe(false);
  expect(existsSync("src/lib/private-testing.ts")).toBe(false);
  expect(existsSync("scripts/prepare-private-firebase.mjs")).toBe(false);
});
