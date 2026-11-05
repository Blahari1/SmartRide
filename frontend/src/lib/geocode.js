// Address suggestions and reverse geocoding are proxied through the authenticated backend.
// Photon powers debounced suggestions while typing; server-side caching limits repeat requests.
import { api } from "../services/api";

export async function searchAddress(query) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  const data = await api("/pricing/geocode/search", { method: "POST", body: { query: q } });
  return Array.isArray(data.results) ? data.results : [];
}

export async function reverseGeocode(latitude, longitude) {
  const data = await api("/pricing/geocode/reverse", {
    method: "POST",
    body: { latitude, longitude },
  });
  return data.result || null;
}
