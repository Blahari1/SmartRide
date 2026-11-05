// Dependency-free sanity check for the frontend source (works without node_modules):
// every relative import resolves, and every named import is exported by its target file.
// It does not replace `npm run build` / `npm run lint`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(jsx?|mjs)$/.test(e.name)) files.push(p); } })(root);

const resolve = (from, spec) => {
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, `${base}.js`, `${base}.jsx`, path.join(base, "index.js"), path.join(base, "index.jsx")]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
};
const exportsOf = (file) => {
  const src = fs.readFileSync(file, "utf8");
  const names = new Set(); let hasDefault = false;
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+(\w+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(",").forEach((x) => { const n = x.trim().split(/\s+as\s+/).pop(); if (n) names.add(n); });
  if (/export\s+default\b/.test(src)) hasDefault = true;
  return { names, hasDefault };
};

const problems = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const rel = path.relative(root, f);
  for (const m of src.matchAll(/import\s+([^"';]*?)\s+from\s+["'](\.[^"']+)["']/g)) {
    const target = resolve(f, m[2]);
    if (!target) { problems.push(`${rel}: cannot resolve "${m[2]}"`); continue; }
    if (!/\.jsx?$/.test(target)) continue;
    const { names, hasDefault } = exportsOf(target);
    const clause = m[1];
    const named = /\{([^}]*)\}/.exec(clause);
    const def = clause.replace(/\{[^}]*\}/, "").replace(/\*\s+as\s+\w+/, "").replace(/,/g, "").trim();
    if (def && !hasDefault) problems.push(`${rel}: "${m[2]}" has no default export`);
    if (named) for (const n of named[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (!names.has(n)) problems.push(`${rel}: "${n}" is not exported by "${m[2]}"`);
  }
  for (const m of src.matchAll(/import\s+["'](\.[^"']+)["']/g)) if (!resolve(f, m[1])) problems.push(`${rel}: cannot resolve side-effect import "${m[1]}"`);
}
if (problems.length) { console.error(problems.join("\n")); console.error(`\n${problems.length} problem(s) in ${files.length} files`); process.exit(1); }
console.log(`frontend import check passed: ${files.length} files`);
