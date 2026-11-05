import MapView from "./MapView";
import RouteSummary from "./RouteSummary";
import { useRoute } from "../hooks/useRoute";
import { compact, mapMarkerFromLocation } from "../lib/map";

// Pickup/drop markers + the real road route, distance and ETA. The same routing service and calculation is used by
// customer booking, admin schedule details and driver/customer trip details.
export default function RouteMapCard({ pickup, drop, fitKey = "route", height = 300, label = "Route" }) {
  const state = useRoute(pickup, drop, { delay: 100 });
  const markers = compact([mapMarkerFromLocation("p", "pickup", pickup, "Pickup"), mapMarkerFromLocation("d", "drop", drop, "Drop")]);
  return (
    <div className="space-y-2">
      <MapView markers={markers} line={state.route?.geometry} fitKey={`${fitKey}-${state.route ? "r" : ""}`} height={height} label={`${label} map`} />
      <RouteSummary state={state} label={label} />
    </div>
  );
}
