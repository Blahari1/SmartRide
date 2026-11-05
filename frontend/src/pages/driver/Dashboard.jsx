import { Link } from "react-router-dom";
import { useAuth } from "../../context/authStore";
import { useAsync, useAction } from "../../hooks/useAsync";
import { getDriverDashboard, setMyAvailability } from "../../services/driverService";
import { Alert, Async, Badge, Button, Card, EmptyState, LinkButton, PageHeader, StatCard, Stars } from "../../components/ui";
import { ago, fmtDay, fmtTime } from "../../lib/format";

function SetupCard({ profile }) {
  const rejected = profile?.verificationStatus === "rejected";
  const docs = Array.isArray(profile?.documents) ? profile.documents : [];
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-800 to-blue-900 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Driver onboarding</p>
        <h2 className="mt-2 text-2xl font-bold">{rejected ? "A few updates are needed" : "Your driver account is under review"}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
          {rejected
            ? "Review the administrator's feedback, update your driver details or documents, and submit them again for verification."
            : "Complete your driver details and licence documents. Once an administrator verifies your profile, customer commute requests will appear in your workspace."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <LinkButton to="/driver/profile/edit" variant="primary">{rejected ? "Update driver details" : "Complete driver profile"}</LinkButton>
          <LinkButton to="/driver/documents" variant="secondary">Review documents</LinkButton>
        </div>
      </div>
      {rejected && profile.rejectionReason && <Alert kind="error">Administrator feedback: {profile.rejectionReason}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Driver details">
          <p className="text-sm text-slate-600">{profile.fullName || "Not submitted"}</p>
          <Badge value={profile.fullName ? "submitted" : "required"} tone={profile.fullName ? "green" : "amber"} />
        </Card>
        <Card title="Driving licence">
          <p className="text-sm text-slate-600">{profile.licenseNumber || "Not submitted"}</p>
          <Badge value={profile.licenseNumber ? "submitted" : "required"} tone={profile.licenseNumber ? "green" : "amber"} />
        </Card>
        <Card title="Supporting documents">
          <p className="text-sm text-slate-600">{docs.length} document reference(s)</p>
          <Badge value={docs.length ? "submitted" : "required"} tone={docs.length ? "green" : "amber"} />
        </Card>
      </div>
      <Card title="Verification progress">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">{rejected ? "Changes requested" : "Waiting for admin verification"}</p>
            <p className="mt-1 text-sm text-slate-500">You will be able to accept customer requests after approval.</p>
          </div>
          <Badge value={profile.verificationStatus || "pending"} tone={rejected ? "red" : "amber"} />
        </div>
      </Card>
    </div>
  );
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const state = useAsync(getDriverDashboard);
  const act = useAction();
  const firstName = (user?.name || "Driver").trim().split(/\\s+/)[0];
  return (
    <>
      <PageHeader title={`Welcome back, ${firstName}`} subtitle="Your SmartRide driver workspace." />
      <Async state={state}>{(d) => {
        if (!d.profile) return (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-r from-slate-950 to-blue-900 p-7 text-white">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-200">Welcome to SmartRide</p>
              <h2 className="mt-2 text-2xl font-bold">Start your driver journey</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-200">Create your driver profile and submit your licence information to begin the admin verification process.</p>
              <LinkButton className="mt-5" to="/driver/profile/edit" variant="primary">Set up my profile</LinkButton>
            </div>
            <EmptyState icon="shield" title="Verification required" hint="Your driver tools will become available after your profile is submitted and approved." />
          </div>
        );
        if (!d.approved) return <SetupCard profile={d.profile} />;

        const { stats: s = {} } = d;
        const nextTrips = Array.isArray(d.nextTrips) ? d.nextTrips : [];
        const notifications = Array.isArray(d.notifications) ? d.notifications : [];
        const recentRatings = Array.isArray(d.recentRatings) ? d.recentRatings : [];
        const rating = d.rating || {};
        const available = d.profile.availability === "available";
        const nextTrip = nextTrips[0];

        return (
          <div className="space-y-6">
            <Alert>{act.error}</Alert>
            {d.activeTrip && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Live trip in progress</p>
                    <p className="mt-1 font-semibold text-slate-900">{d.activeTrip.customer?.name || "Customer"} · {fmtTime(d.activeTrip.pickupTime)}</p>
                    <p className="mt-1 text-sm text-slate-600">{d.activeTrip.pickupLocation?.address || "Pickup location"}</p>
                  </div>
                  <LinkButton to="/driver/active-trip" variant="primary">Open active trip</LinkButton>
                </div>
              </div>
            )}

            <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-800 to-blue-900 p-6 text-white shadow-sm sm:p-8">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">Verified driver</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${available ? "bg-emerald-400/20 text-emerald-100" : "bg-amber-300/20 text-amber-100"}`}>{available ? "Available for requests" : "Currently unavailable"}</span>
                  </div>
                  <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Make every commute count.</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-200">Review customer requests, plan your pickup times and keep your accepted trips on schedule.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <LinkButton to="/driver/requests" variant="primary">Browse requests</LinkButton>
                  <Button variant="secondary" busy={act.busy} onClick={() => act.run(async () => { await setMyAvailability(available ? "unavailable" : "available"); state.reload(); })}>
                    {available ? "Pause availability" : "Go available"}
                  </Button>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <div><h2 className="text-base font-bold text-slate-900">Your work overview</h2><p className="text-sm text-slate-500">A quick summary of your driving activity.</p></div>
                <Badge value={d.profile.verificationStatus} tone="green" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard label="Open requests" value={s.availableRequests ?? 0} icon="inbox" tone="indigo" to="/driver/requests" hint="Requests you can review" />
                <StatCard label="Today's trips" value={s.todayTrips ?? 0} icon="calendar" to="/driver/schedule/today" />
                <StatCard label="Upcoming trips" value={s.upcomingTrips ?? 0} icon="route" to="/driver/schedule/upcoming" />
                <StatCard label="Completed trips" value={s.completedTrips ?? 0} icon="check" tone="green" to="/driver/trips/history" />
                <StatCard label="My customers" value={s.assignedCustomers ?? 0} icon="users" to="/driver/customers" />
                <StatCard label="Driver rating" value={rating.average ?? "—"} icon="star" tone="amber" hint={`${rating.count ?? 0} customer rating(s)`} to="/driver/ratings" />
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-3">
              <Card title="Next pickup" className="xl:col-span-2" actions={<Link className="text-sm font-semibold text-blue-700 hover:underline" to="/driver/schedule/upcoming">Full schedule</Link>}>
                {nextTrip ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className="text-lg font-bold text-slate-900">{fmtDay(nextTrip.date)}</p><p className="mt-1 text-sm text-slate-500">{nextTrip.customer?.name || "Customer"} · Pickup at {fmtTime(nextTrip.pickupTime)}</p></div>
                      <Badge value={nextTrip.status} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pickup</p><p className="mt-1 text-sm font-medium text-slate-800">{nextTrip.pickupLocation?.address || "Pickup location not available"}</p></div>
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drop</p><p className="mt-1 text-sm font-medium text-slate-800">{nextTrip.dropLocation?.address || "Drop location not available"}</p></div>
                    </div>
                    <Link className="inline-flex text-sm font-semibold text-blue-700 hover:underline" to={`/driver/trips/${nextTrip.id}`}>View trip details →</Link>
                  </div>
                ) : (
                  <div className="py-5 text-center"><p className="font-semibold text-slate-800">Your schedule is clear</p><p className="mt-1 text-sm text-slate-500">Accept a customer request to start building your commute schedule.</p><Link className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline" to="/driver/requests">Explore available requests →</Link></div>
                )}
              </Card>
              <Card title="Driver status">
                <div className="space-y-4">
                  <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Verification</span><Badge value={d.profile.verificationStatus} tone="green" /></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Availability</span><Badge value={d.profile.availability} /></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-800">Control your availability</p><p className="mt-1 text-xs leading-5 text-slate-500">Pause new requests when you are busy. Your existing accepted trips remain visible in your schedule.</p></div>
                  <Button block variant="secondary" busy={act.busy} onClick={() => act.run(async () => { await setMyAvailability(available ? "unavailable" : "available"); state.reload(); })}>{available ? "Set unavailable" : "Set available"}</Button>
                </div>
              </Card>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <Card title="Recent customer feedback" actions={<Link className="text-sm font-semibold text-blue-700 hover:underline" to="/driver/ratings">View all</Link>}>
                {recentRatings.length ? <ul className="divide-y divide-slate-100">{recentRatings.map((r) => <li key={r.id} className="py-3"><div className="flex items-center justify-between gap-2"><Stars value={r.rating} /><span className="text-xs text-slate-400">{ago(r.createdAt)}</span></div>{r.feedback && <p className="mt-2 text-sm text-slate-700">“{r.feedback}”</p>}</li>)}</ul> : <EmptyState icon="star" title="No feedback yet" hint="Customer ratings will appear here after completed trips." />}
              </Card>
              <Card title={`Notifications${d.unreadNotifications ? ` · ${d.unreadNotifications} unread` : ""}`} actions={<Link className="text-sm font-semibold text-blue-700 hover:underline" to="/driver/notifications">View all</Link>}>
                {notifications.length ? <ul className="divide-y divide-slate-100">{notifications.map((n) => <li key={n._id} className="py-3"><p className="font-semibold text-slate-800">{n.title}</p><p className="mt-1 text-sm text-slate-600">{n.message}</p><p className="mt-1 text-xs text-slate-400">{ago(n.createdAt)}</p></li>)}</ul> : <EmptyState icon="bell" title="You're all caught up" hint="Updates about customer requests and trips will appear here." />}
              </Card>
            </section>
          </div>
        );
      }}</Async>
    </>
  );
}
