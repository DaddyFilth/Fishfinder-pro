/**
 * Solunar calculation engine
 * Based on John Alden Knight's solunar theory (1926)
 * Moon position math derived from Jean Meeus "Astronomical Algorithms" (1998)
 * No external API required — pure math
 */

export interface SolunarResult {
  moonPhase: string;
  moonIllumination: number;
  moonPhaseName: string;
  majorPeriods: { start: string; end: string }[];
  minorPeriods: { start: string; end: string }[];
  solunarScore: number;
  bestHours: number[];
  peakActivityLabel: string;
}

function julianDate(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + date.getUTCHours() / 24;
  if (m <= 2) { return julianDate(new Date(Date.UTC(y - 1, m + 11 - 1, date.getUTCDate()))); }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function moonPhaseFromDate(date: Date): { phase: number; illumination: number } {
  const jd = julianDate(date);
  const daysSinceNew = (jd - 2451549.5) % 29.53058867;
  const phase = ((daysSinceNew % 29.53058867) + 29.53058867) % 29.53058867;
  const illumination = Math.round((1 - Math.cos((phase / 29.53058867) * 2 * Math.PI)) / 2 * 100);
  return { phase, illumination };
}

function phaseLabel(phase: number): string {
  if (phase < 1.85)  return 'New Moon';
  if (phase < 7.38)  return 'Waxing Crescent';
  if (phase < 9.22)  return 'First Quarter';
  if (phase < 14.77) return 'Waxing Gibbous';
  if (phase < 16.61) return 'Full Moon';
  if (phase < 22.15) return 'Waning Gibbous';
  if (phase < 23.99) return 'Last Quarter';
  if (phase < 29.53) return 'Waning Crescent';
  return 'New Moon';
}

function solunarScoreFromPhase(phase: number): number {
  // New moon (0) and full moon (14.77) produce highest solunar activity
  const distFromNew  = Math.min(phase, 29.53 - phase);
  const distFromFull = Math.abs(phase - 14.77);
  const minDist = Math.min(distFromNew, distFromFull);
  // Score 100 at new/full, decays to 40 at quarter moons
  return Math.round(100 - (minDist / 7.38) * 60);
}

function addMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60000);
}

function fmtTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function calculateSolunar(date: Date, lat: number): SolunarResult {
  const { phase, illumination } = moonPhaseFromDate(date);

  // Approximate moon transit time based on phase (simplified Meeus)
  // Full calculation requires lunar position — this is a close approximation
  const lunarHourAngle = (phase / 29.53058867) * 24;
  const moonTransit = new Date(date);
  moonTransit.setHours(Math.floor(lunarHourAngle) % 24, 0, 0, 0);

  // Major periods: ±1hr around moon transit and moon opposite (12hr later)
  const major1Start = addMinutes(moonTransit, -60);
  const major1End   = addMinutes(moonTransit,  60);
  const opposite    = addMinutes(moonTransit,  12 * 60);
  const major2Start = addMinutes(opposite, -60);
  const major2End   = addMinutes(opposite,  60);

  // Minor periods: halfway between majors (±30min)
  const minor1Time  = addMinutes(moonTransit, 6 * 60);
  const minor2Time  = addMinutes(moonTransit, -6 * 60);

  const solunarScore = solunarScoreFromPhase(phase);

  // Best hours = major period hours + dawn + dusk (lat-based approx)
  const dawnHour = Math.max(5, 7 - Math.round(lat / 30));
  const duskHour = Math.min(20, 17 + Math.round(lat / 30));
  const bestHours = Array.from(new Set([
    moonTransit.getHours(),
    opposite.getHours(),
    dawnHour,
    duskHour,
  ])).sort((a, b) => a - b);

  return {
    moonPhase: phase.toFixed(2),
    moonIllumination: illumination,
    moonPhaseName: phaseLabel(phase),
    majorPeriods: [
      { start: fmtTime(major1Start), end: fmtTime(major1End) },
      { start: fmtTime(major2Start), end: fmtTime(major2End) },
    ],
    minorPeriods: [
      { start: fmtTime(addMinutes(minor1Time, -30)), end: fmtTime(addMinutes(minor1Time, 30)) },
      { start: fmtTime(addMinutes(minor2Time, -30)), end: fmtTime(addMinutes(minor2Time, 30)) },
    ],
    solunarScore,
    bestHours,
    peakActivityLabel: solunarScore >= 80 ? 'Excellent Day' : solunarScore >= 60 ? 'Good Day' : 'Average Day',
  };
}

export function hourlyActivityForecast(solunar: SolunarResult): { hour: number; label: string; score: number }[] {
  return Array.from({ length: 24 }, (_, h) => {
    const isMajor = solunar.majorPeriods.some(p => {
      const start = parseInt(p.start);
      const end   = parseInt(p.end);
      return h >= start && h <= end;
    });
    const isMinor  = solunar.minorPeriods.some(p => h >= parseInt(p.start) && h <= parseInt(p.end));
    const isBest   = solunar.bestHours.includes(h);
    const base     = Math.round(solunar.solunarScore * 0.4);
    const score    = isMajor ? Math.min(100, base + 60) : isMinor ? Math.min(100, base + 30) : isBest ? Math.min(100, base + 20) : base;
    const label    = isMajor ? 'Major' : isMinor ? 'Minor' : isBest ? 'Active' : 'Slow';
    return { hour: h, label, score };
  });
}
