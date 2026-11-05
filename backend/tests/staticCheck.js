// Dependency-free static checks (no npm install needed): syntax of every backend file, that every relative require()
// resolves, and that every destructured name is really exported by the target module.
// This is a sanity net, not a substitute for running the server.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.name === "node_modules") continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p); else if (p.endsWith(".js")) files.push(p);
  }
})(root);

const problems = [];
const exportsOf = (file) => {
  const src = fs.readFileSync(file, "utf8");
  const names = new Set();
  const block = /module\.exports\s*=\s*\{([\s\S]*?)\};?\s*$/m.exec(src.slice(src.lastIndexOf("module.exports")));
  if (block) block[1].split(",").forEach((x) => { const n = x.split(":")[0].trim().replace(/^\.\.\./, ""); if (n) names.add(n); });
  for (const m of src.matchAll(/module\.exports\.(\w+)\s*=/g)) names.add(m[1]);
  for (const m of src.matchAll(/^exports\.(\w+)\s*=/gm)) names.add(m[1]);
  const whole = /module\.exports\s*=\s*(?!\{)([\w.]+)/.exec(src);
  return { names, whole: !!whole };
};
const resolve = (from, req) => {
  const base = path.resolve(path.dirname(from), req);
  for (const c of [base, base + ".js", path.join(base, "index.js")]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
};

for (const f of files) {
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { problems.push(`${path.relative(root, f)}: syntax error\n${e.stderr}`); continue; }
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/(?:const|let|var)\s+(\{[^}]*\}|\w+)\s*=\s*require\(\s*["'](\.[^"']+)["']\s*\)/g)) {
    const target = resolve(f, m[2]);
    if (!target) { problems.push(`${path.relative(root, f)}: cannot resolve ${m[2]}`); continue; }
    if (m[1].startsWith("{")) {
      const { names, whole } = exportsOf(target);
      if (whole) continue;
      for (const n of m[1].slice(1, -1).split(",").map((x) => x.split(":")[0].trim()).filter(Boolean)) {
        if (!names.has(n)) problems.push(`${path.relative(root, f)}: "${n}" is not exported by ${m[2]}`);
      }
    }
  }
  // controller functions referenced by routes (c.name) must exist
  if (f.includes(`${path.sep}routes${path.sep}`)) {
    for (const m of src.matchAll(/const\s+(\w+)\s*=\s*require\(\s*["']\.\.\/controllers\/(\w+)["']\s*\)/g)) {
      const { names } = exportsOf(path.join(root, "src", "controllers", m[2] + ".js"));
      for (const u of src.matchAll(new RegExp(`\\b${m[1]}\\.(\\w+)`, "g"))) if (!names.has(u[1])) problems.push(`${path.relative(root, f)}: ${m[1]}.${u[1]} missing in controllers/${m[2]}`);
    }
  }
}
if (problems.length) { console.error(problems.join("\n")); console.error(`\n${problems.length} problem(s) in ${files.length} files`); process.exit(1); }
console.log(`static check passed: ${files.length} backend files (syntax, relative requires, named imports, route handlers)`);
