import { useEffect, useState } from "react";
import { routePreview } from "../services/pricingService";
import { hasCoords } from "../lib/format";

// Road route between two locations, fetched from the backend routing service (never a straight line).
// Recalculates when either point changes (debounced); a stale response can never overwrite a newer one.
export function useRoute(from, to, { delay = 500 } = {}) {
  const ok = hasCoords(from) && hasCoords(to);
  const key = ok ? `${from.latitude},${from.longitude}>${to.latitude},${to.longitude}` : "";
  const [state, setState] = useState({ key: "", route: null, error: "" });
  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    const id = setTimeout(() => {
      routePreview(from, to).then(
        (r) => { if (!cancelled) setState({ key, route: r.route, error: "" }); },
        (e) => { if (!cancelled) setState({ key, route: null, error: e.message }); },
      );
    }, delay);
    return () => { cancelled = true; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay]);
  if (!key) return { route: null, error: "", loading: false };
  const current = state.key === key;
  return { route: current ? state.route : null, error: current ? state.error : "", loading: !current };
}
