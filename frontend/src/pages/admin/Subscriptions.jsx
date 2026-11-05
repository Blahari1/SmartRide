import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAsync } from "../../hooks/useAsync";
import { getSubscription, listSubscriptions } from "../../services/subscriptionService";
import { listSchedules } from "../../services/scheduleService";
import { Async, Badge, Card, DataTable, DL, EmptyState, LinkButton, PageHeader, Pagination, SearchInput, Select, Toolbar } from "../../components/ui";
import FareBreakdown from "../../components/FareBreakdown";
import { dirShort, fmtDate, fmtDateTime, inr } from "../../lib/format";

export function SubscriptionList() {
  const [sp] = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") || "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const state = useAsync(() => listSubscriptions({ status: status || undefined, page, limit: 20 }), `${status}-${page}`);
  return (
    <>
      <PageHeader title="Customer commute assignments" subtitle="See which approved driver has accepted each customer's recurring commute." />
      <Toolbar><SearchInput value={q} onChange={setQ} placeholder="Filter this page by customer or plan" /><Select label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[["", "All statuses"], ["pending", "Pending"], ["active", "Active"], ["expired", "Expired"], ["cancelled", "Cancelled"]]} /></Toolbar>
      <Async state={state}>{(d) => {
        const term = q.trim().toLowerCase();
        const rows = d.subscriptions.filter((s) => !term || [s.userId?.name, s.userId?.email, s.planSnapshot.name].some((x) => (x || "").toLowerCase().includes(term)));
        return (<>
          <DataTable rows={rows} empty={<EmptyState icon="layers" title="No subscriptions found" />} columns={[
            { key: "c", header: "Customer", render: (s) => <Link className="font-semibold text-blue-700 hover:underline" to={`/admin/subscriptions/${s._id}`}>{s.userId?.name || "—"}</Link> },
            { key: "p", header: "Plan", render: (s) => s.planSnapshot.name },
            { key: "driver", header: "Assigned driver", render: (s) => s.assignedDriverId?.fullName || "Waiting for driver" },
            { key: "time", header: "Pickup / drop", render: (s) => `${s.requestSchedule?.pickupTime || "—"} / ${s.requestSchedule?.dropTime || "—"}` },
            { key: "d", header: "Period", render: (s) => (s.startDate ? `${fmtDate(s.startDate)} → ${fmtDate(s.endDate)}` : "Awaiting acceptance") },
            { key: "r", header: "Requested", render: (s) => fmtDate(s.createdAt) },
            { key: "s", header: "Status", render: (s) => <Badge value={s.status} /> },
          ]} />
          <Pagination page={d.page} limit={20} total={d.total} onPage={setPage} /></>);
      }}</Async>
    </>
  );
}

export function SubscriptionDetail() {
  const { id } = useParams();
  const state = useAsync(() => getSubscription(id), id);
  const schedules = useAsync(() => listSchedules({}).then((r) => r.schedules.filter((s) => String(s.subscriptionId) === id)), id);
  return (
    <Async state={state}>{({ subscription: s }) => (
      <>
        <PageHeader title={s.planSnapshot.name} subtitle={s.userId?.name} breadcrumbs={[{ label: "Subscriptions", to: "/admin/subscriptions" }, { label: "Details" }]} actions={<Badge value={s.status} />} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Subscription"><DL items={[["Duration", s.planSnapshot.durationMonths >= 12 ? `${s.planSnapshot.durationMonths / 12} year(s)` : `${s.planSnapshot.durationMonths} month(s)`], ["Estimated fare", inr(s.planSnapshot.pricePaise)], ["Start", s.startDate ? fmtDate(s.startDate) : "Not started"], ["End", s.endDate ? fmtDate(s.endDate) : "—"], ["Requested", fmtDateTime(s.createdAt)], s.cancelledAt && ["Cancelled", fmtDateTime(s.cancelledAt)]]} /></Card>
          {s.fareSnapshot && <Card title="Distance-based fare (snapshot)" className="lg:col-span-2"><FareBreakdown fare={s.fareSnapshot} /><p className="mt-2 text-xs text-slate-500">Priced {fmtDateTime(s.fareSnapshot.calculatedAt)} with the configuration in force then. Later pricing changes do not alter this amount.</p></Card>}
          <Card title="Customer">{s.userId && <DL cols={1} items={[["Name", <Link key="n" className="text-blue-700 hover:underline" to={`/admin/customers/${s.userId._id}`}>{s.userId.name}</Link>], ["Email", s.userId.email], ["Phone", s.userId.phone]]} />}</Card>
          <Card title="Assigned driver"><DL items={[["Driver", s.assignedDriverId?.fullName || "Not accepted yet"], ["Phone", s.assignedDriverId?.phone || "—"], ["Accepted", s.acceptedAt ? fmtDateTime(s.acceptedAt) : "—"], ["Pickup time", s.requestSchedule?.pickupTime || "—"], ["Drop time", s.requestSchedule?.dropTime || "—"]]} /></Card>
          <Card title="Recurring pickup schedules">
            <Async state={schedules}>{(list) => list.length ? <ul className="space-y-2 text-sm">{list.map((x) => <li key={x._id}><Link className="font-semibold text-blue-700 hover:underline" to={`/admin/schedules/${x._id}`}>{dirShort(x.direction)} · {x.servicePeriod} · {x.pickupTime}</Link> <Badge value={x.status} /></li>)}</ul> : <p className="text-sm text-slate-500">No schedule has been created for this subscription.</p>}</Async>
          </Card>
        </div>
      </>
    )}</Async>
  );
}
