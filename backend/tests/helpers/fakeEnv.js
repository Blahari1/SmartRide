// In-memory stand-in for Mongoose models + Express' Router, so the REAL services, controllers, route tables and
// role middleware can be executed on plain Node without MongoDB or node_modules.
//
// What this verifies: business rules and authorization logic.
// What it can NOT verify: real MongoDB behaviour (partial unique indexes, true atomicity across processes,
// schema validation). Those need tests/INTEGRATION.md against a real database.
const Module = require("module");
const path = require("path");

let seq = 1;
class Oid {
  constructor(s) { this.s = s || (seq++).toString(16).padStart(24, "0"); }
  toString() { return this.s; }
  toJSON() { return this.s; }
  equals(o) { return String(o) === this.s; }
  get _id() { return this; } // lets `doc.ref._id` work like a populated reference
}
const oid = () => new Oid();
// Mongoose casts 24-hex strings to ObjectId on write; mirror that so `.equals()` works on stored ids.
const cast = (v) => (typeof v === "string" && /^[a-f\d]{24}$/i.test(v) ? new Oid(v) : v);
const castAll = (o) => { for (const k of Object.keys(o)) if (k !== "_id" || typeof o[k] === "string") o[k] = cast(o[k]); return o; };

const same = (a, b) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : String(a) === String(b));
function matchValue(v, cond) {
  if (cond instanceof RegExp) return typeof v === "string" && cond.test(v);
  if (cond && typeof cond === "object" && !(cond instanceof Date) && !(cond instanceof Oid) && Object.keys(cond).some((k) => k.startsWith("$"))) {
    return Object.entries(cond).every(([op, x]) => {
      if (op === "$in") return x.some((y) => (y === null ? v == null : v != null && same(v, y)));
      if (op === "$nin") return !x.some((y) => v != null && same(v, y));
      if (op === "$ne") return x === null ? v != null : !(v != null && same(v, x));
      if (op === "$lte") return v != null && v <= x;
      if (op === "$gte") return v != null && v >= x;
      if (op === "$lt") return v != null && v < x;
      if (op === "$gt") return v != null && v > x;
      if (op === "$type") return true;
      if (op === "$exists") return x ? v !== undefined : v === undefined;
      throw new Error("fake db: unsupported operator " + op);
    });
  }
  if (cond === null) return v == null;
  return v != null && same(v, cond);
}
function matches(doc, filter) {
  return Object.entries(filter || {}).every(([k, cond]) => {
    if (k === "$or") return cond.some((f) => matches(doc, f));
    return matchValue(doc[k], cond);
  });
}

class Query {
  constructor(run) { this.run = run; }
  populate() { return this; } select() { return this; } lean() { return this; } sort(spec) { this._sort = spec; return this; } skip() { return this; } limit() { return this; }
  then(res, rej) { return Promise.resolve().then(() => this.run(this)).then(res, rej); }
  catch(rej) { return this.then(undefined, rej); }
}

// Honour .sort({field: 1|-1}) like Mongo does (stable; undefined sorts first ascending).
function sortDocs(docs, spec) {
  if (!spec || typeof spec !== "object") return docs;
  const keys = Object.entries(spec);
  const cmp = (a, b) => { for (const [k, dir] of keys) { const x = a[k] instanceof Date ? a[k].getTime() : a[k], y = b[k] instanceof Date ? b[k].getTime() : b[k]; if (x === y) continue; return (x > y ? 1 : -1) * (dir < 0 ? -1 : 1); } return 0; };
  return docs.slice().sort(cmp);
}

function makeModel(name, defaults) {
  const store = [];
  class Doc {
    constructor(data) {
      Object.assign(this, defaults ? defaults() : {}, castAll({ ...data }));
      if (!this._id) this._id = oid();
      const now = new Date();
      if (!this.createdAt) this.createdAt = now;
      this.updatedAt = now;
    }
    async save() {
      // mirror the real models' pre("validate") hooks that derive isOpen from status
      if (name === "Schedule") this.isOpen = ["scheduled", "confirmed"].includes(this.status);
      if (name === "Trip") this.isOpen = !["completed", "cancelled"].includes(this.status);
      if (!store.includes(this)) store.push(this);
      this.updatedAt = new Date();
      return this;
    }
    async populate() { return this; }
    async deleteOne() { const i = store.indexOf(this); if (i >= 0) store.splice(i, 1); return this; }
    toObject() { return JSON.parse(JSON.stringify(this)); }
  }
  const apply = (doc, update) => { Object.assign(doc, castAll({ ...(update.$set || {}) })); for (const k of Object.keys(update.$unset || {})) delete doc[k]; doc.updatedAt = new Date(); };
  const Model = Object.assign(function (data) { return new Doc(data); }, {
    _name: name, _store: store,
    async create(data) { if (Model._failNext) { const e = Model._failNext; Model._failNext = null; throw e; } const d = new Doc(data); await d.save(); return d; },
    deleteMany: (f) => new Query(async () => { const ds = store.filter((x) => matches(x, f)); ds.forEach((d) => store.splice(store.indexOf(d), 1)); return { deletedCount: ds.length }; }),
    deleteOne: (f) => new Query(async () => { const d = store.find((x) => matches(x, f)); if (d) store.splice(store.indexOf(d), 1); return { deletedCount: d ? 1 : 0 }; }),
    find: (f) => new Query(async (q) => sortDocs(store.filter((d) => matches(d, f)), q && q._sort)),
    findOne: (f) => new Query(async (q) => sortDocs(store.filter((d) => matches(d, f)), q && q._sort)[0] || null),
    findById: (id) => new Query(async () => store.find((d) => same(d._id, id)) || null),
    exists: (f) => new Query(async () => (store.find((d) => matches(d, f)) ? { _id: 1 } : null)),
    countDocuments: (f) => new Query(async () => store.filter((d) => matches(d, f)).length),
    findOneAndUpdate: (f, update, opts = {}) => new Query(async () => {
      const d = store.find((x) => matches(x, f));
      if (!d) return null;
      const snap = Object.assign(Object.create(Object.getPrototypeOf(d)), d);
      apply(d, update);
      return opts.new ? d : snap;
    }),
    updateOne: (f, update) => new Query(async () => { const d = store.find((x) => matches(x, f)); if (d) apply(d, update); return { matchedCount: d ? 1 : 0, modifiedCount: d ? 1 : 0 }; }),
    updateMany: (f, update) => new Query(async () => { const ds = store.filter((x) => matches(x, f)); ds.forEach((d) => apply(d, update)); return { matchedCount: ds.length, modifiedCount: ds.length }; }),
    aggregate: async (pipeline) => {
      let docs = store.slice();
      const out = new Map();
      for (const st of pipeline) {
        if (st.$match) docs = docs.filter((d) => matches(d, st.$match));
        if (st.$group) {
          for (const d of docs) {
            const key = String(d[st.$group._id.slice(1)]);
            const row = out.get(key) || { _id: d[st.$group._id.slice(1)] };
            for (const [f, spec] of Object.entries(st.$group)) if (f !== "_id") row[f] = (row[f] || 0) + (spec.$sum === 1 ? 1 : d[spec.$sum.slice(1)]);
            out.set(key, row);
          }
        }
      }
      return [...out.values()];
    },
    _reset() { store.length = 0; Model._failNext = null; },
    failNextCreate(err) { Model._failNext = err; },
  });
  return Model;
}

const models = {
  User: makeModel("User", () => ({ isActive: true })),
  CustomerProfile: makeModel("CustomerProfile"),
  SubscriptionPlan: makeModel("SubscriptionPlan", () => ({ isActive: true })),
  Subscription: makeModel("Subscription", () => ({ status: "pending", startDate: null, endDate: null, cancelledAt: null })),
  DriverProfile: makeModel("DriverProfile", () => ({ verificationStatus: "pending", availability: "available" })),
  Schedule: makeModel("Schedule", () => ({ isOpen: true, status: "scheduled", driverId: null })),
  Trip: makeModel("Trip"),
  PricingConfig: makeModel("PricingConfig", () => ({ isActive: true, minBillableKm: 0, effectiveFrom: new Date() })),
  Notification: makeModel("Notification", () => ({ isRead: false, readAt: null })),
  Rating: makeModel("Rating", () => ({ feedback: "" })),
};
const resetAll = () => Object.values(models).forEach((m) => m._reset());

// ---- Router stub: records routes so tests can run the real middleware chain ----
function Router() {
  const r = { routes: [], globals: [] };
  for (const m of ["get", "post", "patch", "put", "delete"]) r[m] = (p, ...h) => { r.routes.push({ method: m.toUpperCase(), path: p, handlers: h }); return r; };
  r.use = (...h) => { r.globals.push(...h); return r; };
  return r;
}
const express = () => { throw new Error("express app not available in fake env"); };
express.Router = Router;
express.json = () => (req, res, next) => next();

const real = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "mongoose") return { isValidObjectId: (v) => /^[a-f\d]{24}$/i.test(String(v)), Schema: class {}, model: () => ({}), set() {}, connection: { readyState: 0 } };
  if (request === "express") return express;
  if (request === "express-validator") {
    // chainable stand-in: body("x").trim().isLength(...) etc. all return the same chain; validationResult reports no errors
    const chain = new Proxy(function () {}, { get: () => chain, apply: () => chain });
    return { body: () => chain, validationResult: () => ({ isEmpty: () => true, array: () => [] }) };
  }
  if (request === "jsonwebtoken" || request === "cors" || request === "bcryptjs") return {};
  if (request === "dotenv") return { config() {} };
  if (parent && /[\\/]src[\\/]/.test(parent.filename || "") || /[\\/]tests[\\/]/.test((parent && parent.filename) || "")) {
    const m = /(?:^|[\\/])models[\\/](\w+)$/.exec(request);
    if (m && models[m[1]]) return models[m[1]];
  }
  return real.apply(this, arguments);
};

// Execute a route exactly like Express would, minus `authenticate` (tests set req.user, as authenticate would).
async function runRoute(router, method, url, { user = null, body = {}, query = {} } = {}) {
  for (const r of router.routes) {
    if (r.method !== method) continue;
    const names = [];
    const re = new RegExp("^" + r.path.replace(/:(\w+)/g, (_, n) => { names.push(n); return "([^/]+)"; }) + "$");
    const mt = re.exec(url);
    if (!mt) continue;
    const req = { user, body, query, params: Object.fromEntries(names.map((n, i) => [n, mt[i + 1]])), headers: {} };
    const out = { status: 200, json: null };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; out.sent = true; return this; } };
    let error = null;
    for (const h of r.handlers) {
      if (out.sent) break;
      let nextCalled = false;
      try { await h(req, res, (e) => { nextCalled = true; if (e) error = e; }); } catch (e) { error = e; }
      if (error || !nextCalled) break;
    }
    if (error) { // same mapping as the app's errorHandler
      const { errorHandler } = require("../../src/utils/validate");
      errorHandler(error, req, res, () => {});
      if (!out.sent) out.status = 500;
    }
    return out;
  }
  throw new Error(`No route ${method} ${url}`);
}

module.exports = { models, resetAll, Oid, oid, runRoute, Router };
