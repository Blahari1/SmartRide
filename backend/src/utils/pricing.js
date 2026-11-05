// Pure fare maths (no I/O). Money is integer paise; routing distance is supplied in metres.
//   tripFare = roadDistanceKm × ratePerKm
//   monthlyJourneyDays = round(serviceDaysPerWeek * 52 / 12)
//   total = (sum of the per-trip fare of every SELECTED direction) * monthlyJourneyDays * durationMonths
const { HttpError } = require("./validate");

const DIRECTIONS = ["outbound", "return"];

function tripFarePaise(cfg, distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) throw new HttpError(400, "Distance must be a positive number");
  if (!Number.isSafeInteger(cfg.ratePerKmPaise) || cfg.ratePerKmPaise < 500 || cfg.ratePerKmPaise > 1000) {
    throw new HttpError(409, "Active rate must be between ₹5 and ₹10 per kilometre");
  }
  return Math.round((distanceMeters * cfg.ratePerKmPaise) / 1000);
}

function journeyDaysPerMonth(serviceDaysPerWeek) {
  return Math.round((serviceDaysPerWeek * 52) / 12);
}

function validateCommute({ directions, serviceDays }) {
  if (!Array.isArray(directions) || !directions.length || new Set(directions).size !== directions.length || !directions.every((d) => DIRECTIONS.includes(d))) {
    throw new HttpError(400, 'directions must be ["outbound"], ["return"] or both');
  }
  if (!Array.isArray(serviceDays) || !serviceDays.length || new Set(serviceDays).size !== serviceDays.length || !serviceDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    throw new HttpError(400, "serviceDays must be a non-empty array of unique weekday numbers 0 (Sun) - 6 (Sat)");
  }
}

// legs: [{ direction, distanceMeters, durationSeconds, ...extra }] -> snapshot with fares. `cfg` is a PricingConfig document or plain object.
function buildFare(cfg, { directions, serviceDays, durationMonths }, legs) {
  validateCommute({ directions, serviceDays });
  if (!Number.isInteger(durationMonths) || durationMonths < 1) throw new HttpError(400, "durationMonths must be a positive whole number");
  const byDir = new Map(legs.map((l) => [l.direction, l]));
  const pricedLegs = directions.map((direction) => {
    const l = byDir.get(direction);
    if (!l) throw new HttpError(500, `Missing route for ${direction}`);
    return { ...l, farePaise: tripFarePaise(cfg, l.distanceMeters) };
  });
  const perServiceDayPaise = pricedLegs.reduce((s, l) => s + l.farePaise, 0);
  const serviceDaysPerMonth = journeyDaysPerMonth(serviceDays.length);
  const totalPaise = perServiceDayPaise * serviceDaysPerMonth * durationMonths;
  if (!Number.isSafeInteger(totalPaise)) throw new HttpError(400, "Fare is out of range");
  return {
    mode: "distance",
    directions: [...directions], serviceDays: [...serviceDays].sort((a, b) => a - b),
    serviceDaysPerMonth, durationMonths,
    pricing: {
      configId: cfg._id || null, ratePerKmPaise: cfg.ratePerKmPaise, effectiveFrom: cfg.effectiveFrom || null,
    },
    legs: pricedLegs, perServiceDayPaise,
    monthlyPaise: perServiceDayPaise * serviceDaysPerMonth,
    totalPaise, calculatedAt: new Date(),
  };
}

// Admin input in INR (numbers/strings with at most 2 decimals) -> integer paise.
function inrToPaise(value, label) {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 10000000) throw new HttpError(400, `${label} must be a number between 0 and 10000000`);
  const paise = Math.round(n * 100);
  if (Math.abs(paise / 100 - n) > 1e-9) throw new HttpError(400, `${label} can have at most 2 decimal places`);
  return paise;
}

module.exports = { DIRECTIONS, tripFarePaise, journeyDaysPerMonth, validateCommute, buildFare, inrToPaise };
