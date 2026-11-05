import { useCallback, useEffect, useRef, useState } from "react";

// Loads data when `key` changes (pass a primitive that identifies the query). `reload()` refetches
// in the background, keeping the previous data on screen. `loading` is true until the first result for the current key.
export function useAsync(fn, key = "") {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: null, data: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    fnRef.current().then(
      (data) => { if (!cancelled) setState({ key, data, error: "" }); },
      (e) => { if (!cancelled) setState({ key, data: null, error: e.message }); },
    );
    return () => { cancelled = true; };
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: state.data, error: state.error, loading: state.key !== key, reload };
}

// Runs an async action with busy/error/success feedback.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const run = useCallback(async (fn, okMessage) => {
    setBusy(true); setError(""); setSuccess("");
    try { const r = await fn(); if (okMessage) setSuccess(okMessage); return r === undefined ? true : r; }
    catch (e) { setError(e.message); return undefined; }
    finally { setBusy(false); }
  }, []);
  const clear = useCallback(() => { setError(""); setSuccess(""); }, []);
  return { busy, error, success, run, clear };
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}
