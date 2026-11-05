// Login e-mail lookup: the admin script stores the e-mail exactly as typed (lower-cased); self-registration stores the
// normalizeEmail() form. Both must be searched or an admin with a dotted Gmail address can never log in.
const assert = require("assert");
const { emailCandidates } = require("../src/utils/email");
let ok = 0;
const t = (n, f) => { f(); ok++; console.log("  ok   ", n); };
t("typed form is always a candidate, trimmed and lower-cased", () => {
  assert.ok(emailCandidates("  First.Last+Admin@Gmail.com ").includes("first.last+admin@gmail.com"));
});
t("plain addresses give exactly one candidate", () => {
  assert.deepStrictEqual(emailCandidates("admin@smartride.local"), ["admin@smartride.local"]);
});
t("garbage input does not throw", () => { assert.ok(Array.isArray(emailCandidates(undefined))); assert.ok(Array.isArray(emailCandidates(""))); });
console.log(`\n${ok} passed, 0 failed`);
