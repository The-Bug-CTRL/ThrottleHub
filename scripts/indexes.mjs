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
// Public stolen queries always include country; old country-less filter indexes had no callers.
for (const field of ["country"])
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
// The directory can combine all five filters; the emulator does not enforce indexes.
const stolenFilters = ["make", "model", "year", "region", "city"];
for (let mask = 0; mask < 1 << stolenFilters.length; mask++) {
  const selected = stolenFilters.filter((_, bit) => mask & (1 << bit));
  if (selected.length >= 2)
    add("stolenReports", ["status", "country", ...selected], "createdAt");
}
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
// Trusted maintenance scans private nested video records; clients have no group-query permission.
indexes.push({
  collectionGroup: "videos",
  queryScope: "COLLECTION_GROUP",
  fields: [
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "createdAt", order: "ASCENDING" },
  ],
});
// Trusted photo orphan scan, sharing the video's status/date pagination contract.
indexes.push({
  collectionGroup: "photos",
  queryScope: "COLLECTION_GROUP",
  fields: [
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "createdAt", order: "ASCENDING" },
  ],
});
fs.writeFileSync(
  "firestore.indexes.json",
  JSON.stringify(
    {
      indexes,
      fieldOverrides: [
        {
          collectionGroup: "favourites",
          fieldPath: "listingId",
          indexes: [
            { order: "ASCENDING", queryScope: "COLLECTION" },
            { order: "DESCENDING", queryScope: "COLLECTION" },
            { order: "ASCENDING", queryScope: "COLLECTION_GROUP" },
          ],
        },
      ],
    },
    null,
    2,
  ),
);
