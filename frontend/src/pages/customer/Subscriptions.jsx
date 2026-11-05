import FareBreakdown from "../../components/FareBreakdown";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAsync, useAction } from "../../hooks/useAsync";
import { cancelSubscription, getSubscription, mySubscriptions } from "../../services/subscriptionService";
import { Alert, Async, Badge, Card, ConfirmDialog, DL, EmptyState, LinkButton, PageHeader, Button } from "../../components/ui";
import { SubscriptionSummary } from "../../components/Blocks";
import { fmtDate, fmtDateTime, inr } from "../../lib/format";

export function MySubscriptions() {
  const state = useAsync(mySubscriptions);
  return (
    <>
      <PageHeader title="My subscriptions" actions={<LinkButton variant="primary" to="/customer/plans">Browse plans</LinkButton>} />
      <Async state={state}>{(d) => {
        const open = d.subscriptions.filter((s) => ["active", "pending"].includes(s.status));
        return open.length === 0 ? <EmptyState icon="layers" title="No active or pending subscription" hint="Choose a plan to start your monthly pickup and drop." action={<LinkButton variant="primary" to="/customer/plans">Browse plans</LinkButton>} /> : (
          <div className="grid gap-5 lg:grid-cols-2">{open.map((s) => (
            <Card key={s._id}><SubscriptionSummary sub={s} to={`/customer/subscriptions/${s._id}`} /><p className="mt-3 text-sm text-slate-600">{s.assignedDriverId ? `Assigned driver: ${s.assignedDriverId.fullName}` : "Waiting for an approved driver to accept your request."}</p></Card>
          ))}</div>
        );
      }}</Async>
    </>
  );
}

export function SubscriptionHistory() {
  const state = useAsync(mySubscriptions);
  return (
    <>
      <PageHeader title="Subscription history" breadcrumbs={[{ label: "Subscriptions", to: "/customer/subscriptions" }, { label: "History" }]} subtitle="Every subscription you have requested, newest first." />
      <Async state={state}>{(d) => d.subscriptions.length === 0 ? <EmptyState icon="clock" title="No history yet" /> : (
        <ol className="space-y-3">{d.subscriptions.map((s) => (
          <li key={s._id}><Card><div className="flex flex-wrap items-center justify-between gap-3">
            <div><Link className="font-bold text-blue-700 hover:underline" to={`/customer/subscriptions/${s._id}`}>{s.planSnapshot.name}</Link><p className="text-sm text-slate-500">Requested {fmtDate(s.createdAt)}</p>{s.startDate && <p className="text-sm text-slate-500">{fmtDate(s.startDate)} → {fmtDate(s.endDate)}</p>}</div>
            <div className="flex items-center gap-2"><Badge value={s.status === "pending" ? "Waiting for driver" : s.status === "active" ? "Driver assigned" : s.status} /></div></div></Card></li>
        ))}</ol>
      )}</Async>
    </>
  );
}

export function SubscriptionDetails() {
  const { id } = useParams();
  const state = useAsync(() => getSubscription(id), id);
  const [dialog, setDialog] = useState(null);
  const act = useAction();
  return (
    <Async state={state}>{({ subscription: s }) => (
      <>
        <PageHeader title={s.planSnapshot.name} subtitle="Your recurring commute request" breadcrumbs={[{ label: "Subscriptions", to: "/customer/subscriptions" }, { label: "Details" }]}
          actions={<>{["pending", "active"].includes(s.status) && <Button variant="danger" onClick={() => { act.clear(); setDialog("cancel"); }}>Cancel subscription</Button>}</>} />
        <Alert kind="success">{act.success}</Alert>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {s.fareSnapshot && <Card title="Your fare"><FareBreakdown fare={s.fareSnapshot} /></Card>}
          <Card title="Plan"><DL items={[["Plan", s.planSnapshot.name], ["Duration", s.planSnapshot.durationMonths >= 12 ? `${s.planSnapshot.durationMonths / 12} year(s)` : `${s.planSnapshot.durationMonths} month(s)`], ["Estimated fare", inr(s.planSnapshot.pricePaise)], ["Status", <Badge key="s" value={s.status} />], ["Start date", s.startDate ? fmtDate(s.startDate) : "After a driver accepts"], ["End date", s.endDate ? fmtDate(s.endDate) : "—"], ["Requested", fmtDateTime(s.createdAt)], s.cancelledAt && ["Cancelled", fmtDateTime(s.cancelledAt)]]} /></Card>
          <Card title="Assigned driver"><DL items={[["Driver", s.assignedDriverId?.fullName || "Waiting for driver acceptance"], ["Phone", s.assignedDriverId?.phone || "—"], ["Pickup time", s.requestSchedule?.pickupTime || "—"], ["Drop time", s.requestSchedule?.dropTime || "—"], ["Return pickup", s.requestSchedule?.returnPickupTime || "Not selected"]]} /></Card>
        </div>
        <ConfirmDialog open={dialog === "cancel"} danger title="Cancel this subscription?" confirmLabel="Cancel subscription" busy={act.busy} onCancel={() => setDialog(null)}
          message="Cancelling stops the subscription and its upcoming trips. This cannot be undone." onConfirm={async () => { if (await act.run(() => cancelSubscription(s._id), "Subscription cancelled.")) { setDialog(null); state.reload(); } }}><div className="mt-3"><Alert>{act.error}</Alert></div></ConfirmDialog>

      </>
    )}</Async>
  );
}
