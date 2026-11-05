import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const COLORS = { pickup: "#16a34a", drop: "#dc2626", driver: "#1d4ed8", you: "#7c3aed", other: "#475569" };
const LETTER = { pickup: "P", drop: "D", driver: "V", you: "Y", other: "•" };
// Viewport used only when there is nothing to show yet (no marker is drawn for it).
const FALLBACK_VIEW = { center: [20.5937, 78.9629], zoom: 5 };

const iconFor = (kind) => L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:50%;background:${COLORS[kind] || COLORS.other};color:#fff;font:700 13px system-ui;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)">${LETTER[kind] || LETTER.other}</div>`,
  iconSize: [30, 30], iconAnchor: [15, 15],
});

// markers: [{ id, kind: pickup|drop|driver|you, lat, lng, title }]  (invalid coordinates are skipped, never guessed)
// onPick(lat, lng): turns the map into a location picker (click to choose).
// fitKey: the view is re-fitted to the markers when this value changes (and once on first render).
export default function MapView({ markers = [], onPick, onMarkerDrag, line = null, fitKey = "", height = 360, className = "", follow = false, label = "Map" }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef(null);
  const pick = useRef(onPick);
  const drag = useRef(onMarkerDrag);
  useEffect(() => { pick.current = onPick; drag.current = onMarkerDrag; });

  useEffect(() => {
    const m = L.map(box.current, { scrollWheelZoom: false }).setView(FALLBACK_VIEW.center, FALLBACK_VIEW.zoom);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on("click", (e) => { if (pick.current) pick.current(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))); });
    m.on("focus", () => m.scrollWheelZoom.enable());
    m.on("blur", () => m.scrollWheelZoom.disable());
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(box.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; layer.current = null; fitted.current = null; };
  }, []);

  const key = JSON.stringify(markers);
  const lineKey = JSON.stringify(line || []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layer.current.clearLayers();
    const pts = [];
    for (const mk of JSON.parse(key)) {
      if (typeof mk.lat !== "number" || typeof mk.lng !== "number" || !Number.isFinite(mk.lat) || !Number.isFinite(mk.lng)) continue;
      const marker = L.marker([mk.lat, mk.lng], { icon: iconFor(mk.kind), keyboard: false, draggable: !!mk.draggable });
      if (mk.draggable) marker.on("dragend", () => { const p = marker.getLatLng(); if (drag.current) drag.current(mk.id, Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))); });
      if (mk.title) { const el = document.createElement("span"); el.textContent = mk.title; marker.bindTooltip(el, { direction: "top", offset: [0, -14] }); } // textContent: user data is never parsed as HTML
      marker.addTo(layer.current);
      pts.push([mk.lat, mk.lng]);
    }
    const lp = JSON.parse(lineKey);
    if (lp.length > 1) L.polyline(lp, { color: "#1d4ed8", weight: 5, opacity: 0.8 }).addTo(layer.current);
    const shouldFit = fitted.current !== fitKey && pts.length > 0;
    if (shouldFit) {
      const all = lp.length > 1 ? pts.concat(lp) : pts;
      if (all.length === 1) m.setView(all[0], 15); else m.fitBounds(all, { padding: [40, 40], maxZoom: 16 });
      fitted.current = fitKey;
    } else if (follow && pts.length) {
      const driver = JSON.parse(key).find((x) => x.kind === "driver");
      if (driver && !m.getBounds().contains([driver.lat, driver.lng])) m.panTo([driver.lat, driver.lng]);
    }
  }, [key, lineKey, fitKey, follow]);

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 ${className}`}>
      <div ref={box} style={{ height, cursor: onPick ? "crosshair" : undefined }} role="application" aria-label={label} tabIndex={0} />
    </div>
  );
}
