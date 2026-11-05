import { api, qs } from "./api";

export const createDriverProfile = (data) => api("/drivers/profile", { method: "POST", body: data });
export const getMyDriver = () => api("/drivers/me");
export const updateMyDriver = (data) => api("/drivers/me", { method: "PATCH", body: data });
export const getDriverDashboard = () => api("/drivers/me/dashboard");
export const getMyCustomers = () => api("/drivers/me/customers");
export const setMyAvailability = (availability) => api("/drivers/me/availability", { method: "PATCH", body: { availability } });

export const listDrivers = (status) => api(`/drivers${qs({ status })}`);
export const getDriver = (id) => api(`/drivers/${id}`);
export const verifyDriver = (id, status, reason) => api(`/drivers/${id}/verify`, { method: "PATCH", body: status === "rejected" ? { status, reason } : { status } });
export const setDriverAvailability = (id, availability) => api(`/drivers/${id}/availability`, { method: "PATCH", body: { availability } });

export const availableRideRequests = () => api("/drivers/requests");
export const acceptRideRequest = (id) => api(`/drivers/requests/${id}/accept`, { method: "POST", body: {} });
