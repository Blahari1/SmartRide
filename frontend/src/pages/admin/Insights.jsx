import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/authStore";
import { useAsync } from "../../hooks/useAsync";
import { getReport } from "../../services/adminService";
import { listRatings } from "../../services/ratingService";
import { listDrivers } from "../../services/driverService";
import { Alert, Async, Button, Card, DataTable, DL, EmptyState, PageHeader, Pagination, Select, StatCard, Stars, Toolbar } from "../../components/ui";
import { Donut, HBars, StackedBars } from "../../components/charts";
import { addDays, downloadText, fmtDate, fmtDateTime, fmtDay, inr, todayIst, toCsv } from "../../lib/format";

export function AdminRatings() {
  const [driverId, setDriverId] = useState("");
  const [rating, setRating] = useState("");
  const [page, setPage] = useState(1);
  const drivers = useAsync(() => listDrivers("approved"));
  const state = useAsync(() => listRatings({ driverId: driverId || undefined, rating: rating || undefined, page, limit: 15 }), `${driverId}|${rating}|${page}`);
  return (
    <>
      <PageHeader title="Ratings & feedback" subtitle="Customer feedback on completed trips." />
      <Toolbar>
        <Select label="Driver" value={driverId} onChange={(v) => { setDriverId(v); setPage(1); }} options={[["", "All drivers"], ...((drivers.data?.drivers || []).map((d) => [d._id, d.fullName]))]} />
        <Select label="Stars" value={rating} onChange={(v) => { setRating(v); setPage(1); }} options={[["", "Any rating"], ...[5, 4, 3, 2, 1].map((n) => [String(n), `${n} star${n > 1 ? "s" : ""}`])]} />
      </Toolbar>
      <Async state={state}>{(d) => (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Summary" className="h-fit"><p className="text-4xl font-extrabold">{d.summary.average ?? "—"}</p><Stars value={d.summary.average} size="h-5 w-5" /><p className="mb-4 mt-1 text-sm text-slate-500">{d.summary.count} rating{d.summary.count === 1 ? "" : "s"}</p>
            <HBars items={[5, 4, 3, 2, 1].map((n) => ({ label: `${n} star${n > 1 ? "s" : ""}`, value: d.summary.distribution[n], color: "#f59e0b" }))} /></Card>
          <div className="space-y-3 lg:col-span-2">
            {d.ratings.length === 0 ? <EmptyState icon="star" title="No ratings match" /> : d.ratings.map((r) => (
              <Card key={r.id}><div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-slate-400">{fmtDateTime(r.createdAt)}</span></div>
                <p className="mt-1 text-sm text-slate-500">{r.customer} → {r.driver ? <Link className="text-blue-700 hover:underline" to={`/admin/drivers/${r.driver.id}`}>{r.driver.name}</Link> : "—"} · <Link className="text-blue-700 hover:underline" to={`/admin/trips/${r.tripId}`}>trip</Link></p>
                {r.feedback ? <p className="mt-2 text-sm text-slate-800">“{r.feedback}”</p> : <p className="mt-2 text-sm text-slate-400">No written feedback.</p>}</Card>))}
            <Pagination page={d.page} limit={d.limit} total={d.total} onPage={setPage} />
          </div>
        </div>
      )}</Async>
    </>
  );
}

export function Reports() {
  const [range, setRange] = useState({ from: addDays(todayIst(), -29), to: todayIst() });
  const [draft, setDraft] = useState(range);
  const state = useAsync(() => getReport(range), `${range.from}|${range.to}`);
  const valid = draft.from && draft.to && draft.from <= draft.to;
  const preset = (days) => { const r = { from: addDays(todayIst(), -(days - 1)), to: todayIst() }; setDraft(r); setRange(r); };
  return (
    <>
      <PageHeader title="Reports and summaries" subtitle="Figures for the selected IST date range, computed from the database." />
      <Toolbar>
        <label className="text-xs font-semibold text-slate-500">From <input type="date" className="ml-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={draft.from} max={draft.to} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
        <label className="text-xs font-semibold text-slate-500">To <input type="date" className="ml-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={draft.to} min={draft.from} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
        <Button variant="primary" disabled={!valid} onClick={() => setRange(draft)}>Apply</Button>
        <Button variant="secondary" onClick={() => preset(7)}>Last 7 days</Button><Button variant="secondary" onClick={() => preset(30)}>Last 30 days</Button><Button variant="secondary" onClick={() => preset(90)}>Last 90 days</Button>
      </Toolbar>
      <Async state={state}>{({ report: r }) => {
        const tripTotal = Object.values(r.trips.byStatus).reduce((a, b) => a + b, 0);
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Trips in range" value={tripTotal} icon="route" hint={`${r.trips.byStatus.completed} completed · ${r.trips.byStatus.cancelled} cancelled`} />
                <StatCard label="New subscriptions" value={Object.values(r.subscriptions.byStatus).reduce((a, b) => a + b, 0)} icon="layers" hint={`${r.subscriptions.byStatus.active} active now`} />
              <StatCard label="Average rating" value={r.ratings.average ?? "—"} icon="star" tone="amber" hint={`${r.ratings.count} ratings`} />
            </div>
            <Card title="Trips per day"><StackedBars data={r.trips.byDay.map((d) => ({ ...d, label: fmtDay(d.date), short: r.trips.byDay.length <= 31 ? d.date.slice(8) : "" }))} series={[{ key: "completed", label: "Completed", color: "#059669" }, { key: "other", label: "Scheduled / in progress", color: "#2563eb" }, { key: "cancelled", label: "Cancelled", color: "#94a3b8" }]} /></Card>
            <div className="grid gap-6 lg:grid-cols-3">
    
              <Card title="Subscriptions by plan">{r.subscriptions.byPlan.length ? <HBars items={r.subscriptions.byPlan.map((p) => ({ label: p.plan, value: p.count, display: `${p.count} · ${inr(p.valuePaise)}` }))} /> : <p className="text-sm text-slate-500">No subscriptions in this range.</p>}</Card>
              <Card title="Ratings"><HBars items={[5, 4, 3, 2, 1].map((n) => ({ label: `${n} star${n > 1 ? "s" : ""}`, value: r.ratings.distribution[n], color: "#f59e0b" }))} /></Card>
            </div>
            <Card title="Driver performance" actions={<Button size="sm" variant="secondary" disabled={!r.drivers.length} onClick={() => downloadText(`driver-report-${r.range.from}-${r.range.to}.csv`, toCsv([["Driver", "Completed trips", "Ratings", "Average rating"], ...r.drivers.map((d) => [d.name, d.completedTrips, d.ratings, d.averageRating ?? ""])]))}>Export CSV</Button>} padded={false}>
              <div className="p-3"><DataTable rows={r.drivers} rowKey={(d) => d.driverId} empty={<p className="p-3 text-sm text-slate-500">No driver activity in this range.</p>} columns={[{ key: "n", header: "Driver", render: (d) => <Link className="font-semibold text-blue-700 hover:underline" to={`/admin/drivers/${d.driverId}`}>{d.name}</Link> }, { key: "c", header: "Completed trips", render: (d) => d.completedTrips }, { key: "r", header: "Ratings received", render: (d) => d.ratings }, { key: "a", header: "Average", render: (d) => (d.averageRating ? <Stars value={d.averageRating} showValue /> : "—") }]} /></div>
            </Card>
            <p className="text-xs text-slate-500">Range {fmtDate(r.range.from)} – {fmtDate(r.range.to)}.</p>
          </div>
        );
      }}</Async>
    </>
  );
}

export function AdminProfile() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Admin profile" subtitle="Administrator accounts are created only through the secure server-side script." />
      <Card className="max-w-xl"><DL items={[["Name", user.name], ["Email", user.email], ["Phone", user.phone], ["Role", "Administrator"]]} />
        <div className="mt-4"><Alert kind="info">Update your name, phone or password in <Link className="font-semibold underline" to="/admin/settings">Settings</Link>.</Alert></div></Card>
    </>
  );
}
