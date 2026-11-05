import { Alert } from "./ui";

export const fmtDuration = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

// Shows the result of useRoute(): distance, ETA, loading and a clear error (no straight-line substitute is ever shown).
export default function RouteSummary({ state, label = "Road route" }) {
  if (state.loading) return <p className="text-sm text-slate-500">Calculating road route…</p>;
  if (state.error) return <Alert>{`${label}: ${state.error}`}</Alert>;
  if (!state.route) return null;
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
      <span>{label}: <b>{state.route.distanceKm} km</b> by road</span>
      <span>ETA: <b>{fmtDuration(state.route.durationMinutes)}</b></span>
    </div>
  );
}
