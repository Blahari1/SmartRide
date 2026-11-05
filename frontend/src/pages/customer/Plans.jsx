import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAsync, useAction } from "../../hooks/useAsync";
import { listPlans, mySubscriptions, requestSubscription } from "../../services/subscriptionService";
import { getActivePricing, quoteFare } from "../../services/pricingService";
import FareBreakdown from "../../components/FareBreakdown";
import { Alert, Async, Badge, Button, Card, ConfirmDialog, EmptyState, LinkButton, PageHeader } from "../../components/ui";
import Icon from "../../components/Icon";
import { DAYS } from "../../lib/format";

const MODES = { outbound: { label: "One-way: Home → College/Office", directions: ["outbound"] }, return: { label: "One-way: College/Office → Home", directions: ["return"] }, both: { label: "Round trip (both directions)", directions: ["outbound", "return"] } };

export function PlansPage() {
  const plans = useAsync(listPlans);
  const subs = useAsync(mySubscriptions);
  const navigate = useNavigate();
  const [pick, setPick] = useState(null);
  const act = useAction();
  const pricing = useAsync(getActivePricing);
  const distance = !!pricing.data?.config;
  const [mode, setMode] = useState("both");
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [pickupTime, setPickupTime] = useState("08:00");
  const [dropTime, setDropTime] = useState("08:45");
  const [returnPickupTime, setReturnPickupTime] = useState("17:00");
  const [returnDropTime, setReturnDropTime] = useState("17:45");
  const selectedDirections = MODES[mode].directions;
  const sortedDays = [...days].sort((a, b) => a - b);
  const commute = distance ? {
    directions: selectedDirections, serviceDays: sortedDays,
    pickupTime, dropTime,
    ...(selectedDirections.includes("return") ? { returnPickupTime, returnDropTime } : {}),
  } : {};
  const quote = useAsync(
    () => pick && distance
      ? quoteFare({ planId: pick._id, directions: selectedDirections, serviceDays: sortedDays })
      : Promise.resolve(null),
    pick ? `${pick._id}|${selectedDirections.join()}|${sortedDays.join()}` : "no-selection",
  );
  const list = subs.data?.subscriptions || [];
  const pending = list.find((s) => s.status === "pending");
  const active = list.find((s) => s.status === "active");

  const confirm = () => act.run(async () => {
    await requestSubscription(pick._id, commute);
    await subs.reload?.();
    navigate("/customer/subscriptions");
  });

  return (
    <>
      <PageHeader title="Choose your commute" subtitle="Select a subscription duration, route and pickup times. Your request is shared with all approved, available drivers." actions={<LinkButton to="/customer/plans/compare"><Icon name="compare" className="h-4 w-4" />Compare plans</LinkButton>} />
      {pending && <div className="mb-4"><Alert kind="info">Your commute request ({pending.planSnapshot.name}) is waiting for a driver to accept it. <Link className="font-semibold underline" to={`/customer/subscriptions/${pending._id}`}>View request</Link></Alert></div>}
      {active && <div className="mb-4"><Alert kind="success">You already have an active commute subscription. You can request another after this subscription expires.</Alert></div>}
      {pricing.error && <Alert>{pricing.error}</Alert>}
      {!pricing.loading && !pricing.error && !distance && <Alert kind="warning">Distance-based pricing has not been configured by the administrator yet. You can browse plans, but subscription requests are disabled until pricing is configured.</Alert>}
      <Async state={plans}>{({ plans: ps }) => ps.length === 0 ? <EmptyState icon="tag" title="No plans available" hint="Plans are published by the administrator." /> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {ps.map((p) => (
            <Card key={p._id} className="flex flex-col">
              <div className="flex items-start justify-between"><h3 className="text-lg font-extrabold">{p.name}</h3><Badge tone="blue" value={`${p.durationMonths >= 12 ? `${p.durationMonths / 12} year${p.durationMonths > 12 ? "s" : ""}` : `${p.durationMonths} month${p.durationMonths > 1 ? "s" : ""}`}`} /></div>
              <p className="mt-3 text-lg font-extrabold text-slate-900">{distance ? "Fare based on your route" : "Route-based fare"}</p>
              <p className="text-xs text-slate-500">{distance ? `Calculated from actual road distance for ${p.durationMonths >= 12 ? `${p.durationMonths / 12} year(s)` : `${p.durationMonths} month(s)`}.` : "The fare will be calculated after the administrator configures the per-kilometre rate."}</p>
              {p.description && <p className="mt-3 text-sm text-slate-600">{p.description}</p>}
              <ul className="mt-3 flex-1 space-y-1.5 text-sm text-slate-700">{(p.features || []).map((f) => <li key={f} className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{f}</li>)}</ul>
              <Button className="mt-5" disabled={!!pending || !!active || subs.loading || pricing.loading || !distance || !!pricing.error} onClick={() => { act.clear(); setPick(p); }}>{active ? "Subscription already active" : "Select plan"}</Button>
            </Card>
          ))}
        </div>
      )}</Async>
      <ConfirmDialog open={!!pick} title="Request subscription" confirmLabel="Create request" busy={act.busy} disabled={!distance || !days.length || !(pickupTime < dropTime) || (selectedDirections.includes("outbound") && selectedDirections.includes("return") && !(returnPickupTime < returnDropTime)) || quote.loading || !!quote.error || !quote.data?.fare} onCancel={() => setPick(null)} onConfirm={confirm}>
        {pick && <div className="space-y-3 text-sm text-slate-600">
          <p><b className="text-slate-900">{pick.name}</b> · {pick.durationMonths >= 12 ? `${pick.durationMonths / 12} year(s)` : `${pick.durationMonths} month(s)`}</p>
          {distance && <>
            <fieldset className="space-y-1"><legend className="font-semibold text-slate-900">Journeys</legend>
              {Object.entries(MODES).map(([k, m]) => <label key={k} className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === k} onChange={() => setMode(k)} />{m.label}</label>)}
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block font-semibold text-slate-900">Pickup time</span><input type="time" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} required /></label>
              <label className="block"><span className="mb-1 block font-semibold text-slate-900">Drop time</span><input type="time" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={dropTime} onChange={(e) => setDropTime(e.target.value)} required /></label>
              {selectedDirections.includes("outbound") && selectedDirections.includes("return") && <>
                <label className="block"><span className="mb-1 block font-semibold text-slate-900">Return pickup time</span><input type="time" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={returnPickupTime} onChange={(e) => setReturnPickupTime(e.target.value)} required /></label>
                <label className="block"><span className="mb-1 block font-semibold text-slate-900">Return drop time</span><input type="time" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={returnDropTime} onChange={(e) => setReturnDropTime(e.target.value)} /></label>
              </>}
            </div>
            <fieldset><legend className="font-semibold text-slate-900">Service days</legend>
              <div className="mt-1 flex flex-wrap gap-2">{DAYS.map((d, i) => <label key={d} className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold ${days.includes(i) ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300"}`}><input type="checkbox" className="sr-only" checked={days.includes(i)} onChange={() => setDays((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))} />{d}</label>)}</div>
            </fieldset>
            {!days.length ? <Alert kind="warning">Choose at least one service day.</Alert>
              : quote.loading ? <p className="text-slate-500">Calculating road distance and fare…</p>
              : quote.error ? <Alert>{quote.error}</Alert>
              : quote.data?.fare ? <FareBreakdown fare={quote.data.fare} /> : <Alert kind="info">Select your journey and service days to calculate the fare.</Alert>}
          </>}
          <p className="rounded-lg bg-blue-50 p-3 text-blue-900">Your request will be sent to all approved, available drivers. The first eligible driver to accept it becomes your assigned driver and your recurring pickup schedule is created.</p>
          <Alert>{act.error}</Alert>
        </div>}
      </ConfirmDialog>
    </>
  );
}

export function ComparePlans() {
  const plans = useAsync(listPlans);
  return (
    <>
      <PageHeader title="Compare plans" breadcrumbs={[{ label: "Plans", to: "/customer/plans" }, { label: "Compare" }]} subtitle="Duration and included features. Final price is calculated from your route and selected service days." />
      <Async state={plans}>{({ plans: ps }) => ps.length === 0 ? <EmptyState icon="tag" title="No plans to compare" /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">&nbsp;</th>{ps.map((p) => <th key={p._id} scope="col" className="px-4 py-3 text-base font-extrabold">{p.name}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              <tr><th scope="row" className="px-4 py-3 font-semibold text-slate-600">Duration</th>{ps.map((p) => <td key={p._id} className="px-4 py-3">{p.durationMonths >= 12 ? `${p.durationMonths / 12} year${p.durationMonths > 12 ? "s" : ""}` : `${p.durationMonths} month${p.durationMonths > 1 ? "s" : ""}`}nth{p.durationMonths > 1 ? "s" : ""}</td>)}</tr>
              <tr><th scope="row" className="px-4 py-3 font-semibold text-slate-600">Total price</th>{ps.map((p) => <td key={p._id} className="px-4 py-3 font-semibold">Calculated from road distance</td>)}</tr>
              <tr><th scope="row" className="px-4 py-3 font-semibold text-slate-600">Per month</th>{ps.map((p) => <td key={p._id} className="px-4 py-3">Depends on route and service days</td>)}</tr>
              <tr><th scope="row" className="px-4 py-3 align-top font-semibold text-slate-600">Includes</th>{ps.map((p) => <td key={p._id} className="px-4 py-3 align-top">{(p.features || []).length ? <ul className="space-y-1">{p.features.map((f) => <li key={f}>• {f}</li>)}</ul> : <span className="text-slate-400">—</span>}</td>)}</tr>
              <tr><th scope="row" className="px-4 py-3 font-semibold text-slate-600">&nbsp;</th>{ps.map((p) => <td key={p._id} className="px-4 py-3"><LinkButton size="sm" variant="primary" to="/customer/plans">Choose</LinkButton></td>)}</tr>
            </tbody>
          </table>
        </div>
      )}</Async>
    </>
  );
}

