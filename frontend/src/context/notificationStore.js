import { createContext, useContext } from "react";

export const NotificationContext = createContext({ unread: 0, setUnread() {}, refresh() {}, toast: null, dismissToast() {}, connected: false, version: 0 });
export const useNotifications = () => useContext(NotificationContext);
