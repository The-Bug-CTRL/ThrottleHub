import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
it("covers every combination of the actual stolen directory equality filters", () => {
  const { indexes } = JSON.parse(
    readFileSync("firestore.indexes.json", "utf8"),
  );
  const fields = ["make", "model", "year", "region", "city"];
  for (let mask = 0; mask < 32; mask++) {
    const expected = [
      "status",
      "country",
      ...fields.filter((_, bit) => mask & (1 << bit)),
      "createdAt",
    ];
    expect(
      indexes.some(
        (index: {
          collectionGroup: string;
          fields: { fieldPath: string; order: string }[];
        }) =>
          index.collectionGroup === "stolenReports" &&
          JSON.stringify(index.fields.map((f) => f.fieldPath)) ===
            JSON.stringify(expected) &&
          index.fields.at(-1)?.order === "DESCENDING",
      ),
    ).toBe(true);
  }
});
it("prepares the group field index required for private favourite aggregation", () => {
  const { fieldOverrides } = JSON.parse(
    readFileSync("firestore.indexes.json", "utf8"),
  );
  expect(
    fieldOverrides.some(
      (f: {
        collectionGroup: string;
        fieldPath: string;
        indexes: { order: string; queryScope: string }[];
      }) =>
        f.collectionGroup === "favourites" &&
        f.fieldPath === "listingId" &&
        f.indexes.some(
          (i) => i.order === "ASCENDING" && i.queryScope === "COLLECTION_GROUP",
        ),
    ),
  ).toBe(true);
});
