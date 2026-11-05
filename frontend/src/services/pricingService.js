import { api } from "./api";

export const getActivePricing = () => api("/pricing/active");
export const listPricing = () => api("/pricing");
// Admin enters INR; the server converts to integer paise and validates.
export const createPricing = (cfg) => api("/pricing", { method: "POST", body: cfg });
export const setPricingActive = (id, isActive) => api(`/pricing/${id}/status`, { method: "PATCH", body: { isActive } });
// Preview of the server-calculated fare (saved locations + OSRM road distance + active pricing). Nothing is stored.
export const quoteFare = ({ planId, directions, serviceDays }) => api("/pricing/quote", { method: "POST", body: { planId, directions, serviceDays } });
// Road route between two points (same service the fare uses).
export const routePreview = (from, to) => api("/pricing/route", { method: "POST", body: { from: { latitude: from.latitude, longitude: from.longitude }, to: { latitude: to.latitude, longitude: to.longitude } } });
