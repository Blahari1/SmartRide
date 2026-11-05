// Server-side Nominatim integration. Requests are explicit (not keystroke autocomplete), cached,
// and spaced globally to respect the public service's usage policy.
const { HttpError } = require("../utils/validate");

const BASE = (process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org").replace(/\/+$/, "");
const CONTACT = process.env.GEOCODING_CONTACT_EMAIL ? `; contact: ${process.env.GEOCODING_CONTACT_EMAIL}` : "";
const USER_AGENT = process.env.GEOCODING_USER_AGENT || `SmartRide/1.0 (student project${CONTACT})`;
const MIN_GAP_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 1000;

let lastRequestAt = 0;
let queue = Promise.resolve();
let doFetch = (...args) => fetch(...args);
const cache = new Map();

function cached(key) {
  const hit = cache.get(key);
  if (!hit) return { found: false };
  if (hit.expiresAt <= Date.now()) { cache.delete(key); return { found: false }; }
  return { found: true, value: hit.value };
}
function remember(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
function request(url) {
  const task = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_GAP_MS - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    let response;
    try {
      response = await doFetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new HttpError(502, "Address search service is unavailable. Try again shortly.");
    }
    if (response.status === 429) throw new HttpError(429, "Address search is busy. Wait a few seconds and try again.");
    if (!response.ok) throw new HttpError(502, `Address search failed (${response.status}).`);
    try { return await response.json(); }
    catch { throw new HttpError(502, "Address search returned an invalid response."); }
  });
  queue = task.catch(() => {});
  return task;
}
function result(row) {
  const latitude = Number(row.lat), longitude = Number(row.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    placeId: `osm:${row.osm_type || "place"}:${row.osm_id ?? row.place_id}`,
    label: String(row.display_name || "").slice(0, 300),
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    type: row.type || row.category || "",
  };
}
async function search(query) {
  if (typeof query !== "string" || query.trim().length < 3 || query.trim().length > 250) {
    throw new HttpError(400, "Enter an address with 3 to 250 characters");
  }
  const q = query.trim().replace(/\\s+/g, " ");
  const key = `s:${q.toLowerCase()}`;
  const hit = cached(key);
  if (hit.found) return hit.value;
  // Photon supports address suggestions while typing; requests remain server-side and cached.
  const params = new URLSearchParams({ q, limit: "6", lang: "en" });
  const rows = await request(`https://photon.komoot.io/api/?${params}`);
  if (!rows || !Array.isArray(rows.features)) throw new HttpError(502, "Address search returned an invalid result.");
  const results = rows.features.map((feature) => {
    const coordinates = feature.geometry?.coordinates || [];
    const longitude = Number(coordinates[0]), latitude = Number(coordinates[1]);
    const props = feature.properties || {};
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const streetLine = [props.housenumber, props.street].filter(Boolean).join(" ").trim();
    const locality = [props.suburb, props.neighbourhood, props.district, props.city, props.county, props.state, props.postcode, props.country];
    const labelParts = [props.name && props.name !== streetLine ? props.name : null, streetLine, ...locality]
      .filter(Boolean).map((part) => String(part).trim()).filter(Boolean);
    const label = [...new Set(labelParts)].join(", ").slice(0, 300);
    return {
      placeId: `photon:${props.osm_type || "place"}:${props.osm_id || `${latitude},${longitude}`}`,
      label,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      type: props.type || props.osm_value || "",
    };
  }).filter((x) => x && x.label);
  return remember(key, results);
}
async function reverse(latitude, longitude) {
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180 || (lat === 0 && lon === 0)) {
    throw new HttpError(400, "Valid latitude and longitude are required");
  }
  const key = `r:${lat.toFixed(5)},${lon.toFixed(5)}`;
  const hit = cached(key);
  if (hit.found) return hit.value;
  const params = new URLSearchParams({ format: "jsonv2", lat: String(lat), lon: String(lon), zoom: "18" });
  const row = await request(`${BASE}/reverse?${params}`);
  if (!row || row.error || !row.display_name) return remember(key, null);
  return remember(key, {
    placeId: `osm:${row.osm_type || "place"}:${row.osm_id ?? row.place_id}`,
    label: String(row.display_name).slice(0, 300),
  });
}
module.exports = { search, reverse, _setFetch: (fn) => { doFetch = fn; }, _clearCache: () => cache.clear() };
