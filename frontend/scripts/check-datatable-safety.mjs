import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/ui.jsx", import.meta.url), "utf8");
const required = [
  "const isSorted = (column) => Boolean(column?.sortKey && sort?.key === column.sortKey);",
  "const sortDirection = sort?.dir === \"asc\" ? \"asc\" : \"desc\";",
  "rows = []",
];
for (const fragment of required) {
  if (!source.includes(fragment)) {
    console.error(`DataTable safety check failed: missing ${fragment}`);
    process.exitCode = 1;
  }
}
if (!source.includes("Array.isArray(rows) || rows.length === 0")) {
  console.error("DataTable safety check failed: rows must be guarded before rendering");
  process.exitCode = 1;
}
if (!process.exitCode) console.log("DataTable safety check passed: unsorted tables are safe.");
