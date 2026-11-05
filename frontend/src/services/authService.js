import { api } from "./api";

export const login = (email, password) => api("/auth/login", { method: "POST", auth: false, body: { email, password } });
export const register = (payload) => api("/auth/register", { method: "POST", auth: false, body: payload });
export const getMe = () => api("/auth/me");
export const updateAccount = (data) => api("/auth/me", { method: "PATCH", body: data });
export const changePassword = (currentPassword, newPassword) => api("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
export const logoutRequest = () => api("/auth/logout", { method: "POST", body: {} });
