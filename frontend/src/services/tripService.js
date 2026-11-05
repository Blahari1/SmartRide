import { api, qs } from "./api";

export const myTrips = (params) => api(`/trips/my${qs(params)}`);
export const getTrip = (id) => api(`/trips/${id}`);
export const getTracking = (tripId) => api(`/tracking/trips/${tripId}`);
export const activeTrips = () => api("/tracking/active");
export const postLocation = (tripId, loc) => api(`/tracking/trips/${tripId}/location`, { method: "POST", body: loc });
export const customerDashboard = () => api("/customers/me/dashboard");
