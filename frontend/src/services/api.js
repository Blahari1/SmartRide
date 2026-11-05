// Shared fetch wrapper. The JWT lives in localStorage("token"); its expiry is read from the token itself (no secret needed).
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
export const SOCKET_URL = API_BASE.replace(/\/api\/?$/, "");

export const getToken = () => localStorage.getItem("token");

// exp (seconds since epoch) -> ms timestamp, or null if the token cannot be read. Only used for UX (timers, warnings);
// the server remains the only authority on whether a token is valid.
export function tokenExpiry(token = getToken()) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (!token) throw new Error("Please log in to continue.");
    headers.Authorization = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error("Cannot reach the server. Check that the backend is running on port 5001.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && auth) window.dispatchEvent(new CustomEvent("smartride:unauthorized"));
    const detail = Array.isArray(data.errors) ? data.errors.map((e) => e.message).join(", ") : "";
    throw new Error(data.message || detail || `Request failed (${response.status})`);
  }
  return data;
}

export const qs = (params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const s = q.toString();
  return s ? `?${s}` : "";
};
