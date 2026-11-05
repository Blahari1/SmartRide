import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAsync, useAction } from "../../hooks/useAsync";
import { listSchedules, getSchedule, cancelSchedule, generateTrips, listTrips } from "../../services/scheduleService";
import { Alert, Async, Badge, Button, Card, DataTable, DL, EmptyState, PageHeader, Select, Toolbar } from "../../components/ui";
import { DAYS, dirShort, fmtDate, fmtDateTime, fmtTime } from "../../lib/format";

export function ScheduleList() {
  const [status, setStatus] = useState("");
  const state = useAsync(() => listSchedules({ status: status || undefined }), status);
  return (
    <>
      <PageHeader title="Recurring pickup schedules" subtitle="Schedules are created automatically when a driver accepts a customer commute request." actions={<Button variant="secondary" onClick={state.reload}>Refresh</Button>} />
      <Toolbar><Select label="Schedule status" value={status} onChange={setStatus} options={[["", "All schedules"], ["confirmed", "Confirmed"], ["scheduled", "Scheduled"], ["cancelled", "Cancelled"]]} /></Toolbar>
      <Async state={state}>{({ schedules = [] }) => (
        <DataTable rows={schedules} empty={<EmptyState icon="calendar" title="No schedules yet" hint="Schedules will appear after a driver accepts a customer request." />} columns={[
          { key: "customer", header: "Customer", render: (s) => <span className="font-semibold">{s.userId?.name || "—"}<span className="block text-xs font-normal text-slate-500">{s.userId?.phone || ""}</span></span> },
          { key: "driver", header: "Accepted driver", render: (s) => s.driverId?.fullName || "—" },
          { key: "route", header: "Pickup → Drop", render: (s) => <span className="block max-w-64 truncate">{s.pickupLocation?.address || "—"}<span className="block text-xs text-slate-500">{s.dropLocation?.address || "—"}</span></span> },
          { key: "time", header: "Pickup / drop", render: (s) => `${fmtTime(s.pickupTime)} / ${fmtTime(s.dropTime)}` },
          { key: "days", header: "Weekdays", render: (s) => (s.serviceDays || []).map((d) => DAYS[d]).join(", ") },
          { key: "term", header: "Subscription term", render: (s) => `${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}` },
          { key: "status", header: "Status", render: (s) => <Badge value={s.status} /> },
          { key: "open", header: "", render: (s) => <Link className="font-semibold text-blue-700 hover:underline" to={`/admin/schedules/${s._id}`}>View</Link> },
        ]} />
      )}</Async>
    </>
  );
}

export function ScheduleDetail() {
  const { id } = useParams();
  const state = useAsync(() => getSchedule(id), id);
  const act = useAction();
  const [reason, setReason] = useState("");
  return (
    <Async state={state}>{({ schedule: s, trips = [] }) => (
      <>
        <PageHeader title="Recurring commute schedule" subtitle="Created when the assigned driver accepted the customer's request." breadcrumbs={[{ label: "Schedules", to: "/admin/schedules" }, { label: "Details" }]} actions={<Button variant="secondary" onClick={state.reload}>Refresh</Button>} />
        <Alert kind="success">{act.success}</Alert><Alert>{act.error}</Alert>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Customer and driver"><DL cols={1} items={[
            ["Customer", s.userId?.name || "—"], ["Customer phone", s.userId?.phone || "—"],
            ["Assigned driver", s.driverId?.fullName || "—"], ["Driver phone", s.driverId?.phone || "—"],
            ["Direction", dirShort(s.direction || "outbound")],
            ["Subscription", s.subscriptionId?._id || s.subscriptionId || "—"],
            ["Status", <Badge key="status" value={s.status} />],
          ]} /></Card>
          <Card title="Pickup and drop"><DL cols={1} items={[
            ["Pickup address", s.pickupLocation?.address], ["Pickup landmark", s.pickupLocation?.landmark || "—"],
            ["Pickup time", fmtTime(s.pickupTime)], ["Drop address", s.dropLocation?.address],
            ["Drop landmark", s.dropLocation?.landmark || "—"], ["Drop time", fmtTime(s.dropTime)],
            ["Weekdays", (s.serviceDays || []).map((d) => DAYS[d]).join(", ")],
            ["Term", `${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}`],
          ]} /></Card>
        </div>
        <Card title="Upcoming trips" className="mt-5">
          <DataTable rows={trips} empty={<EmptyState title="No upcoming trips in the current generation window" />} columns={[
            { key: "date", header: "Date", render: (t) => fmtDate(t.date) },
            { key: "time", header: "Pickup / drop", render: (t) => `${fmtTime(t.pickupTime)} / ${fmtTime(t.dropTime)}` },
            { key: "status", header: "Status", render: (t) => <Badge value={t.status} /> },
            { key: "trip", header: "", render: (t) => <Link className="font-semibold text-blue-700 hover:underline" to={`/admin/trips/${t._id}`}>Trip details</Link> },
          ]} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" busy={act.busy} onClick={() => act.run(() => generateTrips(s._id), "Upcoming trips refreshed.").then(state.reload)}>Refresh trip window</Button>
            {s.status !== "cancelled" && <Button variant="danger" busy={act.busy} disabled={reason.trim().length < 5} onClick={() => act.run(() => cancelSchedule(s._id, reason.trim()), "Schedule cancelled.").then(state.reload)}>Cancel schedule</Button>}
          </div>
          {s.status !== "cancelled" && <label className="mt-3 block text-sm"><span className="mb-1 block font-medium">Cancellation reason (5+ characters)</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
        </Card>
      </>
    )}</Async>
  );
}

export function TripList() {
  const [status, setStatus] = useState("");
  const state = useAsync(() => listTrips({ status: status || undefined }), status);
  return (
    <>
      <PageHeader title="Trips" subtitle="Individual service-day journeys generated from recurring customer schedules." actions={<Button variant="secondary" onClick={state.reload}>Refresh</Button>} />
      <Toolbar><Select label="Trip status" value={status} onChange={setStatus} options={[["", "All trips"], ["scheduled", "Scheduled"], ["confirmed", "Confirmed"], ["in_progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]]} /></Toolbar>
      <Async state={state}>{({ trips = [] }) => (
        <DataTable rows={trips} empty={<EmptyState icon="route" title="No trips found" />} columns={[
          { key: "date", header: "Date", render: (t) => fmtDate(t.date) },
          { key: "customer", header: "Customer", render: (t) => t.userId?.name || "—" },
          { key: "driver", header: "Driver", render: (t) => t.driverId?.fullName || "Not assigned" },
          { key: "route", header: "Pickup → Drop", render: (t) => <span className="block max-w-64 truncate">{t.pickupLocation?.address || "—"}<span className="block text-xs text-slate-500">{t.dropLocation?.address || "—"}</span></span> },
          { key: "time", header: "Pickup / drop", render: (t) => `${fmtTime(t.pickupTime)} / ${fmtTime(t.dropTime)}` },
          { key: "status", header: "Status", render: (t) => <Badge value={t.status} /> },
          { key: "open", header: "", render: (t) => <Link className="font-semibold text-blue-700 hover:underline" to={`/admin/trips/${t._id}`}>View</Link> },
        ]} />
      )}</Async>
    </>
  );
}
