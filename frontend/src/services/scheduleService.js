import { api, qs } from "./api";

// customer / driver
export const mySchedules = (include) => api(`/schedules/my${qs({ include })}`);
export const driverTrips = (params) => api(`/schedules/driver/my${qs(params)}`);
export const setTripStatus = (tripId, status, reason) => api(`/schedules/trips/${tripId}/status`, { method: "PATCH", body: reason ? { status, reason } : { status } });

// admin
export const listSchedules = (params) => api(`/schedules${qs(params)}`);
export const getSchedule = (id) => api(`/schedules/${id}`);
export const listTrips = (params) => api(`/schedules/trips${qs(params)}`);
export const cancelSchedule = (id, reason) => api(`/schedules/${id}/cancel`, { method: "POST", body: { reason } });
export const generateTrips = (id) => api(`/schedules/${id}/generate`, { method: "POST", body: {} });
