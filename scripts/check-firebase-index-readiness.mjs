// Check a fresh completed read-only cloud backup; performs no cloud mutations.
import fs from "node:fs";
import path from "node:path";
const root = ".tools/cloud-security-backup",
  folder = path.join(
    root,
    fs
      .readdirSync(root)
      .filter((x) => fs.existsSync(path.join(root, x, "COMPLETE.json")))
      .sort()
      .at(-1) || "",
  );
const complete = JSON.parse(
  fs.readFileSync(path.join(folder, "COMPLETE.json"), "utf8"),
);
if (
  complete.project !== "throttlehub-9d6b9" ||
  complete.bucket !== "throttlehub-9d6b9.firebasestorage.app" ||
  !Number.isFinite(Date.parse(complete.exportedAt)) ||
  Date.now() - Date.parse(complete.exportedAt) > 15 * 60 * 1000
)
  throw Error(
    "Run a fresh completed backup for throttlehub-9d6b9 first (maximum age 15 minutes).",
  );
const local = JSON.parse(
    fs.readFileSync("firestore.indexes.json", "utf8"),
  ).indexes,
  cloud = JSON.parse(
    fs.readFileSync(path.join(folder, "firestore-indexes-api.json"), "utf8"),
  );
const key = (x) =>
  JSON.stringify({
    collectionGroup:
      x.collectionGroup ||
      x.name?.split("/collectionGroups/")[1]?.split("/")[0],
    queryScope: x.queryScope,
    fields: x.fields
      .filter((f) => f.fieldPath !== "__name__")
      .map((f) => ({
        fieldPath: f.fieldPath,
        order: f.order || null,
        arrayConfig: f.arrayConfig || null,
      })),
    nameOrder:
      x.fields.find((f) => f.fieldPath === "__name__")?.order ||
      [...x.fields].reverse().find((f) => f.order)?.order ||
      "ASCENDING",
  });
const states = local.map((index) => {
  const found = cloud.find((x) => key(x) === key(index));
  return { index, state: found?.state || "MISSING" };
});
const pending = states.filter((x) => x.state !== "READY");
const overrides =
  JSON.parse(fs.readFileSync("firestore.indexes.json", "utf8"))
    .fieldOverrides || [];
const fieldFile = path.join(folder, "firestore-field-configs-api.json");
const cloudFields = fs.existsSync(fieldFile)
  ? JSON.parse(fs.readFileSync(fieldFile, "utf8"))
  : [];
const fieldStates = overrides.flatMap((field) =>
  (field.indexes || []).map((index) => {
    const config = cloudFields.find(
      (x) =>
        x.collectionGroup === field.collectionGroup &&
        x.fieldPath === field.fieldPath,
    )?.configuration;
    const found = config?.indexConfig?.indexes?.find(
      (x) =>
        x.queryScope === index.queryScope &&
        x.fields?.some(
          (f) => f.fieldPath === field.fieldPath && f.order === index.order,
        ),
    );
    return {
      collectionGroup: field.collectionGroup,
      fieldPath: field.fieldPath,
      ...index,
      state: found?.state || "MISSING_OR_UNVERIFIED",
    };
  }),
);
const pendingFields = fieldStates.filter((x) => x.state !== "READY");
console.log(
  JSON.stringify(
    {
      project: complete.project,
      backup: folder,
      required: local.length,
      ready: states.length - pending.length,
      missingOrNotReady: pending.length,
      unmanagedCloudIndexes: cloud.filter(
        (x) => !local.some((l) => key(l) === key(x)),
      ).length,
      pending,
      fieldIndexChecks: fieldStates,
      missingOrNotReadyFieldIndexes: pendingFields.length,
    },
    null,
    2,
  ),
);
if (pending.length || pendingFields.length) process.exitCode = 1;
