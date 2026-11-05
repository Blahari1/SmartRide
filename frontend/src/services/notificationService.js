import { api, qs } from "./api";

export const listNotifications = (params) => api(`/notifications${qs(params)}`);
export const unreadCount = () => api("/notifications/unread-count");
export const markRead = (id) => api(`/notifications/${id}/read`, { method: "PATCH", body: {} });
export const markAllRead = () => api("/notifications/read-all", { method: "PATCH", body: {} });
