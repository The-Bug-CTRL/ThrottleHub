import fs from "node:fs";
import ts from "typescript";
const catalogue = JSON.parse(
  fs.readFileSync("src/lib/category-catalogue.json", "utf8"),
);
const cats = catalogue.filter(
  (c) =>
    c.isActive &&
    c.ancestorIds.every((id) => catalogue.find((p) => p.id === id)?.isActive),
);
const compiled = { exports: {} };
new Function(
  "exports",
  ts.transpileModule(fs.readFileSync("src/lib/marketplace.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(compiled.exports);
const { motorcycleCatalogue, provinces } = compiled.exports;
const literal = (value) => JSON.stringify(value).replaceAll('"', "'");
let generated =
  "  // BEGIN GENERATED MARKETPLACE CATEGORIES — run node scripts/marketplace-rules.mjs\n";
const roots = cats.filter((c) => !c.parentId);
const buckets = [...new Set(cats.map((c) => c.parentId || ""))];
for (const [i, parent] of buckets.entries()) {
  generated += `  function categoryBucket${i}(id){return \n`;
  generated +=
    cats
      .filter((c) => (c.parentId || "") === parent)
      .map((c) => {
        const path = [...c.ancestorIds, c.id];
        const root = cats.find((r) => r.id === path[0]);
        return `   id == '${c.id}' ? ${literal([root.name, c.name, c.ancestorIds, Object.fromEntries(path.map((id, j) => ["l" + j, id])), c.engineTypes || []])} : `;
      })
      .join("\n") + " [];}\n";
}
for (const [r, root] of roots.entries()) {
  const parents = buckets.filter(
    (p) => p === root.id || p.startsWith(root.id + "/"),
  );
  generated += `  function rootRecord${r}(d,p){return ${parents.map((p) => `p == '${p}' ? categoryBucket${buckets.indexOf(p)}(d.categoryId) : `).join("")} []; }\n`;
}
generated += `  function categoryRecord(d){let p=d.categoryAncestorIds.size()>0 ? d.categoryAncestorIds[d.categoryAncestorIds.size()-1] : '';return p == '' ? categoryBucket0(d.categoryId) : ${roots.map((r, i) => `d.primaryCategoryId == '${r.id}' ? rootRecord${i}(d,p) : `).join("")} [];}
`;
generated += `
  function validCategory(d){let c=categoryRecord(d);return c.size() == 5 && d.primaryCategoryId == d.categoryPath.l0 && d.category == c[0] && d.subcategory == c[1] && d.categoryAncestorIds == c[2] && d.categoryPath == c[3] && (c[4].size() == 0 || d.details.engineType == '' || d.details.engineType in c[4]);}
  function validMake(d){return (d.make == '' && d.model == '') || (d.make in ${literal(Object.keys(motorcycleCatalogue))} && (d.model == '' || d.model in (${Object.entries(
    motorcycleCatalogue,
  )
    .map(([make, models]) => `d.make == '${make}' ? ${literal(models)} : `)
    .join("")} [])));}
  function validProvince(region){return region in ${literal(Object.keys(provinces))};}
  // END GENERATED MARKETPLACE CATEGORIES\n`;
let rules = fs.readFileSync("firestore.rules", "utf8");
rules = rules.replace(
  /  \/\/ BEGIN GENERATED MARKETPLACE CATEGORIES[\s\S]*?  \/\/ END GENERATED MARKETPLACE CATEGORIES\n/,
  "",
);
rules = rules.replace(
  "  function validListing",
  generated + "  function validListing",
);
// Saved criteria use the same keys as the public search contract.
const source = ts.createSourceFile(
  "search-contract.ts",
  fs.readFileSync("src/lib/search-contract.ts", "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const declaration = source.statements
  .filter(ts.isVariableStatement)
  .flatMap((s) => s.declarationList.declarations)
  .find((d) => d.name.getText(source) === "defaultFilters");
const keys = declaration.initializer.properties.map((p) =>
  p.name.getText(source).replaceAll('"', ""),
);
const saved =
  "  function validSaved(d){let f=d.filters;return d.keys().hasOnly(['name','filters','createdAt','notificationsEnabled','version']) && shortText(d.name,160) && d.name.size() > 0 && d.createdAt is number && d.version == 2 && d.notificationsEnabled == false && f is map && f.keys().hasOnly(" +
  literal(keys) +
  ") && " +
  keys.map((k) => "shortText(f." + k + ",100)").join(" && ") +
  " && f.country == 'ZA' && (f.category == '' || f.category in " +
  literal(cats.map((c) => c.id)) +
  ");}\n";
rules = rules.replace(/  function validSaved\(d\)\{[^\n]+\}\n/, saved);
fs.writeFileSync("firestore.rules", rules);
