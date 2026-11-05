import { useCallback, useEffect, useMemo, useState } from "react";
import { getSocket } from "../lib/socket";
import { unreadCount } from "../services/notificationService";
import { NotificationContext } from "./notificationStore";

// Keeps the unread badge in sync: initial count from the API, +1 per real-time "notification:new" event, and a slow
// polling fallback while the socket is disconnected. Toasts show the newest notification briefly.
export function NotificationProvider({ children }) {
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);
  const [connected, setConnected] = useState(false);
  const [version, setVersion] = useState(0); // bumps on every new notification so lists can refresh

  const refresh = useCallback(() => unreadCount().then((r) => setUnread(r.unread)).catch(() => {}), []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const s = getSocket();
    if (!s) return () => clearTimeout(first);
    const onNew = (n) => { setUnread((u) => u + 1); setToast(n); setVersion((v) => v + 1); };
    const onUp = () => setConnected(true);
    const onDown = () => setConnected(false);
    s.on("notification:new", onNew); s.on("connect", onUp); s.on("disconnect", onDown);
    if (s.connected) setTimeout(onUp, 0);
    const poll = setInterval(() => { if (!s.connected) refresh(); }, 60000);
    return () => { clearTimeout(first); clearInterval(poll); s.off("notification:new", onNew); s.off("connect", onUp); s.off("disconnect", onDown); };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const value = useMemo(() => ({ unread, setUnread, refresh, toast, dismissToast: () => setToast(null), connected, version }), [unread, refresh, toast, connected, version]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
