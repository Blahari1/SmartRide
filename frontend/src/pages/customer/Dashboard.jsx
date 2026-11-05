import { Link } from "react-router-dom";
import { useAuth } from "../../context/authStore";
import { useAsync } from "../../hooks/useAsync";
import { customerDashboard } from "../../services/tripService";
import { Alert, Async, Badge, Card, DL, EmptyState, LinkButton, PageHeader, StatCard } from "../../components/ui";
import { SubscriptionSummary, TripTable } from "../../components/Blocks";
import { ago, fmtDay, fmtTime } from "../../lib/format";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const state = useAsync(customerDashboard);
  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle="Your subscription, upcoming rides and recent activity." />
      <Async state={state}>{(d) => {
        const sub = d.subscription;
        const noLocations = !d.profile.pickupLocation || !d.profile.dropLocation;
        return (
          <div className="space-y-6">
            {noLocations && <Alert kind="warning">Set your pickup and drop locations so schedules can be created. <Link className="font-semibold underline" to="/customer/locations/pickup">Add locations</Link></Alert>}
            {d.activeTrip && <Alert kind="info">Your trip is in progress. <Link className="font-semibold underline" to={`/customer/tracking/${d.activeTrip.id}`}>Track your driver live</Link></Alert>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Subscription" value={sub ? <span className="capitalize">{sub.status}</span> : "None"} icon="layers" tone={sub?.status === "active" ? "green" : "amber"} hint={sub?.planSnapshot.name} to="/customer/subscriptions" />
              <StatCard label="Next trip" value={d.nextTrip ? fmtDay(d.nextTrip.date) : "None"} icon="calendar" hint={d.nextTrip && fmtTime(d.nextTrip.pickupTime)} to="/customer/schedule" />
              <StatCard label="Unread notifications" value={d.unreadNotifications} icon="bell" tone={d.unreadNotifications ? "red" : "slate"} to="/customer/notifications" />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card title="Current subscription" className="lg:col-span-1">
                {sub ? <SubscriptionSummary sub={sub} to={`/customer/subscriptions/${sub._id}`} /> : <EmptyState icon="tag" title="No subscription yet" hint="Choose a plan to get started." action={<LinkButton variant="primary" to="/customer/plans">Browse plans</LinkButton>} />}
              </Card>
              <Card title="Next scheduled trip">
                {d.nextTrip ? (
                  <div className="space-y-3">
                    <DL cols={1} items={[["When", `${fmtDay(d.nextTrip.date)} · ${fmtTime(d.nextTrip.pickupTime)}`], ["Pickup", d.nextTrip.pickupLocation?.address], ["Drop", d.nextTrip.dropLocation?.address], ["Driver", d.nextTrip.driver ? `${d.nextTrip.driver.name}${d.nextTrip.driver.phone ? ` · ${d.nextTrip.driver.phone}` : ""}` : "Not assigned yet"], ["Status", <Badge key="s" value={d.nextTrip.status} />]]} />
                    <LinkButton size="sm" to={`/customer/trips/${d.nextTrip.id}`}>Trip details</LinkButton>
                  </div>
                ) : <EmptyState icon="calendar" title="No upcoming trips" hint="Trips appear after an approved driver accepts your commute request." />}
              </Card>
            </div>
            <Card title="Upcoming trips" actions={<Link className="text-sm font-semibold text-blue-700" to="/customer/schedule">View schedule</Link>} padded={false}>
              <div className="p-3"><TripTable role="customer" trips={d.upcomingTrips} empty={<p className="p-4 text-sm text-slate-500">No upcoming trips.</p>} /></div>
            </Card>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Recent trips" actions={<Link className="text-sm font-semibold text-blue-700" to="/customer/trips/history">All completed trips</Link>}>
                {d.recentTrips.length ? <ul className="divide-y divide-slate-100">{d.recentTrips.map((t) => <li key={t.id} className="flex items-center justify-between py-2.5 text-sm"><Link className="font-medium text-blue-700 hover:underline" to={`/customer/trips/${t.id}`}>{fmtDay(t.date)} · {fmtTime(t.pickupTime)}</Link><span className="text-slate-500">{t.driver?.name}</span></li>)}</ul> : <p className="text-sm text-slate-500">No completed trips yet.</p>}
              </Card>
              <Card title="Rate your trips" actions={<Link className="text-sm font-semibold text-blue-700" to="/customer/ratings">Ratings</Link>}>
                {d.pendingRatings.length ? <ul className="divide-y divide-slate-100">{d.pendingRatings.map((t) => <li key={t.tripId} className="flex items-center justify-between py-2.5 text-sm"><span>{fmtDay(t.date)} · {fmtTime(t.pickupTime)}</span><LinkButton size="sm" variant="primary" to={`/customer/ratings?trip=${t.tripId}`}>Rate</LinkButton></li>)}</ul> : <p className="text-sm text-slate-500">No trips are waiting for a rating.</p>}
              </Card>
            </div>
            <Card title="Recent notifications" actions={<Link className="text-sm font-semibold text-blue-700" to="/customer/notifications">View all</Link>}>
              {d.notifications.length ? <ul className="divide-y divide-slate-100">{d.notifications.map((n) => <li key={n._id} className="py-2.5 text-sm"><p className="font-semibold">{n.title}</p><p className="text-slate-600">{n.message}</p><p className="text-xs text-slate-400">{ago(n.createdAt)}</p></li>)}</ul> : <p className="text-sm text-slate-500">Nothing yet.</p>}
            </Card>
          </div>
        );
      }}</Async>
    </>
  );
}
