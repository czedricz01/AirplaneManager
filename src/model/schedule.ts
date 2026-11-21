/**
 * Zeitplan eines Flugzeugs: Flugzeit im Fahrplan, Umlaufzeit, Flüge je Tag, belegte Slots je Ende, Auslastung.
 *
 * Eine Regel für Planer und Zeitplan-Editor (E51, `bestand/8-oberflaeche.md` W6, Art B „Umlaufzeit“). Die Lage der
 * Umläufe in der Woche (Intervalle, Kollisionen, „Max Flights“) rechnet `src/lib/scheduleUtils.ts` mit diesen
 * Funktionen; das Modell kennt nur Minuten. SPEZIFIKATION 1.1 (Blockzeit), 1.6 (Slot).
 */

import {
  BOARDING_MINUTES,
  MINUTES_PER_DAY,
  MINUTES_PER_WEEK,
  SCHEDULE_STEP_MINUTES,
  TURNAROUND_MINUTES,
  type AircraftClass,
} from './constants';
import { blockMinutes } from './demand';

/**
 * Flugzeit einer Richtung im Fahrplan, ganze Minuten: `blockMinutes` (3.1) gerundet. Der Fahrplan speichert sie je
 * Umlauf (`durMin`); gerundet wird nur hier, weil der Fahrplan in ganzen Minuten rechnet (R4: Anzeige).
 *
 * @param greatCircleKm Großkreis-Entfernung in km (`distanceKm`).
 * @param speedKmh Reisegeschwindigkeit des Flugzeugs in km/h.
 */
export function timetableLegMinutes(greatCircleKm: number, speedKmh: number): number {
  return Math.round(blockMinutes(greatCircleKm, speedKmh));
}

/** Wendezeit am Ziel in Minuten (`TURNAROUND_MINUTES`). */
export function turnaroundMinutes(cls: AircraftClass): number {
  return TURNAROUND_MINUTES[cls];
}

/**
 * Umlaufzeit (Blockzeit eines Umlaufs) in Minuten, aufgerundet auf `SCHEDULE_STEP_MINUTES`:
 * Einsteigen + Hinflug + Wende + Rückflug + Aussteigen; ein Einweg-Umlauf nur Einsteigen + Hinflug + Aussteigen.
 * So lange ist das Flugzeug für den Umlauf gebunden.
 *
 * @param legMinutes Flugzeit einer Richtung (`timetableLegMinutes`).
 * @param turnMinutes Wendezeit am Ziel (`turnaroundMinutes`).
 * @param oneWay Einweg-Umlauf (kein Rückflug).
 */
export function tripBlockMinutes(legMinutes: number, turnMinutes: number, oneWay = false): number {
  const raw = oneWay
    ? BOARDING_MINUTES + legMinutes + BOARDING_MINUTES
    : BOARDING_MINUTES + legMinutes + turnMinutes + legMinutes + BOARDING_MINUTES;
  return Math.ceil(raw / SCHEDULE_STEP_MINUTES) * SCHEDULE_STEP_MINUTES;
}

/**
 * Flüge je Tag (E51): so viele Umläufe passen hintereinander in die längste freie Zeit, die die **übrigen Strecken
 * desselben Flugzeugs** an einem Tag lassen. Ab einer Umlaufzeit von einem halben Tag höchstens 1 (die Regel des
 * Planers, heute `RoutePlannerView.tsx:1607`). 0, wenn kein Umlauf passt; der Regler „Multiple Ops“ zeigt dann 1.
 *
 * @param cycleMinutes Umlaufzeit (`tripBlockMinutes`).
 * @param freeRunMinutes Längste freie Zeit für eine Folge von Umläufen ab einem Tag, höchstens `MINUTES_PER_DAY`
 *   (`dailyRunCapacity` in `src/lib/scheduleUtils.ts`).
 */
export function tripsPerDay(cycleMinutes: number, freeRunMinutes: number): number {
  if (!(cycleMinutes > 0)) throw new Error(`Ungültige Umlaufzeit: ${cycleMinutes}`);
  const free = Math.min(MINUTES_PER_DAY, freeRunMinutes);
  const fit = Math.floor(free / cycleMinutes);
  if (fit <= 0) return 0;
  return 2 * cycleMinutes >= MINUTES_PER_DAY ? 1 : fit;
}

/**
 * Slots, die ein Umlauf an einem Ende belegt (1.6): ein Slot je Abflug. Der Hinflug fliegt am Start ab, der Rückflug
 * am Ziel; ein Einweg-Umlauf belegt nur am Start einen Slot. Ankünfte brauchen keinen. Für Umläufe mit Rückflug
 * gleich `departuresAt` (Abflüge je Woche an jedem Ende).
 *
 * @param atOrigin Ende ist der Start der Strecke (sonst das Ziel).
 */
export function tripSlotsAt(atOrigin: boolean, oneWay = false): number {
  return atOrigin || !oneWay ? 1 : 0;
}

/**
 * Auslastung eines Flugzeugs: Anteil der Woche, in dem es für Umläufe gebunden ist (Summe der Umlaufzeiten /
 * `MINUTES_PER_WEEK`), 0 … 1 und darüber nur bei Überschneidungen.
 *
 * @param cycleMinutes Umlaufzeit jedes Umlaufs der Woche (`tripBlockMinutes`).
 */
export function weeklyUtilization(cycleMinutes: readonly number[]): number {
  let total = 0;
  for (const c of cycleMinutes) total += c;
  return total / MINUTES_PER_WEEK;
}
