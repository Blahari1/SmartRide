import { api, qs } from "./api";

export const getDashboard = () => api("/admin/dashboard");
export const getReport = (params) => api(`/admin/reports${qs(params)}`);
export const listCustomers = (params) => api(`/admin/customers${qs(params)}`);
export const getCustomer = (id) => api(`/admin/customers/${id}`);
export const setCustomerActive = (id, isActive) => api(`/admin/customers/${id}/status`, { method: "PATCH", body: { isActive } });
