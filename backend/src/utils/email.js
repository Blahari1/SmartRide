// Login must find accounts however the e-mail was stored:
//  - the admin script stores the e-mail lower-cased exactly as typed;
//  - self-registration stores express-validator's normalizeEmail() form (e.g. Gmail dots/+tags removed).
// Looking up both forms means neither kind of account is locked out.
let normalizer = null;
try {
  const mod = require("validator/lib/normalizeEmail");
  normalizer = mod.default || mod;
} catch { /* validator is a dependency of express-validator; if it is missing only the raw form is tried */ }

function emailCandidates(raw) {
  const lower = String(raw || "").trim().toLowerCase();
  const out = new Set([lower]);
  if (normalizer) {
    try { const n = normalizer(lower); if (n) out.add(String(n).toLowerCase()); } catch { /* ignore */ }
  }
  return [...out];
}
module.exports = { emailCandidates };
