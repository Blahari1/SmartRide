// Real road routing through OSRM (OpenStreetMap data), called from the SERVER so no key or provider URL is exposed to the browser
// and the distance used for pricing cannot be tampered with by a client. There is deliberately NO straight-line fallback:
// if a road route cannot be found, the caller gets an error and no fare is produced.
const { HttpError } = require("../utils/validate");

const OSRM_URL = (process.env.OSRM_URL || "https://router.project-osrm.org").replace(/\/+$/, "");
const TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS) || 8000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;
const MAX_POINTS = 1500;

let doFetch = (...a) => fetch(...a); // replaceable in tests
const cache = new Map();

const validPoint = (p) => p && typeof p.latitude === "number" && typeof p.longitude === "number"
  && p.latitude >= -90 && p.latitude <= 90 && p.longitude >= -180 && p.longitude <= 180 && !(p.latitude === 0 && p.longitude === 0);
const key = (a, b) => [a.latitude, a.longitude, b.latitude, b.longitude].map((n) => n.toFixed(5)).join(",");

function haversineMeters(a, b) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function getRoute(from, to) {
  if (!validPoint(from) || !validPoint(to)) throw new HttpError(400, "Both locations need valid latitude and longitude");
  if (haversineMeters(from, to) < 50) throw new HttpError(400, "Pickup and drop are the same place; choose two different locations");
  const k = key(from, to);
  const hit = cache.get(k);
  if (hit && hit.exp > Date.now()) return hit.value;

  const url = `${OSRM_URL}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&alternatives=false&steps=false`;
  let res;
  try {
    res = await doFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "SmartRide-student-project/1.0" } });
  } catch {
    throw new HttpError(502, "The routing service could not be reached. Please try again in a moment.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* handled below */ }
  if (data && data.code === "NoRoute") throw new HttpError(422, "No road route exists between these two locations.");
  if (!res.ok || !data || data.code !== "Ok" || !data.routes || !data.routes[0]) throw new HttpError(502, "The routing service did not return a route. Please try again.");

  const r = data.routes[0];
  if (!(r.distance > 0) || !(r.duration >= 0)) throw new HttpError(502, "The routing service returned an invalid route.");
  let coords = (r.geometry && r.geometry.coordinates) || [];
  if (coords.length > MAX_POINTS) { const step = Math.ceil(coords.length / MAX_POINTS); coords = coords.filter((_, i) => i % step === 0 || i === coords.length - 1); }
  const value = {
    distanceMeters: Math.round(r.distance),
    distanceKm: Math.round(r.distance / 100) / 10,
    durationSeconds: Math.round(r.duration),
    durationMinutes: Math.max(1, Math.round(r.duration / 60)),
    geometry: coords.map(([lon, lat]) => [lat, lon]), // Leaflet order
    provider: "OSRM",
  };
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(k, { exp: Date.now() + CACHE_TTL_MS, value });
  return value;
}

module.exports = { getRoute, haversineMeters, _setFetch: (f) => { doFetch = f; }, _clearCache: () => cache.clear() };
