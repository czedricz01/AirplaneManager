/**
 * Kabine: SPEZIFIKATION 2.3 (Interior score) und 2.4 (Cabin rating).
 *
 * Die Formel des Interior score stand bisher nur im Kaufdialog
 * (`src/components/ConfigurePurchaseView.tsx:402-484`); sie gehört ins Modell (R3).
 */

import { clampScale } from './basics';
import {
  CABIN_EXTRA_POINTS,
  FEATURE_POINTS,
  INTERIOR_BASE,
  INTERIOR_SHARE,
  PITCH_FACTOR,
  PITCH_NORM,
  SEAT_TYPE_FACTOR,
  SEAT_TYPE_POINTS,
  TYPE_APPEAL_SHARE,
  WEAR_FLOOR,
  type CabinClass,
  type CabinExtra,
  type InteriorItem,
} from './constants';

// ---------------------------------------------------------------------------
// 2.3 Interior score
// ---------------------------------------------------------------------------

/** Ausstattung einer Klasse, wie im Kauf- oder Umbau-Dialog gewählt. */
export interface ClassInterior {
  /** Name des Sitztyps (Schlüssel in `SEAT_TYPE_POINTS`), z. B. `Recliner`. */
  readonly seatType: string;
  /** Sitzabstand in cm. */
  readonly pitch: number;
  /** Eingebaute Ausstattung (Schlüssel in `FEATURE_POINTS`), z. B. `ife`, `power`. */
  readonly features: readonly string[];
}

/** Was für die ganze Kabine gilt. */
export interface CabinFit {
  /** Spielmonat des Einbaus (Kauf oder letzter Umbau). Nur bis dahin lieferbare Teile zählen. */
  readonly installedMonth: number;
  /** Sitze des Flugzeugtyps (Feld `capacity` in `src/data/aircraft.ts`); manche Extras brauchen Größe. */
  readonly capacity: number;
  /** Kabinenweite Extras. */
  readonly extras: readonly CabinExtra[];
}

/** Aufschlüsselung des Interior score einer Klasse, für die Anzeige im Kauf- und Umbau-Dialog. */
export interface InteriorScoreParts {
  readonly base: number;
  readonly seatType: number;
  readonly pitch: number;
  readonly features: number;
  readonly cabinExtras: number;
  /** `max(0, Summe)`. */
  readonly total: number;
}

/** Ob ein Teil beim Einbau lieferbar war (Monat und, falls verlangt, Größe des Flugzeugs). */
export function isDeliverable(item: InteriorItem, fit: Pick<CabinFit, 'installedMonth' | 'capacity'>): boolean {
  if (fit.installedMonth < item.availableFrom) return false;
  if (item.minCapacity !== undefined && fit.capacity < item.minCapacity) return false;
  return true;
}

/** Punkte der kabinenweiten Extras: wirken in jeder Klasse gleich stark. Jedes Extra zählt einmal. SPEZIFIKATION 2.3. */
export function cabinExtrasPoints(fit: CabinFit): number {
  let total = 0;
  for (const extra of new Set(fit.extras)) {
    const item = CABIN_EXTRA_POINTS[extra];
    if (item && isDeliverable(item, fit)) total += item.points;
  }
  return total;
}

/**
 * Interior score einer Klasse mit Aufschlüsselung. Siehe `interiorScore`. SPEZIFIKATION 2.3.
 */
export function interiorScoreParts(cabinClass: CabinClass, interior: ClassInterior, fit: CabinFit): InteriorScoreParts {
  const seat = SEAT_TYPE_POINTS[cabinClass][interior.seatType];
  // Unbekannter oder noch nicht lieferbarer Sitztyp zählt wie `Standard` (0 Punkte).
  const seatType = seat && isDeliverable(seat, fit) ? SEAT_TYPE_FACTOR * seat.points : 0;

  const pitch = (interior.pitch - PITCH_NORM[cabinClass]) * PITCH_FACTOR[cabinClass];

  let features = 0;
  for (const key of new Set(interior.features)) {
    const item = FEATURE_POINTS[cabinClass][key];
    if (item && isDeliverable(item, fit)) features += item.points;
  }

  const base = INTERIOR_BASE[cabinClass];
  const cabinExtras = cabinExtrasPoints(fit);
  return {
    base,
    seatType,
    pitch,
    features,
    cabinExtras,
    total: Math.max(0, base + seatType + pitch + features + cabinExtras),
  };
}

/**
 * Wert der eingebauten Sitze und Ausstattung einer Klasse, Punkte ≥ 0, ungerundet (R4):
 *
 * `max(0, Grundwert + 2 × Sitztyp-Punkte + (Sitzabstand − Norm) × Faktor + Ausstattung + kabinenweite Extras)`.
 *
 * Nur Teile, die im Einbaumonat lieferbar waren, zählen. Zwischenwert ohne Obergrenze; gekappt wird
 * erst in `cabinRating`. SPEZIFIKATION 2.3.
 */
export function interiorScore(cabinClass: CabinClass, interior: ClassInterior, fit: CabinFit): number {
  return interiorScoreParts(cabinClass, interior, fit).total;
}

// ---------------------------------------------------------------------------
// 2.4 Cabin rating
// ---------------------------------------------------------------------------

/**
 * Wie viel vom Interior score eine abgenutzte Kabine behält:
 * `0,4 + 0,6 × cabinCondition / 100` (neu = 1, ganz abgenutzt = 0,4). SPEZIFIKATION 2.4.
 *
 * @param cabinCondition Zustand der Kabine in Prozent (0 … 100).
 */
export function wearFactor(cabinCondition: number): number {
  return WEAR_FLOOR + (1 - WEAR_FLOOR) * (cabinCondition / 100);
}

/**
 * Wie gut die Kabine einer Klasse eines Flugzeugs heute ist, Punkte 0 … 100, einmal gekappt, ungerundet:
 *
 * `kappen(0,33 × typeAppeal + 0,67 × interiorScore × wearFactor(cabinCondition), 0, 100)`. SPEZIFIKATION 2.4.
 */
export function cabinRating(typeAppealValue: number, interiorScoreValue: number, cabinCondition: number): number {
  return clampScale(
    'cabinRating',
    TYPE_APPEAL_SHARE * typeAppealValue + INTERIOR_SHARE * interiorScoreValue * wearFactor(cabinCondition),
  );
}

/**
 * Eine Zahl je Flugzeug für Listen: Mittel der Cabin ratings der Klassen nach Sitzen,
 * beschriftet „Cabin rating (avg.)“. Ohne Sitze `NaN` (kein Ersatzwert, F2). SPEZIFIKATION 2.4.
 */
export function averageCabinRating(classes: readonly { readonly rating: number; readonly seats: number }[]): number {
  let seats = 0;
  let weighted = 0;
  for (const c of classes) {
    seats += c.seats;
    weighted += c.seats * c.rating;
  }
  return weighted / seats;
}
