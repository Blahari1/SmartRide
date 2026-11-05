import { Link } from "react-router-dom";
import { useAsync } from "../../hooks/useAsync";
import { getDashboard } from "../../services/adminService";
import { Async, Card, PageHeader, StatCard, Stars } from "../../components/ui";
import { Donut, HBars, StackedBars } from "../../components/charts";
import { fmtDate, fmtDay, inr } from "../../lib/format";

export default function AdminDashboard() {
  const state = useAsync(getDashboard);
  return (
    <>
      <PageHeader title="Admin dashboard" subtitle="Live figures from the SmartRide database." actions={<button type="button" className="text-sm font-semibold text-blue-700 hover:underline" onClick={state.reload}>Refresh</button>} />
      <Async state={state}>{({ stats: s, charts: c, recentFeedback }) => (
        <div className="space-y-8">
          <section aria-label="People"><h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">People</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Customers" value={s.totalCustomers} icon="users" to="/admin/customers" />
              <StatCard label="Drivers" value={s.totalDrivers} icon="user" to="/admin/drivers" hint={`${s.approvedDrivers} approved · ${s.rejectedDrivers} rejected`} />
              <StatCard label="Approved drivers" value={s.approvedDrivers} icon="check" tone="green" to="/admin/drivers?status=approved" />
              <StatCard label="Rejected drivers" value={s.rejectedDrivers} icon="x" tone={s.rejectedDrivers ? "red" : "slate"} to="/admin/drivers?status=rejected" />
              <StatCard label="Pending verifications" value={s.pendingDrivers} icon="shield" tone={s.pendingDrivers ? "amber" : "slate"} to="/admin/drivers/verification" />
            </div></section>
          <section aria-label="Subscription management"><h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Subscription management</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Per-kilometre pricing" value="Manage" icon="tag" to="/admin/pricing" hint="Configure ₹5–₹10 per km" />
              <StatCard label="Active subscriptions" value={s.activeSubscriptions} icon="layers" tone="green" to="/admin/subscriptions?status=active" />
              <StatCard label="Requests awaiting drivers" value={s.pendingSubscriptions} icon="clock" tone="amber" to="/admin/subscriptions?status=pending" />
            </div></section>
          <section aria-label="Operations"><h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Operations</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Open schedules" value={s.upcomingSchedules} icon="calendar" to="/admin/schedules" />
              <StatCard label="Active trips" value={s.activeTrips} icon="radio" tone="indigo" to="/admin/live" />
              <StatCard label="Completed trips" value={s.completedTrips} icon="check" tone="green" to="/admin/trips?status=completed" />
              <StatCard label="Cancelled trips" value={s.cancelledTrips} icon="x" tone="slate" to="/admin/trips?status=cancelled" />
              <StatCard label="Trips today" value={s.todaysTrips} icon="route" to="/admin/trips" />
              <StatCard label="Upcoming trips without driver" value={s.unassignedUpcomingTrips} icon="alert" tone={s.unassignedUpcomingTrips ? "amber" : "slate"} to="/admin/schedules" />
              <StatCard label="Average driver rating" value={s.averageRating ?? "—"} icon="star" tone="amber" hint={`${s.totalRatings} ratings`} to="/admin/ratings" />
            </div></section>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Trips, last 14 days" className="lg:col-span-2"><StackedBars data={c.tripsLast14Days.map((d) => ({ ...d, label: fmtDay(d.date), short: d.date.slice(8) }))} series={[{ key: "completed", label: "Completed", color: "#059669" }, { key: "other", label: "Scheduled / in progress", color: "#2563eb" }, { key: "cancelled", label: "Cancelled", color: "#94a3b8" }]} /></Card>
            <Card title="Subscriptions"><Donut segments={[{ label: "Active", value: c.subscriptionsByStatus.active, color: "#059669" }, { label: "Pending", value: c.subscriptionsByStatus.pending, color: "#d97706" }, { label: "Expired", value: c.subscriptionsByStatus.expired, color: "#94a3b8" }, { label: "Cancelled", value: c.subscriptionsByStatus.cancelled, color: "#dc2626" }]} /></Card>

            <Card title="Rating distribution"><HBars items={[5, 4, 3, 2, 1].map((n) => ({ label: `${n} star${n > 1 ? "s" : ""}`, value: c.ratingDistribution[n], color: "#f59e0b" }))} /></Card>
          </div>
          <Card title="Recent feedback" actions={<Link className="text-sm font-semibold text-blue-700" to="/admin/ratings">All feedback</Link>}>
            {recentFeedback.length ? <ul className="divide-y divide-slate-100">{recentFeedback.map((r) => <li key={r.id} className="py-3 text-sm"><div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-slate-400">{fmtDate(r.createdAt)}</span></div><p className="mt-1 text-slate-500">{r.customer} → {r.driver}</p>{r.feedback && <p className="text-slate-800">“{r.feedback}”</p>}</li>)}</ul> : <p className="text-sm text-slate-500">No feedback yet.</p>}
          </Card>
        </div>
      )}</Async>
    </>
  );
}
