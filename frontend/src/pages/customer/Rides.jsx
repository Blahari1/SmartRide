import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAsync, useAction } from "../../hooks/useAsync";
import { mySchedules } from "../../services/scheduleService";
import { myTrips } from "../../services/tripService";
import { myRatings, submitRating } from "../../services/ratingService";
import TrackingPanel from "../../components/TrackingPanel";
import { TripTable } from "../../components/Blocks";
import { Alert, Async, Badge, Button, Card, EmptyState, Field, LinkButton, PageHeader, Pagination, Select, StarInput, Stars, Toolbar } from "../../components/ui";
import { DAYS, dirLabel, fmtDate, fmtDateTime, fmtDay, fmtTime, inputClass } from "../../lib/format";

export function UpcomingSchedule() {
  const state = useAsync(() => mySchedules());
  return (
    <>
      <PageHeader title="Upcoming schedule" subtitle="Your recurring pickup schedules and the trips generated from them." />
      <Async state={state}>{({ schedules, trips }) => (
        <div className="space-y-6">
          <Card title="Schedules">{schedules.length ? <ul className="divide-y divide-slate-100">{schedules.map((s) => (
            <li key={s._id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><p className="font-semibold capitalize">{dirLabel(s.direction)} · {s.servicePeriod} · pickup {fmtTime(s.pickupTime)}, drop {fmtTime(s.dropTime)}</p><p className="text-slate-500">{s.serviceDays.map((d) => DAYS[d]).join(", ")} · {fmtDate(s.startDate)} → {fmtDate(s.endDate)}</p></div><Badge value={s.status} /></li>))}</ul>
            : <EmptyState icon="calendar" title="No schedule yet" hint="An administrator creates your schedule once your subscription is active and your locations are saved." />}</Card>
          <Card title="Upcoming trips" padded={false}><div className="p-3"><TripTable role="customer" trips={trips} empty={<p className="p-4 text-sm text-slate-500">No upcoming trips.</p>} /></div></Card>
        </div>
      )}</Async>
    </>
  );
}

const FILTERS = [["", "All statuses"], ["scheduled", "Scheduled"], ["confirmed", "Confirmed"], ["in_progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]];

export function TripList({ completedOnly = false }) {
  const [status, setStatus] = useState(completedOnly ? "completed" : "");
  const [page, setPage] = useState(1);
  const state = useAsync(() => myTrips({ status: completedOnly ? "completed" : status || undefined, page, limit: 15 }), `${status}-${page}-${completedOnly}`);
  return (
    <>
      <PageHeader title={completedOnly ? "Completed trips" : "My trips"} subtitle={completedOnly ? "Your trip history. Rate trips to help us improve." : "All trips, newest first."} />
      {!completedOnly && <Toolbar><Select label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={FILTERS} /></Toolbar>}
      <Async state={state}>{(d) => (
        <>
          <TripTable role="customer" trips={d.trips} empty={<EmptyState icon="car" title="No trips found" />} />
          {completedOnly && d.trips.some((t) => t.canRate) && <p className="mt-3 text-sm text-slate-500">Trips marked below are waiting for your rating: {d.trips.filter((t) => t.canRate).map((t) => <Link key={t.id} className="mr-2 font-semibold text-blue-700 underline" to={`/customer/ratings?trip=${t.id}`}>{fmtDay(t.date)}</Link>)}</p>}
          <Pagination page={d.page} limit={d.limit} total={d.total} onPage={setPage} />
        </>
      )}</Async>
    </>
  );
}

export function LiveTracking() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const list = useAsync(() => (tripId ? Promise.resolve(null) : myTrips({ status: "in_progress", limit: 5 })), tripId || "list");
  const next = useAsync(() => (tripId ? Promise.resolve(null) : myTrips({ status: "confirmed", order: "asc", limit: 3 })), tripId || "next");
  if (tripId) return <><PageHeader title="Live driver tracking" breadcrumbs={[{ label: "Trips", to: "/customer/trips" }, { label: "Tracking" }]} /><TrackingPanel tripId={tripId} /></>;
  return (
    <>
      <PageHeader title="Live driver tracking" subtitle="Your driver's location is visible only while your trip is in progress." />
      <Async state={list}>{(d) => d && d.trips.length ? (
        <div className="space-y-3">{d.trips.map((t) => <Card key={t.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{fmtDay(t.date)} · {fmtTime(t.pickupTime)}</p><p className="text-sm text-slate-500">{t.driver?.name}</p></div><Button onClick={() => navigate(`/customer/tracking/${t.id}`)}>Track now</Button></div></Card>)}</div>
      ) : (
        <Async state={next}>{(n) => <EmptyState icon="radio" title="No trip in progress" hint="Tracking becomes available when your driver starts a trip." action={n && n.trips[0] && <LinkButton to={`/customer/tracking/${n.trips[0].id}`}>Open next trip ({fmtDay(n.trips[0].date)})</LinkButton>} />}</Async>
      )}</Async>
    </>
  );
}

export function RatingsPage() {
  const [params, setParams] = useSearchParams();
  const state = useAsync(myRatings);
  const [form, setForm] = useState({ rating: 0, feedback: "" });
  const act = useAction();
  const target = params.get("trip");
  return (
    <>
      <PageHeader title="Ratings & feedback" subtitle="Rate completed trips and review what you have submitted." />
      <Alert kind="success">{act.success}</Alert>
      <Async state={state}>{(d) => {
        const pending = d.pending.find((p) => p.tripId === target) || null;
        return (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <Card title="Waiting for your rating">
              {d.pending.length === 0 ? <p className="text-sm text-slate-500">No completed trips are waiting for a rating.</p> : (
                <ul className="divide-y divide-slate-100">{d.pending.map((p) => <li key={p.tripId} className="flex items-center justify-between py-2.5 text-sm"><span>{fmtDay(p.date)} · {fmtTime(p.pickupTime)} · {p.driver}</span><Button size="sm" variant={p.tripId === target ? "primary" : "secondary"} onClick={() => { act.clear(); setForm({ rating: 0, feedback: "" }); setParams({ trip: p.tripId }); }}>Rate</Button></li>)}</ul>
              )}
              {pending && (
                <form className="mt-5 space-y-4 border-t border-slate-100 pt-5" onSubmit={(e) => { e.preventDefault(); act.run(async () => { await submitRating(pending.tripId, form.rating, form.feedback.trim()); setParams({}); state.reload(); }, "Thank you! Your rating was submitted."); }}>
                  <p className="text-sm font-semibold">How was your trip on {fmtDay(pending.date)} with {pending.driver}?</p>
                  <StarInput value={form.rating} onChange={(rating) => setForm({ ...form, rating })} />
                  <Field label="Feedback (optional)" hint={`${form.feedback.length}/500`}><textarea className={inputClass} rows={3} maxLength={500} value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} /></Field>
                  <Alert>{act.error}</Alert>
                  <Button type="submit" busy={act.busy} disabled={!form.rating}>Submit rating</Button>
                </form>
              )}
            </Card>
            <Card title="Your ratings">
              {d.ratings.length === 0 ? <p className="text-sm text-slate-500">You have not rated any trips yet.</p> : (
                <ul className="divide-y divide-slate-100">{d.ratings.map((r) => <li key={r.id} className="py-3 text-sm"><div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-slate-400">{fmtDateTime(r.createdAt)}</span></div><p className="mt-1 text-slate-500">{r.trip ? `${fmtDay(r.trip.date)} · ${r.driver}` : r.driver}</p>{r.feedback && <p className="mt-1 text-slate-800">“{r.feedback}”</p>}</li>)}</ul>
              )}
            </Card>
          </div>
        );
      }}</Async>
    </>
  );
}

