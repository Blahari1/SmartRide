export const mapMarkerFromLocation = (id, kind, loc, title) => (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number" ? { id, kind, lat: loc.latitude, lng: loc.longitude, title } : null);
export const compact = (arr) => arr.filter(Boolean);
// Deep link that opens turn-by-turn directions in OpenStreetMap's router (no API key, no tracking of the user by SmartRide).
export const directionsUrl = (from, to) => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from.latitude}%2C${from.longitude}%3B${to.latitude}%2C${to.longitude}`;
