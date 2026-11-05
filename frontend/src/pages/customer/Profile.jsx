import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authStore";
import { useAsync, useAction } from "../../hooks/useAsync";
import { getMyProfile, updateMyProfile } from "../../services/profileService";
import LocationEditor from "../../components/LocationEditor";
import MapView from "../../components/MapView";
import { Alert, Async, Button, Card, DL, Field, LinkButton, PageHeader } from "../../components/ui";
import { compact, mapMarkerFromLocation } from "../../lib/map";
import { hasCoords, inputClass } from "../../lib/format";

const loc = (l) => (l ? `${l.address}${l.landmark ? ` (near ${l.landmark})` : ""}` : null);

export function MyProfile() {
  const { user } = useAuth();
  const state = useAsync(getMyProfile);
  return (
    <>
      <PageHeader title="My profile" subtitle="Your details and saved locations." actions={<LinkButton variant="primary" to="/customer/profile/edit">Edit profile</LinkButton>} />
      <Async state={state}>{({ profile }) => {
        const p = profile?.pickupLocation, d = profile?.dropLocation;
        return (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Personal details"><DL items={[["Name", user.name], ["Email", user.email], ["Phone", user.phone]]} /></Card>
            <Card title="Saved locations" actions={<LinkButton size="sm" to="/customer/locations/map">Edit on map</LinkButton>}>
              <DL cols={1} items={[["Pickup", loc(p) || "Not set"], ["Drop", loc(d) || "Not set"]]} />
            </Card>
            <div className="lg:col-span-2"><MapView markers={compact([mapMarkerFromLocation("p", "pickup", p, "Pickup"), mapMarkerFromLocation("d", "drop", d, "Drop")])} fitKey="profile" height={300} label="Saved locations" /></div>
          </div>
        );
      }}</Async>
    </>
  );
}

export function EditProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || "" });
  const act = useAction();
  const save = (e) => {
    e.preventDefault();
    act.run(async () => { const r = await updateMyProfile({ name: form.name.trim(), phone: form.phone.trim() || null }); updateUser({ name: r.user?.name ?? form.name.trim(), phone: r.user?.phone ?? (form.phone.trim() || null) }); navigate("/customer/profile"); });
  };
  return (
    <>
      <PageHeader title="Edit profile" breadcrumbs={[{ label: "Profile", to: "/customer/profile" }, { label: "Edit" }]} />
      <Card className="max-w-xl"><form onSubmit={save} className="space-y-4">
        <Alert>{act.error}</Alert>
        <Field label="Full name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} /></Field>
        <Field label="Phone"><input className={inputClass} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <div className="flex gap-3"><Button type="submit" busy={act.busy}>Save</Button><LinkButton to="/customer/profile">Cancel</LinkButton></div>
      </form></Card>
    </>
  );
}

// kind = "pickup" | "drop"
export function LocationPage({ kind }) {
  const state = useAsync(getMyProfile, kind);
  const act = useAction();
  const key = kind === "pickup" ? "pickupLocation" : "dropLocation";
  const otherKey = kind === "pickup" ? "dropLocation" : "pickupLocation";
  return (
    <>
      <PageHeader title={`${kind === "pickup" ? "Pickup" : "Drop"} location`} subtitle="Search an address or use your current location, adjust the marker if needed, then save." breadcrumbs={[{ label: "Profile", to: "/customer/profile" }, { label: `${kind === "pickup" ? "Pickup" : "Drop"} location` }]} />
      <Alert kind="success">{act.success}</Alert><Alert>{act.error}</Alert>
      <Async state={state}>{({ profile }) => (
        <Card><LocationEditor key={hasCoords(profile?.[key]) ? "has" : "none"} kind={kind} initial={profile?.[key]} other={profile?.[otherKey]} busy={act.busy}
          onSave={(l) => act.run(async () => { await updateMyProfile({ [key]: l }); state.reload(); }, `${kind === "pickup" ? "Pickup" : "Drop"} location saved.`)} /></Card>
      )}</Async>
    </>
  );
}

// Both locations on one page: choose which one to edit; each uses the same search / current-location / marker editor.
export function MapSelection() {
  const state = useAsync(getMyProfile);
  const act = useAction();
  const [target, setTarget] = useState("pickup");
  const key = target === "pickup" ? "pickupLocation" : "dropLocation";
  const otherKey = target === "pickup" ? "dropLocation" : "pickupLocation";
  return (
    <>
      <PageHeader title="Select locations on map" subtitle="Search an address, use your current location, or place the marker. Pickup is your Home; drop is your College/Office." breadcrumbs={[{ label: "Profile", to: "/customer/profile" }, { label: "Map selection" }]} />
      <Alert kind="success">{act.success}</Alert><Alert>{act.error}</Alert>
      <Async state={state}>{({ profile }) => (
        <div className="space-y-4">
          <div className="grid max-w-sm grid-cols-2 gap-2">{["pickup", "drop"].map((k) => <button key={k} type="button" onClick={() => setTarget(k)} className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${target === k ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-600"}`}>{k}</button>)}</div>
          <Card><LocationEditor key={`${target}-${hasCoords(profile?.[key]) ? "has" : "none"}`} kind={target} initial={profile?.[key]} other={profile?.[otherKey]} busy={act.busy}
            onSave={(l) => act.run(async () => { await updateMyProfile({ [key]: l }); state.reload(); }, `${target === "pickup" ? "Pickup" : "Drop"} location saved.`)} /></Card>
        </div>
      )}</Async>
    </>
  );
}
