import { it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { firestoreQuery } from "../src/lib/firestore-diagnostics";
import { dataError } from "../src/lib/errors";
import { activeBumps, featuredListings } from "../src/lib/promotion-readers";
import type { Firestore } from "firebase-admin/firestore";

const catalogue = JSON.parse(readFileSync("firestore.indexes.json", "utf8"));
function covers(collection: string, fields: [string, string][]) {
  expect(
    catalogue.indexes.some(
      (i: {
        collectionGroup: string;
        queryScope: string;
        fields: { fieldPath: string; order: string }[];
      }) =>
        i.collectionGroup === collection &&
        i.queryScope === "COLLECTION" &&
        JSON.stringify(i.fields.map((f) => [f.fieldPath, f.order])) ===
          JSON.stringify(fields),
    ),
  ).toBe(true);
}
it("covers organic latest, category latest, discussions and both promotion bump namespaces", () => {
  const equality: [string, string][] = ["status", "country", "currency"].map(
    (f) => [f, "ASCENDING"],
  );
  covers("listings", [...equality, ["createdAt", "DESCENDING"]]);
  covers("listings", [
    ...equality,
    ["category", "ASCENDING"],
    ["createdAt", "DESCENDING"],
  ]);
  covers("forumThreads", [
    ["status", "ASCENDING"],
    ["lastReplyAt", "DESCENDING"],
  ]);
  for (const suffix of ["Test", "Live"])
    covers(`listingPromotions${suffix}`, [
      ["bumpedAt", "DESCENDING"],
      ["listingId", "DESCENDING"],
    ]);
});
it("preserves actual bump ordering and both-value pagination without rewriting listings", async () => {
  const q = {
    orderBy: vi.fn(),
    startAfter: vi.fn(),
    limit: vi.fn(),
    get: vi.fn().mockResolvedValue({ docs: [], size: 0 }),
  };
  q.orderBy.mockReturnValue(q);
  q.startAfter.mockReturnValue(q);
  q.limit.mockReturnValue(q);
  const db = { collection: vi.fn().mockReturnValue(q) };
  await activeBumps(db as unknown as Firestore, 123, 64, "listing-a");
  expect(q.orderBy.mock.calls).toEqual([
    ["bumpedAt", "desc"],
    ["listingId", "desc"],
  ]);
  expect(q.startAfter).toHaveBeenCalledWith(123, "listing-a");
});
it("featured rotation uses the default ascending single-field featuredActive index and name cursor", async () => {
  const q = {
    where: vi.fn(),
    orderBy: vi.fn(),
    startAt: vi.fn(),
    endBefore: vi.fn(),
    limit: vi.fn(),
    get: vi.fn().mockResolvedValue({ docs: [], size: 0 }),
  };
  for (const method of [q.where, q.orderBy, q.startAt, q.endBefore, q.limit])
    method.mockReturnValue(q);
  await featuredListings({ collection: () => q } as unknown as Firestore);
  expect(q.where).toHaveBeenCalledWith("featuredActive", "==", true);
  expect(
    q.orderBy.mock.calls[0][0].isEqual(
      (await import("firebase-admin/firestore")).FieldPath.documentId(),
    ),
  ).toBe(true);
  expect(q.startAt).toHaveBeenCalledTimes(1);
  expect(q.endBefore).toHaveBeenCalledTimes(1);
  expect(
    catalogue.fieldOverrides.some((f: { collectionGroup: string }) =>
      f.collectionGroup.startsWith("listingPromotions"),
    ),
  ).toBe(false);
});
it("logs provider diagnostics and index URL server-side then rethrows the original failure", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = Object.assign(
    new Error(
      "The query requires an index. https://console.firebase.google.com/example",
    ),
    { code: 9, details: "index details" },
  );
  try {
    await expect(
      firestoreQuery("paid bumps Live", async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(log).toHaveBeenCalledWith("[Firestore] paid bumps Live", {
      code: 9,
      message: error.message,
      details: "index details",
    });
    expect(dataError(error)).not.toContain("https://");
    expect(
      dataError(
        Object.assign(new Error("Database is not available in this mode"), {
          code: 9,
        }),
      ),
    ).not.toContain("index");
  } finally {
    log.mockRestore();
  }
});
