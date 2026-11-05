import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAsync, useAction } from "../../hooks/useAsync";
import { getDriver, listDrivers, setDriverAvailability, verifyDriver } from "../../services/driverService";
import { listRatings } from "../../services/ratingService";
import { ActionMenu, Alert, Async, Badge, Button, Card, ConfirmDialog, DataTable, DL, EmptyState, Field, NavTabs, PageHeader, SearchInput, Select, Stars, Toolbar } from "../../components/ui";
import { fmtDate, fmtDateTime, inputClass } from "../../lib/format";

const TABS = [{ to: "/admin/drivers", label: "All drivers" }, { to: "/admin/drivers/verification", label: "Verification queue" }];

function VerifyDialogs({ target, setTarget, onDone }) {
  const act = useAction();
  const [reason, setReason] = useState("");
  const close = () => { setTarget(null); setReason(""); act.clear(); };
  const mode = target?.mode;
  return (
    <ConfirmDialog open={!!target} danger={mode === "rejected"} title={mode === "approved" ? "Approve this driver?" : "Reject this driver?"} confirmLabel={mode === "approved" ? "Approve" : "Reject"} busy={act.busy} disabled={mode === "rejected" && reason.trim().length < 3} onCancel={close}
      message={mode === "approved" ? `${target?.d.fullName} will be able to receive customer commute requests and scheduled trips.` : "The driver is notified with your reason and can update details to resubmit."}
      onConfirm={async () => { if (await act.run(() => verifyDriver(target.d._id, mode, reason.trim()))) { close(); onDone(); } }}>
      {mode === "rejected" && <div className="mt-3"><Field label="Reason (required)"><textarea className={inputClass} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>}
      <div className="mt-3"><Alert>{act.error}</Alert></div>
    </ConfirmDialog>
  );
}

export function DriverList({ queue = false }) {
  const [sp] = useSearchParams();
  const [status, setStatus] = useState(queue ? "pending" : (["pending", "approved", "rejected"].includes(sp.get("status")) ? sp.get("status") : ""));
  useEffect(() => {
    if (!queue) setStatus(["pending", "approved", "rejected"].includes(sp.get("status")) ? sp.get("status") : "");
  }, [queue, sp]);
  const [q, setQ] = useState("");
  const state = useAsync(() => listDrivers(queue ? "pending" : status || undefined), `${queue}-${status}`);
  const [target, setTarget] = useState(null);
  return (
    <>
      <PageHeader title={queue ? "Driver verification" : "Drivers"} subtitle={queue ? "Review submitted details and documents, then approve or reject." : "All registered drivers."} />
      <NavTabs items={TABS} />
      <Toolbar><SearchInput value={q} onChange={setQ} placeholder="Search name, email, phone or licence" />
        {!queue && <Select label="Verification" value={status} onChange={setStatus} options={[["", "All statuses"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"]]} />}</Toolbar>
      <Async state={state}>{({ drivers = [], unsubmittedDrivers = [] }) => {
        const term = q.trim().toLowerCase();
        const rows = drivers.filter((d) => !term || [d.fullName, d.phone, d.licenseNumber, d.userId?.email].some((x) => (x || "").toLowerCase().includes(term)));
        const incomplete = unsubmittedDrivers.filter((d) => !term || [d.name, d.email, d.phone].some((x) => (x || "").toLowerCase().includes(term)));
        return (
          <>
          <DataTable rows={rows} empty={<EmptyState icon="user" title={queue ? "No submitted profiles are waiting for verification" : "No drivers match"} />} columns={[
            { key: "n", header: "Driver", render: (d) => <Link className="font-semibold text-blue-700 hover:underline" to={`/admin/drivers/${d._id}`}>{d.fullName}</Link> },
            { key: "em", header: "Email", render: (d) => d.userId?.email || "—" },
            { key: "ph", header: "Phone", render: (d) => d.phone },
            { key: "l", header: "Licence", render: (d) => <span>{d.licenseNumber}<span className="block text-xs text-slate-500">valid until {fmtDate(d.licenseValidUntil)}</span></span> },
            { key: "docs", header: "Docs", render: (d) => d.documents?.length ?? 0 },
            { key: "st", header: "Verification", render: (d) => <span>{<Badge value={d.verificationStatus} />}{d.verificationStatus === "rejected" && d.rejectionReason ? <span className="mt-1 block max-w-[14rem] text-xs text-red-700">{d.rejectionReason}</span> : null}</span> },
            { key: "av", header: "Availability", render: (d) => <Badge value={d.availability} /> },
            { key: "rt", header: "Rating", render: (d) => (d.rating?.count ? `${d.rating.average} ★ (${d.rating.count})` : "No ratings") },
            { key: "rg", header: "Registered", render: (d) => fmtDate(d.createdAt) },
            { key: "a", header: "", render: (d) => <ActionMenu items={[{ label: "View details", to: `/admin/drivers/${d._id}` }, d.verificationStatus !== "approved" && { label: "Approve", onClick: () => setTarget({ d, mode: "approved" }) }, d.verificationStatus !== "rejected" && { label: "Reject", danger: true, onClick: () => setTarget({ d, mode: "rejected" }) }]} /> },
          ]} />
          {incomplete.length > 0 && <Card className="mt-6" title="Registered drivers — profile not submitted"
            ><p className="mb-3 text-sm text-slate-600">These users registered as drivers but have not submitted their driver profile and licence documents. They cannot be verified or accept customer requests until they complete that step.</p>
              <DataTable rows={incomplete} rowKey={(d) => d.id} empty={<EmptyState title="No incomplete profiles" />} columns={[
                { key: "n", header: "Name", render: (d) => d.name },
                { key: "e", header: "Email", render: (d) => d.email },
                { key: "p", header: "Phone", render: (d) => d.phone || "—" },
                { key: "a", header: "Account", render: (d) => <Badge value={d.isActive ? "active" : "inactive"} /> },
                { key: "r", header: "Registered", render: (d) => fmtDate(d.createdAt) },
                { key: "s", header: "Verification", render: () => <Badge value="profile incomplete" tone="amber" /> },
              ]} />
            </Card>}
          </>
        );
      }}</Async>
      <VerifyDialogs target={target} setTarget={setTarget} onDone={state.reload} />
    </>
  );
}

export function DriverDetail() {
  const { id } = useParams();
  const state = useAsync(() => getDriver(id), id);
  const ratings = useAsync(() => listRatings({ driverId: id, limit: 5 }), id);
  const [target, setTarget] = useState(null);
  const act = useAction();
  return (
    <Async state={state}>{({ driver: d }) => (
      <>
        <PageHeader title={d.fullName} subtitle={d.phone} breadcrumbs={[{ label: "Drivers", to: "/admin/drivers" }, { label: d.fullName }]}
          actions={<>{d.verificationStatus !== "approved" && <Button variant="success" onClick={() => setTarget({ d, mode: "approved" })}>Approve</Button>}{d.verificationStatus !== "rejected" && <Button variant="danger" onClick={() => setTarget({ d, mode: "rejected" })}>Reject</Button>}</>} />
        <Alert>{act.error}</Alert>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Profile"><DL cols={1} items={[["Verification", <Badge key="v" value={d.verificationStatus} />], ["Availability", <Badge key="a" value={d.availability} />], ["Address", d.address], ["Verified", d.verifiedAt && fmtDateTime(d.verifiedAt)], d.rejectionReason && ["Rejection reason", d.rejectionReason]]} />
            {d.verificationStatus === "approved" && <Button className="mt-4" size="sm" variant="secondary" busy={act.busy} onClick={() => act.run(async () => { await setDriverAvailability(d._id, d.availability === "available" ? "unavailable" : "available"); state.reload(); })}>Mark {d.availability === "available" ? "unavailable" : "available"}</Button>}</Card>
          <Card title="Licence"><DL cols={1} items={[["Number", d.licenseNumber], ["Valid until", fmtDate(d.licenseValidUntil)], ["Status", new Date(d.licenseValidUntil) < new Date() ? <Badge key="e" tone="red" value="expired" /> : <Badge key="ok" tone="green" value="valid" />]]} /></Card>

        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Document references">{d.documents.length ? <ul className="space-y-2 text-sm">{d.documents.map((x, i) => <li key={i}><b className="capitalize">{x.type.replace(/_/g, " ")}</b>: <span className="break-all">{x.reference}</span></li>)}</ul> : <p className="text-sm text-slate-500">No documents submitted.</p>}</Card>
          <Card title="Ratings" actions={<Link className="text-sm font-semibold text-blue-700" to="/admin/ratings">All</Link>}>
            <Async state={ratings}>{(r) => <><div className="mb-3 flex items-center gap-3"><span className="text-2xl font-extrabold">{r.summary.average ?? "—"}</span><Stars value={r.summary.average} /><span className="text-sm text-slate-500">{r.summary.count} ratings</span></div>{r.ratings.map((x) => <p key={x.id} className="border-t border-slate-100 py-2 text-sm"><Stars value={x.rating} /> {x.feedback && <span className="text-slate-700">“{x.feedback}”</span>}</p>)}</>}</Async>
          </Card>
        </div>
        <VerifyDialogs target={target} setTarget={setTarget} onDone={state.reload} />
      </>
    )}</Async>
  );
}
