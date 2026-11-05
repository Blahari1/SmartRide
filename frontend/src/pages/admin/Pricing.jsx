import { useState } from "react";
import { useAsync, useAction } from "../../hooks/useAsync";
import { createPricing, listPricing, setPricingActive } from "../../services/pricingService";
import { Alert, Async, Badge, Button, Card, DataTable, EmptyState, Field, PageHeader } from "../../components/ui";
import { fmtDateTime, inputClass, inr } from "../../lib/format";

// Fare = actual road distance (km) × configured rate per km, per selected journey.
export default function Pricing() {
  const state = useAsync(listPricing);
  const act = useAction();
  const [f, setF] = useState({ ratePerKm: "", effectiveFrom: "", note: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const body = { ratePerKm: Number(f.ratePerKm), note: f.note.trim() };
    if (f.effectiveFrom) body.effectiveFrom = new Date(f.effectiveFrom).toISOString();
    if (await act.run(() => createPricing(body), "Rate saved. It applies to new commute requests; existing requests keep their saved estimate.")) {
      setF({ ratePerKm: "", effectiveFrom: "", note: "" });
      state.reload();
    }
  };
  const toggle = (c) => act.run(() => setPricingActive(c.id, !c.isActive).then(state.reload), c.isActive ? "Rate deactivated." : "Rate activated.");
  return (
    <>
      <PageHeader title="Per-kilometre pricing" subtitle="Set one transparent rate between ₹5 and ₹10 for every road kilometre." />
      <Alert kind="success">{act.success}</Alert><Alert>{act.error}</Alert>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="New rate" className="lg:col-span-1">
          <form onSubmit={submit} className="space-y-3">
            <Field label="Rate per road kilometre (₹5–₹10)">
              <input className={inputClass} type="number" min="5" max="10" step="0.5" required value={f.ratePerKm} onChange={set("ratePerKm")} />
            </Field>
            <Field label="Effective from (optional, default now)"><input className={inputClass} type="datetime-local" value={f.effectiveFrom} onChange={set("effectiveFrom")} /></Field>
            <Field label="Note (optional)"><input className={inputClass} maxLength={300} value={f.note} onChange={set("note")} /></Field>
            <Button type="submit" busy={act.busy}>Save rate</Button>
            <p className="text-xs text-slate-500">Per-trip fare = actual road distance × rate per km. Subscription estimate = selected journey fares × estimated service days per month × subscription months.</p>
          </form>
        </Card>
        <div className="lg:col-span-2">
          <Async state={state}>{({ configs, activeId }) => (
            <DataTable rows={configs} rowKey={(c) => c.id} empty={<EmptyState icon="tag" title="No rate configured" hint="Customers can submit commute requests after an administrator saves an active rate." />} columns={[
              { key: "e", header: "Effective from", render: (c) => fmtDateTime(c.effectiveFrom) },
              { key: "r", header: "Rate per km", render: (c) => inr(c.ratePerKmPaise) },
              { key: "s", header: "Status", render: (c) => (c.id === activeId ? <Badge tone="green" value="in use" /> : <Badge value={c.isActive ? "scheduled/active" : "inactive"} />) },
              { key: "a", header: "", render: (c) => <Button variant="secondary" size="sm" onClick={() => toggle(c)}>{c.isActive ? "Deactivate" : "Activate"}</Button> },
            ]} />
          )}</Async>
        </div>
      </div>
    </>
  );
}
