import { useEffect, useMemo, useRef, useState } from "react";
import MapView from "./MapView";
import RouteSummary from "./RouteSummary";
import { Alert, Button, Field } from "./ui";
import { hasCoords, inputClass } from "../lib/format";
import { reverseGeocode, searchAddress } from "../lib/geocode";
import { useRoute } from "../hooks/useRoute";

const empty = { address: "", landmark: "", latitude: null, longitude: null, placeId: "", source: "" };

// One saved location, chosen by (A) the device position, (B) searching a typed address, or by placing / dragging the marker.
// An address is never saved without coordinates, and coordinates are never guessed.
export default function LocationEditor({ kind, initial, onSave, busy, other }) {
  const [form, setForm] = useState({ ...empty, ...(initial || {}) });
  const [term, setTerm] = useState(initial?.address || "");
  const [results, setResults] = useState(null); // null = not searched, [] = no result
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState({ kind: "", text: "" });
  const [locating, setLocating] = useState(false);
  const addrEdited = useRef(false);
  const color = kind === "pickup" ? "pickup" : "drop";

  const markers = useMemo(() => [
    hasCoords(form) && { id: kind, kind: color, lat: form.latitude, lng: form.longitude, title: kind === "pickup" ? "Pickup (Home)" : "Drop (College/Office)", draggable: true },
    hasCoords(other) && { id: "o", kind: color === "pickup" ? "drop" : "pickup", lat: other.latitude, lng: other.longitude, title: kind === "pickup" ? "Drop" : "Pickup" },
  ].filter(Boolean), [form, other, kind, color]);

  // Route between the two saved/selected points, always pickup -> drop.
  const from = kind === "pickup" ? form : other;
  const to = kind === "pickup" ? other : form;
  const route = useRoute(from, to);

  // Photon provides address suggestions while typing. Requests are debounced and sent through
  // the backend proxy; reverse geocoding remains a separate action for GPS/map-selected points.
  const searchSequence = useRef(0);
  useEffect(() => {
    const sequence = ++searchSequence.current;
    const q = term.trim();
    if (q.length < 3 || q === (form.address || "").trim()) { setResults(null); setSearching(false); return undefined; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const matches = await searchAddress(q);
        if (searchSequence.current === sequence) setResults(matches);
      } catch (e) {
        if (searchSequence.current === sequence) setNote({ kind: "warning", text: e.message });
      } finally {
        if (searchSequence.current === sequence) setSearching(false);
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [term, form.address]);
  const onType = (v) => { setTerm(v); setResults(null); setNote({ kind: "", text: "" }); };
  const searchNow = async () => {
    const q = term.trim();
    if (q.length < 3) {
      setNote({ kind: "warning", text: "Enter at least 3 characters to see matching places." });
      return;
    }
    setSearching(true); setResults(null); setNote({ kind: "", text: "" });
    try {
      const matches = await searchAddress(q);
      setResults(matches);
      if (!matches.length) setNote({ kind: "warning", text: "No matching address found. Try adding the area and city, or place the marker on the map." });
    } catch (e) {
      setNote({ kind: "error", text: e.message });
    } finally {
      setSearching(false);
    }
  };
  const choose = (r) => {
    setTerm(r.label); setResults(null); addrEdited.current = true;
    setForm((f) => ({ ...f, address: r.label.slice(0, 300), latitude: r.latitude, longitude: r.longitude, placeId: r.placeId, source: "search" }));
    setNote({ kind: "info", text: "Address selected. Drag the marker or click the map to fine-tune the exact spot." });
  };

  const fillFromPoint = async (latitude, longitude, source) => {
    setForm((f) => ({ ...f, latitude, longitude, source, placeId: "" }));
    try {
      const r = await reverseGeocode(latitude, longitude);
      if (r) {
        setForm((f) => (f.latitude === latitude && f.longitude === longitude ? { ...f, placeId: r.placeId, address: addrEdited.current && f.address.trim() ? f.address : r.label.slice(0, 300) } : f));
        if (!addrEdited.current) setTerm(r.label);
        setNote({ kind: "info", text: "Point set. Check the address and adjust the marker if needed." });
      } else setNote({ kind: "warning", text: "No street address was found for this point. Type the address yourself; the marker position is kept." });
    } catch (e) { setNote({ kind: "warning", text: `${e.message} The marker position is kept; type the address yourself.` }); }
  };

  const useDevice = () => {
    setNote({ kind: "", text: "" });
    if (!("geolocation" in navigator)) return setNote({ kind: "warning", text: "This browser does not support location access. Search an address or click the map instead." });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); addrEdited.current = false; fillFromPoint(Number(p.coords.latitude.toFixed(6)), Number(p.coords.longitude.toFixed(6)), "gps"); },
      (e) => { setLocating(false); setNote({ kind: "warning", text: e.code === 1 ? "Location permission was denied. Allow it in your browser settings, or search an address / click the map instead." : e.code === 3 ? "Finding your location timed out. Try again, or search an address instead." : "Your position is unavailable right now. Search an address or click the map instead." }); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const valid = form.address.trim().length >= 3 && hasCoords(form);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave({ address: form.address.trim(), landmark: form.landmark.trim(), latitude: form.latitude, longitude: form.longitude, placeId: form.placeId || "", source: form.source || "map" }); }}>
        <div>
          <Field label="Search address">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={`${inputClass} min-w-0 flex-1`} value={term} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchNow(); } }} placeholder="Start typing a building, street, area or city" autoComplete="off" />
              <Button type="button" variant="secondary" busy={searching} disabled={term.trim().length < 3} onClick={searchNow}>Search</Button>
            </div>
          </Field>
          {searching && <p className="mt-1 text-xs text-slate-500">Searching address…</p>}
          {results && results.length > 0 && (
            <>
              <p className="mt-1 text-xs text-slate-500">{results.length > 1 ? "Several places match. Choose the right one:" : "Confirm this place:"}</p>
              <ul className="mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-sm" role="listbox">
                {results.map((r) => <li key={r.placeId}><button type="button" role="option" className="block w-full px-3 py-2 text-left hover:bg-blue-50" onClick={() => choose(r)}>{r.label}</button></li>)}
              </ul>
            </>
          )}
        </div>
        <Field label="Address to save"><textarea className={inputClass} rows={3} maxLength={300} value={form.address} onChange={(e) => { addrEdited.current = true; setForm({ ...form, address: e.target.value }); }} placeholder="Filled when you pick a search result or a map point; you can edit it" /></Field>
        <Field label="Landmark (optional)"><input className={inputClass} maxLength={120} value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} /></Field>
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {hasCoords(form) ? <>Selected point: <b>{form.latitude}, {form.longitude}</b>{form.source ? ` (${form.source})` : ""}</> : "No point selected yet. Search an address, use your current location, or click the map."}
        </div>
        {note.text && <Alert kind={note.kind === "error" ? "error" : note.kind === "warning" ? "warning" : "info"}>{note.text}</Alert>}
        <RouteSummary state={route} label="Home → College/Office" />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" busy={busy} disabled={!valid}>Save {kind} location</Button>
          <Button variant="secondary" busy={locating} onClick={useDevice}>Use my current location</Button>
        </div>
        {!valid && <p className="text-xs text-slate-500">An address (3+ characters) and a map point are both required.</p>}
      </form>
      <MapView markers={markers} line={route.route?.geometry} fitKey={`${kind}-${hasCoords(form)}-${route.route ? "r" : ""}`} height={420}
        onPick={(lat, lng) => { addrEdited.current = false; fillFromPoint(lat, lng, "map"); }}
        onMarkerDrag={(id, lat, lng) => { if (id === kind) { addrEdited.current = false; fillFromPoint(lat, lng, "map"); } }} label={`Choose ${kind} location on map`} />
    </div>
  );
}
