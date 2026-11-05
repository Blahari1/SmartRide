import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAsync, useAction, useDebounced } from "../../hooks/useAsync";
import { getCustomer, listCustomers, setCustomerActive } from "../../services/adminService";
import MapView from "../../components/MapView";
import { ActionMenu, Alert, Async, Badge, Card, ConfirmDialog, DataTable, DL, EmptyState, PageHeader, Pagination, SearchInput, Select, Toolbar } from "../../components/ui";
import { compact, mapMarkerFromLocation } from "../../lib/map";
import { fmtDate, fmtDay, inr } from "../../lib/format";

export function CustomerList() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const state = useAsync(() => listCustomers({ q: dq, active: active || undefined, sort: sort.key, dir: sort.dir, page, limit: 15 }), `${dq}|${active}|${sort.key}${sort.dir}|${page}`);
  const [target, setTarget] = useState(null);
  const act = useAction();
  return (
    <>
      <PageHeader title="Customers" subtitle="Search, review and manage customer accounts." />
      <Toolbar><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, email or phone" />
        <Select label="Account status" value={active} onChange={(v) => { setActive(v); setPage(1); }} options={[["", "All accounts"], ["true", "Enabled"], ["false", "Disabled"]]} /></Toolbar>
      <Alert kind="success">{act.success}</Alert><Alert>{act.error}</Alert>
      <Async state={state}>{(d) => (
        <>
          <DataTable rows={d.customers} sort={sort} onSort={(s) => { setSort(s); setPage(1); }} empty={<EmptyState icon="users" title="No customers match" />} columns={[
            { key: "name", sortKey: "name", header: "Customer", render: (c) => <Link className="font-semibold text-blue-700 hover:underline" to={`/admin/customers/${c.id}`}>{c.name}</Link> },
            { key: "contact", header: "Contact", render: (c) => <span>{c.email}<span className="block text-xs text-slate-500">{c.phone || "—"}</span></span> },
            { key: "sub", header: "Subscription", render: (c) => (c.subscription ? <span>{c.subscription.plan} <Badge value={c.subscription.status} /></span> : <span className="text-slate-400">None</span>) },
            { key: "createdAt", sortKey: "createdAt", header: "Joined", render: (c) => fmtDate(c.createdAt) },
            { key: "status", header: "Account", render: (c) => <Badge value={c.isActive ? "active" : "disabled"} /> },
            { key: "actions", header: "", render: (c) => <ActionMenu items={[{ label: "View details", to: `/admin/customers/${c.id}` }, { label: c.isActive ? "Disable account" : "Enable account", danger: c.isActive, onClick: () => { act.clear(); setTarget(c); } }]} /> },
          ]} />
          <Pagination page={d.page} limit={d.limit} total={d.total} onPage={setPage} />
        </>
      )}</Async>
      <ConfirmDialog open={!!target} danger={target?.isActive} title={target?.isActive ? "Disable this account?" : "Enable this account?"} confirmLabel={target?.isActive ? "Disable" : "Enable"} busy={act.busy} onCancel={() => setTarget(null)}
        message={target?.isActive ? `${target?.name} will no longer be able to log in. Existing records are kept.` : `${target?.name} will be able to log in again.`}
        onConfirm={async () => { if (await act.run(() => setCustomerActive(target.id, !target.isActive), "Account updated.")) { setTarget(null); state.reload(); } else setTarget(null); }} />
    </>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const state = useAsync(() => getCustomer(id), id);
  return (
    <Async state={state}>{({ customer: c, profile, subscriptions, tripCounts, recentTrips }) => (
      <>
        <PageHeader title={c.name} subtitle={c.email} breadcrumbs={[{ label: "Customers", to: "/admin/customers" }, { label: c.name }]} actions={<Badge value={c.isActive ? "active" : "disabled"} />} />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Account"><DL cols={1} items={[["Phone", c.phone], ["Joined", fmtDate(c.createdAt)], ["Pickup", profile?.pickupLocation?.address || "Not set"], ["Drop", profile?.dropLocation?.address || "Not set"]]} /></Card>
          <Card title="Trips"><DL cols={1} items={Object.entries(tripCounts).map(([k, v]) => [k.replace("_", " "), v])} /></Card>
          <MapView markers={compact([mapMarkerFromLocation("p", "pickup", profile?.pickupLocation, "Pickup"), mapMarkerFromLocation("d", "drop", profile?.dropLocation, "Drop")])} fitKey={id} height={220} label="Saved locations" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Subscriptions" padded={false}><div className="p-3"><DataTable rows={subscriptions} empty={<p className="p-3 text-sm text-slate-500">None.</p>} columns={[{ key: "p", header: "Plan", render: (s) => <Link className="font-semibold text-blue-700 hover:underline" to={`/admin/subscriptions/${s._id}`}>{s.planSnapshot.name}</Link> }, { key: "d", header: "Period", render: (s) => (s.startDate ? `${fmtDate(s.startDate)} → ${fmtDate(s.endDate)}` : "—") }, { key: "s", header: "Status", render: (s) => <Badge value={s.status} /> }]} /></div></Card>

        </div>
        <Card className="mt-6" title="Recent trips" padded={false}><div className="p-3"><DataTable rows={recentTrips} empty={<p className="p-3 text-sm text-slate-500">None.</p>} columns={[{ key: "d", header: "Date", render: (t) => <Link className="font-semibold text-blue-700 hover:underline" to={`/admin/trips/${t._id}`}>{fmtDay(t.date)}</Link> }, { key: "dr", header: "Driver", render: (t) => t.driverId?.fullName || "—" }, { key: "s", header: "Status", render: (t) => <Badge value={t.status} /> }]} /></div></Card>
      </>
    )}</Async>
  );
}

