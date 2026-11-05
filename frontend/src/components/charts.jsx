// Dependency-free SVG/CSS charts. They draw only the numbers they receive; no placeholder data.
export function StackedBars({ data, series, height = 180 }) {
  const max = Math.max(1, ...data.map((d) => series.reduce((a, s) => a + (d[s.key] || 0), 0)));
  const total = data.reduce((a, d) => a + series.reduce((x, s) => x + (d[s.key] || 0), 0), 0);
  if (!total) return <p className="py-10 text-center text-sm text-slate-500">No data in this period.</p>;
  const w = 100 / data.length;
  return (
    <div>
      <svg viewBox={`0 0 ${data.length * 20} ${height / 4}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img" aria-label="Stacked bar chart">
        {data.map((d, i) => {
          let y = height / 4;
          return series.map((s) => {
            const h = ((d[s.key] || 0) / max) * (height / 4 - 2);
            y -= h;
            return h > 0 ? <rect key={`${i}-${s.key}`} x={i * 20 + 3} y={y} width={14} height={h} fill={s.color} rx="1"><title>{`${d.label}: ${d[s.key]} ${s.label}`}</title></rect> : null;
          });
        })}
      </svg>
      <div className="mt-1 flex text-[10px] text-slate-500" aria-hidden>{data.map((d, i) => <span key={i} style={{ width: `${w}%` }} className="truncate text-center">{d.short ?? d.label}</span>)}</div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">{series.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}

export function Donut({ segments, size = 140, centerLabel }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!total) return <p className="py-8 text-center text-sm text-slate-500">No records yet.</p>;
  const r = 15.9155;
  let offset = 25;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 42 42" width={size} height={size} role="img" aria-label="Distribution chart">
        <circle cx="21" cy="21" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        {segments.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * 100;
          const el = <circle key={s.label} cx="21" cy="21" r={r} fill="none" stroke={s.color} strokeWidth="6" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={offset}><title>{`${s.label}: ${s.value}`}</title></circle>;
          offset -= len;
          return el;
        })}
        <text x="21" y="22.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#0f172a">{centerLabel ?? total}</text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {segments.map((s) => <li key={s.label} className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /><span className="text-slate-600">{s.label}</span><span className="font-semibold text-slate-900">{s.value}</span></li>)}
      </ul>
    </div>
  );
}

export function HBars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label} className="text-sm">
          <div className="mb-1 flex justify-between"><span className="text-slate-600">{i.label}</span><span className="font-semibold text-slate-900">{i.display ?? i.value}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: i.color || "#1d4ed8" }} /></div>
        </li>
      ))}
    </ul>
  );
}
