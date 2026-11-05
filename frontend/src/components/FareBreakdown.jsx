import { dirLabel, DAYS, inr } from "../lib/format";

// Transparent fare breakdown for a server-calculated fareSnapshot (quote preview, subscription detail, admin views).
export default function FareBreakdown({ fare }) {
  if (!fare) return null;
  const p = fare.pricing || {};
  const twoWay = fare.directions.length === 2;
  return (
    <div className="space-y-3 text-sm">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[420px] text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Journey</th><th className="px-3 py-2">Road distance</th><th className="px-3 py-2">Fare per trip</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {fare.legs.map((l) => <tr key={l.direction}><td className="px-3 py-2">{dirLabel(l.direction)}</td><td className="px-3 py-2">{(l.distanceMeters / 1000).toFixed(1)} km</td><td className="px-3 py-2 font-semibold">{inr(l.farePaise)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1 text-slate-600">
        <li>Rate: <b>{inr(p.ratePerKmPaise)} per road kilometre</b>. Each leg is priced using its actual road distance.</li>
        <li>{twoWay ? "Round trip: both directions are priced separately and added." : `One-way only (${fare.directions[0] === "return" ? "College/Office → Home" : "Home → College/Office"}): the other direction is not charged.`}</li>
        <li>Per service day: <b>{inr(fare.perServiceDayPaise)}</b> · Service days: {fare.serviceDays.map((d) => DAYS[d]).join(", ")} ({fare.serviceDays.length}/week ≈ {fare.serviceDaysPerMonth} days per month)</li>
        <li>Monthly estimate: <b>{inr(fare.monthlyPaise)}</b> × {fare.durationMonths} month{fare.durationMonths > 1 ? "s" : ""}</li>
      </ul>
      <p className="text-base font-extrabold text-slate-900">Estimated subscription fare: {inr(fare.totalPaise)}</p>
    </div>
  );
}
