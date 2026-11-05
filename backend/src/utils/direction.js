// Two-way commute helpers. Legacy records without a `direction` are outbound.
const DIRECTIONS = ["outbound", "return"];
const dirOf = (doc) => (doc && doc.direction) || "outbound";
// Mongo filter matching a direction, including legacy documents where the field is missing.
const dirFilter = (direction) => (direction === "outbound" ? { $or: [{ direction: "outbound" }, { direction: { $exists: false } }, { direction: null }] } : { direction });
module.exports = { DIRECTIONS, dirOf, dirFilter };
