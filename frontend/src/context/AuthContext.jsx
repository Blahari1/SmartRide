import { useCallback, useEffect, useMemo, useState } from "react";
import * as auth from "../services/authService";
import { tokenExpiry } from "../services/api";
import { closeSocket } from "../lib/socket";
import { AuthContext } from "./authStore";

const readUser = () => {
  try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
};
const initialExpiry = () => (localStorage.getItem("token") ? tokenExpiry() : null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (localStorage.getItem("token") ? readUser() : null));
  const [expiresAt, setExpiresAt] = useState(initialExpiry);

  const logout = useCallback((reason) => {
    closeSocket();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (reason) sessionStorage.setItem("smartride:notice", reason);
    setUser(null);
    setExpiresAt(null);
  }, []);

  // Any 401 means the server no longer accepts the token (expired, account disabled...): sign out with an explanation.
  useEffect(() => {
    const onUnauthorized = () => logout("Your session has ended. Please log in again.");
    window.addEventListener("smartride:unauthorized", onUnauthorized);
    return () => window.removeEventListener("smartride:unauthorized", onUnauthorized);
  }, [logout]);

  // Tokens last 15 minutes by default and cannot be silently refreshed (no refresh-token endpoint, by design).
  // The user is warned shortly before (SessionBanner) and signed out exactly at expiry.
  useEffect(() => {
    if (!user) return undefined;
    if (!expiresAt) return undefined;
    const ms = expiresAt - Date.now();
    if (ms <= 0) { const id = setTimeout(() => logout("Your session expired. Please log in again."), 0); return () => clearTimeout(id); }
    const id = setTimeout(() => logout("Your session expired. Please log in again."), Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(id);
  }, [user, expiresAt, logout]);

  const login = useCallback(async (email, password) => {
    const data = await auth.login(email, password);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    setExpiresAt(tokenExpiry(data.token));
    return data.user;
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((u) => {
      const next = { ...u, ...patch };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ user, expiresAt, login, logout, updateUser }), [user, expiresAt, login, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
