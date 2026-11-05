import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAsync, useAction } from "../../hooks/useAsync";
import { createDriverProfile, getMyDriver, updateMyDriver } from "../../services/driverService";
import { Alert, Async, Badge, Button, Card, DL, EmptyState, Field, LinkButton, PageHeader } from "../../components/ui";
import { fmtDate, inputClass } from "../../lib/format";

const DOC_TYPES = [["driving_licence", "Driving licence"], ["id_proof", "ID proof"], ["address_proof", "Address proof"], ["other", "Other"]];
const docLabel = (t) => (DOC_TYPES.find((d) => d[0] === t) || [, t])[1];
const dateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// Wrapper: loads the driver's own profile; shows a "complete your profile" state when none exists yet.
function WithProfile({ children, title, subtitle, breadcrumbs, allowMissing = false }) {
  const state = useAsync(getMyDriver);
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} breadcrumbs={breadcrumbs} />
      <Async state={state}>{(d) => (!d.profile && !allowMissing
        ? <EmptyState icon="user" title="Complete your driver profile first" hint="Submit your details and licence so an administrator can verify you." action={<LinkButton variant="primary" to="/driver/profile/edit">Complete profile</LinkButton>} />
        : children(d, state.reload))}</Async>
    </>
  );
}

export function MyDriverProfile() {
  return (
    <WithProfile title="My profile" subtitle="Your driver details as seen by administrators.">{({ profile: p }) => (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Personal details" actions={<LinkButton size="sm" to="/driver/profile/edit">Edit</LinkButton>}><DL items={[["Name", p.fullName], ["Phone", p.phone], ["Address", p.address], ["Availability", <Badge key="a" value={p.availability} />], ["Verification", <Badge key="v" value={p.verificationStatus} />]]} /></Card>
        <Card title="Driving licence" actions={<LinkButton size="sm" to="/driver/licence">Edit</LinkButton>}><DL items={[["Licence number", p.licenseNumber], ["Valid until", fmtDate(p.licenseValidUntil)]]} /></Card>
        <Card title="Documents" actions={<LinkButton size="sm" to="/driver/documents">Manage</LinkButton>}>{p.documents.length ? <ul className="space-y-1 text-sm">{p.documents.map((d, i) => <li key={i}><b>{docLabel(d.type)}</b>: {d.reference}</li>)}</ul> : <p className="text-sm text-slate-500">No documents added.</p>}</Card>
      </div>
    )}</WithProfile>
  );
}

export function EditDriverProfile() {
  return (
    <WithProfile allowMissing title="Driver profile" subtitle="Provide accurate details. Administrators verify them before you receive customers." breadcrumbs={[{ label: "Profile", to: "/driver/profile" }, { label: "Edit" }]}>
      {(d) => <ProfileForm existing={d.profile} />}
    </WithProfile>
  );
}

function ProfileForm({ existing }) {
  const navigate = useNavigate();
  const act = useAction();
  const [f, setF] = useState({ fullName: existing?.fullName || "", phone: existing?.phone || "", address: existing?.address || "", licenseNumber: existing?.licenseNumber || "", licenseValidUntil: dateInput(existing?.licenseValidUntil), docRef: "", ...{} });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const body = { fullName: f.fullName.trim(), phone: f.phone.trim(), address: f.address.trim() };
    act.run(async () => {
      if (existing) await updateMyDriver(body);
      else await createDriverProfile({ ...body, licenseNumber: f.licenseNumber.trim(), licenseValidUntil: f.licenseValidUntil, documents: f.docRef.trim() ? [{ type: "driving_licence", reference: f.docRef.trim() }] : [] });
      navigate(existing ? "/driver/profile" : "/driver/verification");
    });
  };
  return (
    <Card className="max-w-2xl"><form className="space-y-4" onSubmit={submit}>
      <Alert>{act.error}</Alert>
      {existing?.verificationStatus === "rejected" && <Alert kind="warning">Your profile was rejected. Saving changes resubmits it for verification.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><input className={inputClass} required minLength={2} value={f.fullName} onChange={set("fullName")} /></Field>
        <Field label="Phone"><input className={inputClass} required type="tel" value={f.phone} onChange={set("phone")} /></Field>
      </div>
      <Field label="Address"><textarea className={inputClass} rows={2} maxLength={300} value={f.address} onChange={set("address")} /></Field>
      {!existing && <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Driving licence number"><input className={inputClass} required maxLength={30} value={f.licenseNumber} onChange={set("licenseNumber")} /></Field>
          <Field label="Licence valid until"><input className={inputClass} required type="date" value={f.licenseValidUntil} onChange={set("licenseValidUntil")} /></Field>
        </div>
        <Field label="Licence document reference" hint="Required for admin verification. Enter a document ID or a secure HTTPS link to your scanned licence; files are not uploaded to SmartRide."><input className={inputClass} required maxLength={500} value={f.docRef} onChange={set("docRef")} /></Field>
      </>}
      <div className="flex gap-3"><Button type="submit" busy={act.busy}>{existing ? "Save changes" : "Submit for verification"}</Button><LinkButton to="/driver/profile">Cancel</LinkButton></div>
    </form></Card>
  );
}

export function Licence() {
  return <WithProfile title="Driving licence" subtitle="Licence number and validity." breadcrumbs={[{ label: "Profile", to: "/driver/profile" }, { label: "Licence" }]}>{({ profile }, reload) => <LicenceForm p={profile} reload={reload} />}</WithProfile>;
}
function LicenceForm({ p, reload }) {
  const act = useAction();
  const [f, setF] = useState({ licenseNumber: p.licenseNumber, licenseValidUntil: dateInput(p.licenseValidUntil) });
  const expired = new Date(p.licenseValidUntil) < new Date();
  return (
    <Card className="max-w-xl"><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); act.run(async () => { await updateMyDriver({ licenseNumber: f.licenseNumber.trim(), licenseValidUntil: f.licenseValidUntil }); reload(); }, "Licence details saved."); }}>
      <Alert kind="success">{act.success}</Alert><Alert>{act.error}</Alert>
      {expired && <Alert kind="warning">Your licence has expired. Update it to continue driving.</Alert>}
      <Field label="Licence number"><input className={inputClass} value={f.licenseNumber} maxLength={30} onChange={(e) => setF({ ...f, licenseNumber: e.target.value })} /></Field>
      <Field label="Valid until"><input className={inputClass} type="date" value={f.licenseValidUntil} onChange={(e) => setF({ ...f, licenseValidUntil: e.target.value })} /></Field>
      <Button type="submit" busy={act.busy}>Save</Button>
    </form></Card>
  );
}

export function Documents() {
  return <WithProfile title="Document references" subtitle="Reference IDs or links for your documents. Administrators review these during verification." breadcrumbs={[{ label: "Profile", to: "/driver/profile" }, { label: "Documents" }]}>{({ profile }, reload) => <DocForm p={profile} reload={reload} />}</WithProfile>;
}
function DocForm({ p, reload }) {
  const act = useAction();
  const [type, setType] = useState("id_proof");
  const [ref, setRef] = useState("");
  const save = (documents, msg) => act.run(async () => { await updateMyDriver({ documents }); reload(); }, msg);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Your documents">
        <Alert kind="success">{act.success}</Alert><Alert>{act.error}</Alert>
        {p.documents.length === 0 ? <p className="text-sm text-slate-500">No documents yet.</p> : <ul className="divide-y divide-slate-100">{p.documents.map((d, i) => <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="min-w-0"><b>{docLabel(d.type)}</b><span className="block truncate text-slate-500">{d.reference}</span></span><Button size="sm" variant="ghost" disabled={act.busy} onClick={() => save(p.documents.filter((_, j) => j !== i).map(({ type, reference }) => ({ type, reference })), "Document removed.")}>Remove</Button></li>)}</ul>}
      </Card>
      <Card title="Add a document">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save([...p.documents.map(({ type, reference }) => ({ type, reference })), { type, reference: ref.trim() }], "Document added."); setRef(""); }}>
          <Field label="Type"><select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>{DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Reference" hint="Document number or link"><input className={inputClass} maxLength={500} required value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          <Button type="submit" busy={act.busy} disabled={!ref.trim()}>Add document</Button>
        </form>
      </Card>
    </div>
  );
}

export function Verification() {
  return (
    <WithProfile title="Verification status" subtitle="Administrators must approve your profile before you can receive customer commute requests or scheduled trips.">{({ profile: p }) => {
      const steps = [["Profile submitted", true], ["Under review by an administrator", p.verificationStatus === "pending"], [p.verificationStatus === "rejected" ? "Rejected" : "Approved", p.verificationStatus !== "pending"]];
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Status"><div className="flex items-center gap-3"><Badge value={p.verificationStatus} /><span className="text-sm text-slate-600">{{ pending: "Waiting for review.", approved: `Approved ${fmtDate(p.verifiedAt)}.`, rejected: "Your profile needs changes." }[p.verificationStatus]}</span></div>
            <ol className="mt-5 space-y-3">{steps.map(([l, ok], i) => <li key={i} className={`flex items-center gap-3 text-sm ${ok ? "text-slate-900" : "text-slate-400"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${ok ? (p.verificationStatus === "rejected" && i === 2 ? "bg-red-600 text-white" : "bg-emerald-600 text-white") : "bg-slate-200"}`}>{i + 1}</span>{l}</li>)}</ol></Card>
          <Card title="What next">
            {p.verificationStatus === "rejected" && <div className="space-y-3"><Alert>Reason: {p.rejectionReason}</Alert><LinkButton variant="primary" to="/driver/profile/edit">Update and resubmit</LinkButton></div>}
            {p.verificationStatus === "pending" && <p className="text-sm text-slate-600">You will be notified when the review is complete. Make sure your <Link className="font-semibold text-blue-700" to="/driver/documents">documents</Link> are complete.</p>}
            {p.verificationStatus === "approved" && <p className="text-sm text-slate-600">You are verified. You can now view and accept customer commute requests.</p>}
          </Card>
        </div>
      );
    }}</WithProfile>
  );
}
