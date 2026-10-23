import fs from "node:fs";
const indexes = [];
function add(
  collectionGroup,
  equalities,
  sort,
  direction = "DESCENDING",
  search = false,
) {
  indexes.push({
    collectionGroup,
    queryScope: "COLLECTION",
    fields: [
      ...equalities.map((fieldPath) => ({ fieldPath, order: "ASCENDING" })),
      ...(search
        ? [{ fieldPath: "searchTokens", arrayConfig: "CONTAINS" }]
        : []),
      { fieldPath: sort, order: direction },
    ],
  });
}
for (const sort of ["createdAt", "price"])
  for (const direction of ["ASCENDING", "DESCENDING"])
    for (const level of [-1, 0, 1, 2, 3])
      for (const search of [false, true])
        add(
          "listings",
          [
            "status",
            "country",
            "currency",
            ...(level >= 0 ? ["categoryPath.l" + level] : []),
          ],
          sort,
          direction,
          search,
        );
add("listings", ["status", "country", "currency", "category"], "createdAt");
add("listings", ["status", "country", "currency", "ownerId"], "createdAt");
for (const sort of ["createdAt", "lastReplyAt"])
  for (const category of [false, true])
    for (const search of [false, true])
      add(
        "forumThreads",
        ["status", ...(category ? ["category"] : [])],
        sort,
        "DESCENDING",
        search,
      );
add("forumThreads", ["ownerId", "status"], "createdAt");
add("replies", ["status"], "createdAt", "ASCENDING");
for (const category of [false, true])
  for (const search of [false, true])
    add(
      "newsArticles",
      ["status", ...(category ? ["category"] : [])],
      "publishedAt",
      "DESCENDING",
      search,
    );
for (const field of ["country", "make", "model", "year", "region", "city"])
  add("stolenReports", ["status", field], "createdAt");
for (const field of ["make", "model", "year", "region", "city", "searchTokens"])
  add(
    "stolenReports",
    ["status", "country", ...(field === "searchTokens" ? [] : [field])],
    "createdAt",
    "DESCENDING",
    field === "searchTokens",
  );
add("stolenReports", ["status"], "createdAt");
add("stolenReports", ["ownerId"], "createdAt");
for (const hasType of [false, true])
  for (const direction of ["ASCENDING", "DESCENDING"])
    add(
      "events",
      ["status", "country", ...(hasType ? ["type"] : [])],
      "endsAt",
      direction,
    );
add("events", ["status"], "startsAt", "ASCENDING");
// Province filtering narrows indexed candidates before bounded refinements.
for (const index of [...indexes].filter(
  (index) =>
    index.collectionGroup === "listings" &&
    !index.fields.some((field) =>
      ["category", "ownerId"].includes(field.fieldPath),
    ),
)) {
  indexes.push({
    ...index,
    fields: [
      ...index.fields.slice(0, 3),
      { fieldPath: "region", order: "ASCENDING" },
      ...index.fields.slice(3),
    ],
  });
}
// Member reviews: public pages, histogram counts and private interaction lookup.
indexes.push(
  {
    collectionGroup: "reviews",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "status", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
      { fieldPath: "__name__", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "reviews",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "status", order: "ASCENDING" },
      { fieldPath: "rating", order: "ASCENDING" },
    ],
  },
  ...["buyerId", "sellerId"].map((field) => ({
    collectionGroup: "conversations",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "participants", arrayConfig: "CONTAINS" },
      { fieldPath: field, order: "ASCENDING" },
    ],
  })),
);
// Community directory and activity notification queries.
for (const region of [false, true])
  for (const category of [false, true])
    add(
      "directoryPosts",
      [
        "status",
        "country",
        "kind",
        ...(region ? ["region"] : []),
        ...(category ? ["category"] : []),
      ],
      "createdAt",
    );
add("directoryPosts", ["ownerId"], "createdAt");
add("directoryPosts", ["status"], "createdAt");
add("messages", ["senderId"], "createdAt");
add("forumThreads", ["ownerId", "status"], "lastReplyAt");
indexes.push({
  collectionGroup: "conversations",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "participants", arrayConfig: "CONTAINS" },
    { fieldPath: "createdAt", order: "DESCENDING" },
  ],
});
indexes.push({
  collectionGroup: "directoryPosts",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "country", order: "ASCENDING" },
    { fieldPath: "__name__", order: "ASCENDING" },
  ],
});
// Public detail lookups filter before reading, including in development render traces.
for (const [collectionGroup, equalities] of [
  ["listings", ["status", "country", "currency"]],
  ["stolenReports", ["status", "country"]],
  ["events", ["status", "country"]],
])
  indexes.push({
    collectionGroup,
    queryScope: "COLLECTION",
    fields: [
      ...equalities.map((fieldPath) => ({ fieldPath, order: "ASCENDING" })),
      { fieldPath: "__name__", order: "ASCENDING" },
    ],
  });
add("replies", ["status"], "createdAt", "DESCENDING");
fs.writeFileSync(
  "firestore.indexes.json",
  JSON.stringify({ indexes, fieldOverrides: [] }, null, 2),
);
