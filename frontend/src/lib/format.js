export const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500";

export const inr = (paise) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 }).format((paise || 0) / 100);
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—");
export const fmtClock = (d) => (d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" }) : "—");
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const fmtDay = (s) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }) : "—");
export const fmtDayLong = (s) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }) : "—");
export const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
export const addDays = (dateStr, n) => { const d = new Date(`${dateStr}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const fmtTime = (hhmm) => {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
export const ago = (d) => {
  if (!d) return "—";
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(d);
};
export const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
export const hasCoords = (l) => !!l && typeof l.latitude === "number" && typeof l.longitude === "number";
export const toCsv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
export function downloadText(filename, text, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Two-way commute label. Legacy records without a direction are outbound.
export const dirLabel = (d) => (d === "return" ? "Return (College/Office → Home)" : "Outbound (Home → College/Office)");
export const dirShort = (d) => (d === "return" ? "Return" : "Outbound");
