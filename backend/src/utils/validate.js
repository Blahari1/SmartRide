const mongoose = require("mongoose");

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const isId = (v) => typeof v === "string" && mongoose.isValidObjectId(v) && /^[a-f\d]{24}$/i.test(v);

function requireId(value, label = "ID") {
  if (!isId(value)) throw new HttpError(400, `Invalid ${label}`);
  return value;
}

function pickAllowed(body, allowed) {
  const extra = Object.keys(body || {}).filter((k) => !allowed.includes(k));
  if (extra.length) throw new HttpError(400, "Unsupported fields in request", { fields: extra });
  return body;
}

// async route wrapper + central error mapping
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message, ...err.extra });
  }
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate record", fields: Object.keys(err.keyPattern || {}) });
  }
  if (err.name === "ValidationError") return res.status(400).json({ success: false, message: err.message });
  if (err.name === "CastError") return res.status(400).json({ success: false, message: "Invalid ID or value" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ success: false, message: "Malformed JSON body" });
  console.error(err);
  return res.status(500).json({ success: false, message: "Internal server error" });
}

module.exports = { HttpError, isId, requireId, pickAllowed, wrap, errorHandler };
