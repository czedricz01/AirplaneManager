/**
 * Rechnet aus den Quelldaten die Jahreswerte Tourismus und Geschäft je Flughafen.
 *
 * Schritte je Flughafen:
 * 1. Fluggäste je Jahr 1960–2025: Stützwerte (2019, 2024, 2025 und historische Werte), dazwischen gleiche
 *    Wachstumsrate je Jahr; vor dem ersten Stützwert nach dem Profil der Region. Krisenjahre, die das Spiel als
 *    Ereignis kennt (Ölkrisen, 2001, 2008/09, Pandemie 2020–2022), liegen zwischen Stützwerten und sind damit
 *    geglättet: Den Einbruch rechnet das Ereignis, nicht die Tabelle.
 * 2. Ziel- und Quellverkehr = Fluggäste × (1 − Umsteiger-Anteil). Das Spiel rechnet Umsteiger selbst.
 *    Jede Reise zählt an beiden Enden; der Wert ist das Aufkommen der Stadt, nicht die Zahl der Reisen.
 * 3. Geschäft = Ziel- und Quellverkehr × Geschäftsanteil, Tourismus = Rest (Urlaub, Verwandtenbesuch, Pilger).
 * Einheit: tausend Fluggäste je Jahr.
 */
import { PROFILES, type Profile } from './profiles';
import { BUSINESS_SHARE, type TrafficEntry } from './types';

export const FIRST_YEAR = 1960;
export const LAST_YEAR = 2025;

/** Wert zwischen zwei Stützpunkten: gleiche Rate je Jahr, bei einer Null gerade Linie. */
function between(y0: number, v0: number, y1: number, v1: number, y: number): number {
  const t = (y - y0) / (y1 - y0);
  if (v0 <= 0 || v1 <= 0) return v0 + t * (v1 - v0);
  return v0 * Math.pow(v1 / v0, t);
}

/** Profil-Wert im Jahr `year` (2019 = 1), nur für Jahre bis 2019 gebraucht. */
export function profileAt(profile: Profile, year: number): number {
  const years = Object.keys(profile.points).map(Number).sort((a, b) => a - b);
  if (year <= years[0]) return profile.points[years[0]];
  for (let i = 1; i < years.length; i++) {
    if (year <= years[i]) {
      return between(years[i - 1], profile.points[years[i - 1]], years[i], profile.points[years[i]], year);
    }
  }
  return profile.points[years[years.length - 1]];
}

/** Fluggäste (Mio.) je Jahr FIRST_YEAR … LAST_YEAR. */
export function paxSeries(entry: TrafficEntry): number[] {
  const [p19, p24, profileKey, , , extra = {}] = entry;
  const profile = PROFILES[profileKey];
  const anchors = new Map<number, number>();
  for (const [y, v] of Object.entries(extra.a ?? {})) anchors.set(Number(y), v);
  anchors.set(2019, p19);
  anchors.set(2024, p24);
  anchors.set(2025, extra.p25 ?? p24 * profile.g25);
  const open = extra.open ?? -Infinity;
  for (const y of [...anchors.keys()]) if (y < open) anchors.delete(y);
  const years = [...anchors.keys()].sort((a, b) => a - b);

  const out: number[] = [];
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    if (year < open) {
      out.push(0);
      continue;
    }
    const exact = anchors.get(year);
    if (exact !== undefined) {
      out.push(exact);
      continue;
    }
    if (year < years[0]) {
      const first = years[0];
      out.push(anchors.get(first)! * (profileAt(profile, year) / profileAt(profile, first)));
      continue;
    }
    let i = 1;
    while (years[i] < year) i++;
    out.push(between(years[i - 1], anchors.get(years[i - 1])!, years[i], anchors.get(years[i])!, year));
  }
  return out;
}

export function businessShareOf(entry: TrafficEntry): number {
  const b = entry[3];
  return typeof b === 'number' ? b : BUSINESS_SHARE[b];
}

/** Tausend Fluggäste: ab 100 ganzzahlig, darunter auf eine Nachkommastelle. */
function roundThousands(v: number): number {
  return v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
}

/** Tabelle im Format von `Airport.stats`: [T1960, G1960, T1961, G1961, …], tausend Fluggäste je Jahr. */
export function statsRow(entry: TrafficEntry): number[] {
  const transfer = entry[4];
  const business = businessShareOf(entry);
  const out: number[] = [];
  for (const pax of paxSeries(entry)) {
    const local = pax * (1 - transfer) * 1000;
    out.push(roundThousands(local * (1 - business)), roundThousands(local * business));
  }
  return out;
}
