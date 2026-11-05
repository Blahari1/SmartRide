import { useEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import Icon from "./Icon";

const variants = {
  primary: "bg-blue-700 text-white hover:bg-blue-800 focus-visible:outline-blue-700",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400",
};
const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
const base = "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function Button({ variant = "primary", size = "md", className = "", busy = false, disabled, type = "button", children, ...rest }) {
  return (
    <button type={type} disabled={disabled || busy} aria-busy={busy || undefined} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {busy && <Spinner small />}
      {children}
    </button>
  );
}
export function LinkButton({ to, variant = "secondary", size = "md", className = "", children, ...rest }) {
  return <Link to={to} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>{children}</Link>;
}

export function Spinner({ small = false }) {
  return <span role="status" aria-label="Loading" className={`inline-block ${small ? "h-4 w-4" : "h-8 w-8"} animate-spin rounded-full border-2 border-current border-t-transparent text-blue-700`} />;
}
export const Loading = ({ label = "Loading…" }) => (
  <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500"><Spinner />{label}</div>
);

export function Alert({ kind = "error", children, onClose }) {
  if (!children) return null;
  const styles = { error: "border-red-200 bg-red-50 text-red-800", success: "border-emerald-200 bg-emerald-50 text-emerald-800", info: "border-blue-200 bg-blue-50 text-blue-800", warning: "border-amber-200 bg-amber-50 text-amber-900" };
  const icons = { error: "alert", success: "check", info: "info", warning: "alert" };
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${styles[kind]}`}>
      <Icon name={icons[kind]} className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {onClose && <button type="button" aria-label="Dismiss" onClick={onClose} className="rounded p-0.5 hover:bg-black/5"><Icon name="x" className="h-4 w-4" /></button>}
    </div>
  );
}

export const ErrorState = ({ message, onRetry }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center" role="alert">
    <p className="font-semibold text-red-800">Something went wrong</p>
    <p className="mt-1 text-sm text-red-700">{message}</p>
    {onRetry && <Button className="mt-4" variant="secondary" onClick={onRetry}><Icon name="refresh" className="h-4 w-4" />Try again</Button>}
  </div>
);

export const EmptyState = ({ title, hint, action, icon = "info" }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Icon name={icon} /></span>
    <p className="mt-3 font-semibold text-slate-800">{title}</p>
    {hint && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// Handles the common load states of a useAsync result so pages stay short.
export function Async({ state, children }) {
  if (state.loading) return <Loading />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  return children(state.data);
}

export const Card = ({ className = "", title, actions, children, padded = true }) => (
  <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
    {(title || actions) && (
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>{actions}
      </header>
    )}
    <div className={padded ? "p-5" : ""}>{children}</div>
  </section>
);

export function Breadcrumbs({ items }) {
  if (!items?.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-2 text-xs text-slate-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-1">
            {i > 0 && <Icon name="right" className="h-3 w-3" />}
            {it.to && i < items.length - 1 ? <Link to={it.to} className="hover:text-blue-700 hover:underline">{it.label}</Link> : <span aria-current={i === items.length - 1 ? "page" : undefined} className="font-medium text-slate-700">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export const PageHeader = ({ title, subtitle, actions, breadcrumbs }) => (
  <div className="mb-6">
    <Breadcrumbs items={breadcrumbs} />
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  </div>
);

const tones = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", blue: "bg-blue-50 text-blue-700 ring-blue-600/20", amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20", slate: "bg-slate-100 text-slate-700 ring-slate-500/20", indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
};
const statusTone = {
  active: "green", approved: "green", available: "green", completed: "green",
  confirmed: "blue", assigned: "blue", in_progress: "indigo", "in progress": "indigo",
  pending: "amber", Pending: "amber", scheduled: "amber", maintenance: "amber",
  cancelled: "slate", expired: "slate", inactive: "slate", unavailable: "slate", closed: "slate",
  rejected: "red", disabled: "red",
};
export const Badge = ({ value, tone }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${tones[tone || statusTone[value] || "slate"]}`}>{String(value).replace(/_/g, " ")}</span>
);

export function StatCard({ label, value, hint, icon, tone = "blue", to }) {
  const bg = { blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700", slate: "bg-slate-100 text-slate-600", indigo: "bg-indigo-50 text-indigo-700" }[tone];
  const body = (
    <div className="flex items-start gap-4 p-5">
      {icon && <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${bg}`}><Icon name={icon} /></span>}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900">{value ?? "—"}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
  const cls = "block rounded-xl border border-slate-200 bg-white shadow-sm";
  return to ? <Link to={to} className={`${cls} transition hover:border-blue-300 hover:shadow`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export const DL = ({ items, cols = 2 }) => (
  <dl className={`grid gap-x-6 gap-y-3 text-sm ${cols === 1 ? "" : "sm:grid-cols-2"}`}>
    {items.filter(Boolean).map(([k, v]) => (
      <div key={k}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt><dd className="mt-0.5 break-words text-slate-900">{v ?? "—"}</dd></div>
    ))}
  </dl>
);

export function Modal({ open, title, onClose, children, footer, size = "md" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector("input,select,textarea,button")?.focus();
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  const w = { md: "max-w-md", lg: "max-w-2xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl ${w}`}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100"><Icon name="x" className="h-4 w-4" /></button>
        </div>
        <div className="mt-3">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", danger = false, busy = false, onConfirm, onCancel, disabled = false, children }) {
  return (
    <Modal open={open} title={title} onClose={busy ? undefined : onCancel}
      footer={<><Button variant="secondary" onClick={onCancel} disabled={busy}>Back</Button><Button variant={danger ? "danger" : "primary"} onClick={onConfirm} busy={busy} disabled={disabled}>{confirmLabel}</Button></>}>
      {message && <p className="text-sm text-slate-600">{message}</p>}
      {children}
    </Modal>
  );
}

export const Field = ({ label, hint, error, children, className = "" }) => (
  <label className={`block text-sm font-medium text-slate-700 ${className}`}>
    {label}
    {children}
    {error ? <span className="mt-1 block text-xs font-normal text-red-600">{error}</span> : hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
  </label>
);

export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button key={t.key} role="tab" type="button" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition ${value === t.key ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          {t.label}{t.count !== undefined && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function NavTabs({ items }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Section">
      {items.map((t) => (
        <NavLink key={t.to} to={t.to} end className={({ isActive }) => `-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold ${isActive ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{t.label}</NavLink>
      ))}
    </nav>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…" }) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:w-72" />
    </label>
  );
}
export const Select = ({ label, value, onChange, options, className = "" }) => (
  <label className={`block text-xs font-semibold text-slate-500 ${className}`}>
    <span className="sr-only">{label}</span>
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </label>
);
export const Toolbar = ({ children }) => <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>;

export function Pagination({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="left" className="h-3.5 w-3.5" />Prev</Button>
        <span className="px-1">Page {page} / {pages}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next<Icon name="right" className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

// columns: [{ key, header, render?(row), sortKey?, className? }]. Sorting is delegated to the caller (server or client).
export function DataTable({ columns = [], rows = [], rowKey = (r) => r?._id || r?.id, sort = null, onSort, empty }) {
  const isSorted = (column) => Boolean(column?.sortKey && sort?.key === column.sortKey);
  const sortDirection = sort?.dir === "asc" ? "asc" : "desc";
  if (!Array.isArray(rows) || rows.length === 0) return empty || <EmptyState title="Nothing to show" />;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-4 py-3 font-semibold ${c.className || ""}`} aria-sort={isSorted(c) ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}>
                {c.sortKey && onSort ? (
                  <button type="button" onClick={() => onSort({ key: c.sortKey, dir: isSorted(c) && sortDirection === "asc" ? "desc" : "asc" })} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-slate-800">
                    {c.header}{isSorted(c) && <span aria-hidden>{sortDirection === "asc" ? "▲" : "▼"}</span>}
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-slate-50/60">
              {columns.map((c) => <td key={c.key} className={`px-4 py-3 align-middle ${c.className || ""}`}>{c.render ? c.render(r) : r[c.key] ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Action menu ("⋯"): a native <details> keeps it keyboard accessible without extra state.
export function ActionMenu({ items }) {
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <details className="relative inline-block text-left">
      <summary className="flex cursor-pointer list-none items-center rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50" aria-label="Actions"><Icon name="more" className="h-4 w-4" /></summary>
      <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
        {shown.map((it) => it.to
          ? <Link key={it.label} to={it.to} className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">{it.label}</Link>
          : <button key={it.label} type="button" onClick={(e) => { e.currentTarget.closest("details").removeAttribute("open"); it.onClick(); }} className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${it.danger ? "text-red-600" : "text-slate-700"}`}>{it.label}</button>)}
      </div>
    </details>
  );
}

export function Stars({ value, size = "h-4 w-4", showValue = false }) {
  const v = Math.round((value || 0) * 2) / 2;
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value ?? 0} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={`${size} ${i <= v ? "text-amber-400" : i - 0.5 === v ? "text-amber-300" : "text-slate-300"}`} fill="currentColor" aria-hidden><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z" /></svg>
      ))}
      {showValue && <span className="ml-1 text-sm font-semibold text-slate-700">{value ? Number(value).toFixed(1) : "—"}</span>}
    </span>
  );
}
export function StarInput({ value, onChange, label = "Rating" }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => onChange(i)} className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-blue-700">
          <svg viewBox="0 0 24 24" className={`h-8 w-8 ${i <= value ? "text-amber-400" : "text-slate-300 hover:text-amber-200"}`} fill="currentColor" aria-hidden><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z" /></svg>
        </button>
      ))}
    </div>
  );
}

export const Avatar = ({ name, className = "h-9 w-9" }) => (
  <span aria-hidden className={`flex ${className} shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800`}>{(name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</span>
);
