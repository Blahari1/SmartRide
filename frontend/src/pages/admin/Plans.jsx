import { useState } from "react";
import { useAsync, useAction } from "../../hooks/useAsync";
import { createPlan, listAllPlans, setPlanActive, updatePlan } from "../../services/subscriptionService";
import { Alert, Async, Badge, Button, Card, EmptyState, Field, Modal, PageHeader } from "../../components/ui";
import { inputClass } from "../../lib/format";

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function PlanForm({ plan, onClose, onSaved }) {
  const act = useAction();
  const [f, setF] = useState({ name: plan?.name || "", durationMonths: plan?.durationMonths || 1, description: plan?.description || "", features: (plan?.features || []).join("\n") });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const body = { name: f.name.trim(), durationMonths: Number(f.durationMonths), description: f.description.trim(), features: f.features.split("\n").map((x) => x.trim()).filter(Boolean) };
    if (!plan) body.slug = slugify(f.name);
    if (await act.run(() => (plan ? updatePlan(plan._id, body) : createPlan(body)))) { onSaved(); onClose(); }
  };
  return (
    <Modal open onClose={onClose} title={plan ? "Edit plan" : "New plan"} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <Alert>{act.error}</Alert>
        <Alert kind="info">Plan duration and included features are managed here. The fare is calculated separately from the customer's road distance using the active Pricing Configuration. Existing subscriptions keep their saved fare.</Alert>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" className="sm:col-span-3"><input className={inputClass} required maxLength={60} value={f.name} onChange={set("name")} /></Field>
          <Field label="Duration"><select className={inputClass} required value={f.durationMonths} onChange={set("durationMonths")}><option value={1}>1 month</option><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>1 year</option><option value={24}>2 years</option><option value={36}>3 years</option><option value={48}>4 years</option><option value={60}>5 years</option></select></Field>
          <div className="flex items-end"><p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Fare calculated by route distance</p></div>
        </div>
        <Field label="Description"><textarea className={inputClass} rows={2} maxLength={300} value={f.description} onChange={set("description")} /></Field>
        <Field label="Features" hint="One per line"><textarea className={inputClass} rows={4} value={f.features} onChange={set("features")} /></Field>
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={act.busy}>{plan ? "Save changes" : "Create plan"}</Button></div>
      </form>
    </Modal>
  );
}

export default function AdminPlans() {
  const state = useAsync(listAllPlans);
  const [form, setForm] = useState(null);
  const act = useAction();
  return (
    <>
      <PageHeader title="Subscription plans" subtitle="Inactive plans are hidden from customers but kept for existing subscriptions." actions={<Button variant="primary" onClick={() => setForm("new")}>New plan</Button>} />
      <Alert>{act.error}</Alert>
      <Async state={state}>{({ plans }) => plans.length === 0 ? <EmptyState icon="tag" title="No plans yet" action={<Button variant="primary" onClick={() => setForm("new")}>Create the first plan</Button>} /> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{plans.map((p) => (
          <Card key={p._id} className={p.isActive ? "" : "opacity-70"}>
            <div className="flex items-start justify-between"><h3 className="font-extrabold">{p.name}</h3><Badge value={p.isActive ? "active" : "inactive"} /></div>
            <p className="mt-2 text-base font-extrabold">Route-priced</p><p className="text-xs text-slate-500">{p.durationMonths >= 12 ? `${p.durationMonths / 12} year(s)` : `${p.durationMonths} month(s)`} · Fare calculated from distance and active rate</p>
            {p.description && <p className="mt-2 text-sm text-slate-600">{p.description}</p>}
            {p.features?.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">{p.features.map((x) => <li key={x}>{x}</li>)}</ul>}
            <div className="mt-4 flex gap-2"><Button size="sm" variant="secondary" onClick={() => setForm(p)}>Edit</Button><Button size="sm" variant="ghost" busy={act.busy} onClick={() => act.run(async () => { await setPlanActive(p._id, !p.isActive); state.reload(); })}>{p.isActive ? "Deactivate" : "Activate"}</Button></div>
          </Card>))}</div>
      )}</Async>
      {form && <PlanForm plan={form === "new" ? null : form} onClose={() => setForm(null)} onSaved={state.reload} />}
    </>
  );
}
