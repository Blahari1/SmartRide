import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsync, useAction } from "../../hooks/useAsync";
import { getMyCustomers, availableRideRequests, acceptRideRequest } from "../../services/driverService";
import { driverTrips } from "../../services/scheduleService";
import { driverRatings } from "../../services/ratingService";
import { TripTable } from "../../components/Blocks";
import { Alert, Async, Badge, Button, Card, DataTable, DL, EmptyState, NavTabs, PageHeader, Pagination, Select, StatCard, Stars, Toolbar } from "../../components/ui";
import { DAYS, fmtDate, fmtDateTime, fmtDay, fmtTime, inr, todayIst } from "../../lib/format";


export function AvailableRideRequests() {
  const state = useAsync(availableRideRequests);
  const act = useAction();
  return (
    <>
      <PageHeader title="Available commute requests" subtitle="Requests from customers are shared with all approved, available drivers. The first driver to accept gets the recurring schedule." actions={<Button variant="secondary" onClick={state.reload}>Refresh</Button>} />
      <Alert>{act.error}</Alert>
      <Async state={state}>{({ requests = [], canAccept = false }) => requests.length === 0 ? (
        <EmptyState icon="route" title="No available requests" hint="New customer commute requests will appear here when they are submitted." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {requests.map((r) => (
            <Card key={r.id} title={r.customer?.name || "Customer"} actions={<Badge value={r.plan?.durationMonths >= 12 ? `${r.plan.durationMonths / 12} year(s)` : `${r.plan?.durationMonths} month(s)`} tone="blue" />}>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-slate-500">Phone:</span> {r.customer?.phone || "—"}</p>
                <p><span className="text-slate-500">Pickup:</span> {r.schedule?.pickupTime || "—"}</p>
                <p><span className="text-slate-500">Drop:</span> {r.schedule?.dropTime || "—"}</p>
                <p><span className="text-slate-500">Days:</span> {(r.schedule?.serviceDays || []).map((d) => DAYS[d]).join(", ")}</p>
                <p><span className="text-slate-500">Route:</span> {(r.schedule?.directions || []).join(" + ")}</p>
                <p><span className="text-slate-500">Estimated fare:</span> {r.fare?.totalPaise != null ? inr(r.fare.totalPaise) : "—"}</p>
              </div>
              <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                <p><b>Pickup:</b> {r.pickupLocation?.address || "Location not saved"}</p>
                <p><b>Drop:</b> {r.dropLocation?.address || "Location not saved"}</p>
              </div>
              <Button className="mt-4" disabled={!canAccept} busy={act.busy} onClick={() => act.run(async () => { await acceptRideRequest(r.id); state.reload(); })}>Accept commute</Button>
            </Card>
          ))}
        </div>
      )}</Async>
    </>
  );
}

export function AssignedCustomers() {
  const state = useAsync(getMyCustomers);
  return (
    <>
      <PageHeader title="My customers" subtitle="Customers whose recurring commute requests you have accepted." />
      <Async state={state}>{({ customers }) => (
        <DataTable rows={customers} empty={<EmptyState icon="users" title="No customers assigned yet" />} columns={[
          { key: "name", header: "Customer", render: (c) => <span className="font-semibold">{c.name}<span className="block text-xs font-normal text-slate-500">{c.phone}</span></span> },
          { key: "sub", header: "Subscription", render: (c) => (c.subscription ? <span>{c.subscription.plan} <Badge value={c.subscription.status} /></span> : "—") },
          { key: "sched", header: "Schedule", render: (c) => (c.schedule ? <span className="text-sm">{fmtTime(c.schedule.pickupTime)} · {c.schedule.serviceDays.map((d) => DAYS[d]).join(" ")}<span className="block max-w-56 truncate text-xs text-slate-500">{c.schedule.pickup}</span></span> : "—") },
        ]} />
      )}</Async>
    </>
  );
}

// when = "today" | "upcoming"
export function Schedule({ when }) {
  const state = useAsync(() => driverTrips({}), "upcoming");
  const today = todayIst();
  return (
    <>
      <PageHeader title={when === "today" ? "Today's schedule" : "Upcoming schedule"} subtitle={when === "today" ? fmtDay(today) : "Trips after today"} />
      <Async state={state}>{({ trips }) => {
        const rows = trips.filter((t) => (when === "today" ? t.date === today : t.date > today));
        return <TripTable role="driver" trips={rows} empty={<EmptyState icon="calendar" title={when === "today" ? "No trips today" : "No upcoming trips"} />} />;
      }}</Async>
    </>
  );
}

export function DriverTrips({ history = false }) {
  const [status, setStatus] = useState("");
  const state = useAsync(() => driverTrips(history ? { include: "all", status: "completed", order: "desc" } : { include: "all", status: status || undefined }), `${history}-${status}`);
  return (
    <>
      <PageHeader title={history ? "Completed trips" : "Trips"} />
      {!history && <Toolbar><Select label="Status" value={status} onChange={setStatus} options={[["", "All statuses"], ["confirmed", "Confirmed"], ["in_progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["scheduled", "Scheduled"]]} /></Toolbar>}
      <Async state={state}>{({ trips }) => <TripTable role="driver" trips={trips} />}</Async>
    </>
  );
}

export function DriverRatings() {
  const [page, setPage] = useState(1);
  const state = useAsync(() => driverRatings({ page, limit: 15 }), String(page));
  return (
    <>
      <PageHeader title="Ratings & feedback" subtitle="What customers said about your trips." />
      <Async state={state}>{(d) => (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Summary" className="h-fit">
            <p className="text-4xl font-extrabold">{d.summary.average ?? "—"}</p><Stars value={d.summary.average} size="h-5 w-5" /><p className="mt-1 text-sm text-slate-500">{d.summary.count} rating{d.summary.count === 1 ? "" : "s"}</p>
            <ul className="mt-4 space-y-1.5 text-sm">{[5, 4, 3, 2, 1].map((n) => <li key={n} className="flex items-center gap-2"><span className="w-4">{n}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-amber-400" style={{ width: `${d.summary.count ? (d.summary.distribution[n] / d.summary.count) * 100 : 0}%` }} /></div><span className="w-6 text-right text-slate-500">{d.summary.distribution[n]}</span></li>)}</ul>
          </Card>
          <div className="space-y-3 lg:col-span-2">
            {d.ratings.length === 0 ? <EmptyState icon="star" title="No ratings yet" hint="Ratings appear after customers rate completed trips." /> : d.ratings.map((r) => (
              <Card key={r.id}><div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-slate-400">{fmtDateTime(r.createdAt)}</span></div>{r.trip && <p className="mt-1 text-xs text-slate-500">Trip {fmtDay(r.trip.date)} · {r.trip.servicePeriod}</p>}{r.feedback ? <p className="mt-2 text-sm text-slate-800">“{r.feedback}”</p> : <p className="mt-2 text-sm text-slate-400">No written feedback.</p>}</Card>
            ))}
            <Pagination page={d.page} limit={d.limit} total={d.summary.count} onPage={setPage} />
          </div>
        </div>
      )}</Async>
    </>
  );
}

