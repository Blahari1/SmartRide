import { Link } from "react-router-dom";
import { Badge, Card, DataTable, DL, EmptyState, LinkButton } from "./ui";
import { dirShort, fmtDate, fmtDay, fmtTime, inr } from "../lib/format";

export function TripTable({ trips, role, empty }) {
  const detail = (t) => `/${role}/trips/${t.id || t._id}`;
  const cols = [
    { key: "date", header: "Date", render: (t) => <Link className="font-semibold text-blue-700 hover:underline" to={detail(t)}>{fmtDay(t.date)}</Link> },
    { key: "time", header: "Time", render: (t) => <span className="whitespace-nowrap capitalize">{dirShort(t.direction)} · {t.servicePeriod} · {fmtTime(t.pickupTime)}</span> },
    { key: "route", header: "Route", render: (t) => <span className="block max-w-xs truncate text-slate-600" title={`${t.pickupLocation?.address} → ${t.dropLocation?.address}`}>{t.pickupLocation?.address || "—"} → {t.dropLocation?.address || "—"}</span> },
    role === "driver" && { key: "customer", header: "Customer", render: (t) => t.customer?.name || t.userId?.name || "—" },
    role === "customer" && { key: "driver", header: "Driver", render: (t) => (t.driver ? <span>{t.driver.name}</span> : <span className="text-slate-400">Not assigned yet</span>) },
    { key: "status", header: "Status", render: (t) => <Badge value={t.status} /> },
  ].filter(Boolean);
  return <DataTable columns={cols} rows={trips} rowKey={(t) => t.id || t._id} empty={empty || <EmptyState icon="car" title="No trips to show" />} />;
}

export function SubscriptionSummary({ sub, to }) {
  if (!sub) return null;
  const s = sub.planSnapshot;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-lg font-extrabold text-slate-900">{s.name}</p><p className="text-sm text-slate-500">{s.durationMonths >= 12 ? `${s.durationMonths / 12} year(s)` : `${s.durationMonths} month(s)`}{sub.fareSnapshot?.totalPaise != null ? ` · Estimated ${inr(sub.fareSnapshot.totalPaise)}` : ""}</p></div><Badge value={sub.status} /></div>
      <DL items={[["Start date", sub.status === "pending" ? "After a driver accepts" : fmtDate(sub.startDate)], ["End date", sub.status === "pending" ? "—" : fmtDate(sub.endDate)]]} />
      {to && <LinkButton to={to} size="sm">View details</LinkButton>}
    </div>
  );
}

export function Section({ title, children, actions, className = "" }) {
  return <Card className={className} title={title} actions={actions}>{children}</Card>;
}
