/**
 * Kauf- und Umbau-Dialog nach dem Modell (Paket 4.6a, docs/neubau F65).
 *
 * Der Dialog (`src/components/ConfigurePurchaseView.tsx`) rechnete Platz, Interior score, Lieferbarkeit und Preise der
 * Kabine selbst, mit eigenen Tabellen (W4). Hier kommt alles aus `src/model/`: Platz-Regel (7.5, `cabinSpace`,
 * `seatSpace`, `economySeatsLeft`), Interior score mit Aufschlüsselung (2.3, `interiorScoreParts`), Cabin rating (2.4)
 * mit Type appeal (2.2), Kabinen-Listenpreis (5.13, `cabinListPriceParts`), Kaufpreis (8.12, `newAircraftPrice`) und
 * Umbau-Preis (8.13, `refitPrice`). Dieselben Funktionen nutzt der Abschluss (Wert der Flotte) und die KI (R2).
 *
 * Alles hier ist rein (keine Zustände, keine globalen Daten). Beträge in $ des Monats `month` (`atCost`), ungerundet.
 */
import type { Aircraft } from '../data/aircraft';
import { atCost } from '../model/basics';
import {
  averageCabinRating,
  cabinListPriceParts,
  cabinRating,
  cabinSpace,
  deliverableExtras,
  economySeatsLeft,
  interiorScoreParts,
  isDeliverable,
  seatSpace,
  type CabinFit,
  type ClassInterior,
  type InteriorScoreParts,
} from '../model/cabin';
import {
  CABIN_CLASSES,
  CABIN_EXTRA_POINTS,
  CABIN_EXTRA_PRICE_1960,
  FEATURE_POINTS,
  FEATURE_PRICE_1960,
  SEAT_SPACE_FACTOR,
  SEAT_TYPE_FACTOR,
  SEAT_TYPE_POINTS,
  SEAT_TYPE_PRICE_1960,
  type CabinClass,
  type CabinExtra,
  type InteriorItem,
} from '../model/constants';
import { newAircraftPrice } from '../model/fleet';
import { refitCabinCondition, refitLabour, refitPrice } from '../model/fleetMarket';
import { typeAppeal } from '../model/satisfaction';

/** Die Klassen, deren Sitzzahl der Spieler wählt; Economy füllt den restlichen Platz. */
export type ChosenClass = Exclude<CabinClass, 'economy'>;

/** Klassen mit gewählter Sitzzahl, von der teuersten zur günstigsten (Reihenfolge der Schieberegler). */
export const CHOSEN_CLASSES: readonly ChosenClass[] = ['first', 'business', 'premium'];

/** Was im Dialog gewählt ist. */
export interface CabinChoice {
  /** Sitze der Klassen First, Business, Premium. */
  readonly seats: Readonly<Record<ChosenClass, number>>;
  /** Sitztyp, Sitzabstand und Ausstattung je Klasse (auch für Klassen ohne Sitze, für die Karten des Dialogs). */
  readonly interiors: Readonly<Record<CabinClass, ClassInterior>>;
  /** Angehakte kabinenweite Extras (auch nicht lieferbare; das Modell zählt nur lieferbare). */
  readonly extras: readonly CabinExtra[];
}

/** Ein Flugzeug der Flotte, das umgebaut wird. */
export interface RefitPlane {
  /** Baumonat (`purchasedAt`). */
  readonly builtMonth: number;
  /** Erstkunden-Flugzeug (Type appeal, 2.2). */
  readonly launchCustomer?: boolean;
  /** Kabinenzustand heute in Prozent. */
  readonly cabinCondition: number;
  /** Bisherige Umbauten. */
  readonly refitsDone: number;
}

/** Ergebnis für die Anzeige und den Kauf. */
export interface CabinQuote {
  /** Platz der Kabine in cm (7.5): Typ-Kapazität × 74 cm, mit Platz-Gewinn und -Bedarf der lieferbaren Extras. */
  readonly space: number;
  /** Platz eines Sitzes je Klasse in cm (Sitzabstand × Platzfaktor des Sitztyps). */
  readonly seatSpace: Readonly<Record<CabinClass, number>>;
  /** Sitze je Klasse; Economy = Sitze im restlichen Platz (`economySeatsLeft`). */
  readonly seats: Readonly<Record<CabinClass, number>>;
  readonly totalSeats: number;
  /** Platz, den die Sitze aller Klassen belegen, in cm. */
  readonly usedSpace: number;
  /** Die Klassen außer Economy brauchen mehr Platz, als da ist. */
  readonly overbooked: boolean;
  /** Höchste Sitzzahl je gewählter Klasse, wenn die übrigen bleiben (Ende des Schiebereglers). */
  readonly maxSeats: Readonly<Record<ChosenClass, number>>;
  /** Lieferbare, angehakte Extras: Das wird eingebaut und bezahlt. */
  readonly fittedExtras: readonly CabinExtra[];
  /** Interior score je Klasse mit Aufschlüsselung (2.3), für alle vier Klassen. */
  readonly interior: Readonly<Record<CabinClass, InteriorScoreParts>>;
  /** Type appeal des Flugzeugs im Monat `month` (2.2). */
  readonly typeAppeal: number;
  /** Kabinenzustand nach Kauf (100) oder Umbau (8.13). */
  readonly cabinCondition: number;
  /** Cabin rating je Klasse beim Zustand `cabinCondition` (2.4), für alle vier Klassen. */
  readonly cabinRating: Readonly<Record<CabinClass, number>>;
  /** Mittel der Cabin ratings nach Sitzen, „Cabin rating (avg.)“; ohne Sitze `NaN`. */
  readonly averageCabinRating: number;
  /** Listenpreis der eingebauten Kabine in $ von 1960 (5.13), für den Wert der Flotte. */
  readonly cabinListPrice1960: number;
  /** Preis der Sitze und Ausstattung je Klasse in $ des Monats. */
  readonly classPrice: Readonly<Record<CabinClass, number>>;
  /** Preis der kabinenweiten Extras in $ des Monats (Nachlässe negativ). */
  readonly extrasPrice: number;
  /** Neukauf: Neupreis des Typs in $ des Monats; Umbau: 0. */
  readonly typePrice: number;
  /** Umbau: Umbau-Lohn in $ des Monats (8.13); Neukauf: 0. */
  readonly labour: number;
  /** Preis je Flugzeug: Neukauf `newAircraftPrice` (8.12), Umbau `refitPrice` (8.13). */
  readonly unitPrice: number;
}

/**
 * Die Kabine, die im Dialog gewählt ist, im Monat `month` nach dem Modell. Ohne `refit` ein Neukauf: Baumonat und
 * Einbaumonat = `month`, Zustand 100, Preis `newAircraftPrice` (8.12). Mit `refit` ein Umbau: Type appeal nach dem
 * Alter des Flugzeugs, Zustand nach 8.13, Preis `refitPrice` (neue Kabine + Lohn je Sitz).
 */
export function cabinQuote(
  type: Pick<Aircraft, 'capacity' | 'basePrice' | 'popularity'>,
  choice: CabinChoice,
  month: number,
  refit?: RefitPlane,
): CabinQuote {
  const fit: CabinFit = { installedMonth: month, capacity: type.capacity, extras: choice.extras };
  const space = cabinSpace(fit);
  const seatSpaces = {} as Record<CabinClass, number>;
  for (const c of CABIN_CLASSES) seatSpaces[c] = seatSpace(c, choice.interiors[c]);

  const others: Partial<Record<ChosenClass, { seats: number; interior: ClassInterior }>> = {};
  let usedByOthers = 0;
  for (const c of CHOSEN_CLASSES) {
    others[c] = { seats: choice.seats[c], interior: choice.interiors[c] };
    usedByOthers += choice.seats[c] * seatSpaces[c];
  }
  const economy = economySeatsLeft(space, others, choice.interiors.economy);
  const seats: Record<CabinClass, number> = { ...choice.seats, economy };
  const totalSeats = CABIN_CLASSES.reduce((sum, c) => sum + seats[c], 0);
  const remaining = space - usedByOthers;
  const maxSeats = {} as Record<ChosenClass, number>;
  for (const c of CHOSEN_CLASSES) maxSeats[c] = choice.seats[c] + Math.max(0, Math.floor(remaining / seatSpaces[c]));

  const interior = {} as Record<CabinClass, InteriorScoreParts>;
  for (const c of CABIN_CLASSES) interior[c] = interiorScoreParts(c, choice.interiors[c], fit);

  const appeal = typeAppeal({
    catalogAppeal: type.popularity,
    builtMonth: refit ? refit.builtMonth : month,
    month,
    launchCustomer: refit?.launchCustomer,
  });
  const cabinCondition = refit ? Math.min(100, refitCabinCondition(refit.cabinCondition, refit.refitsDone)) : 100;
  const rating = {} as Record<CabinClass, number>;
  for (const c of CABIN_CLASSES) rating[c] = cabinRating(appeal, interior[c].total, cabinCondition);

  const priced = {} as Partial<Record<CabinClass, { seats: number; interior: ClassInterior }>>;
  for (const c of CABIN_CLASSES) priced[c] = { seats: seats[c], interior: choice.interiors[c] };
  const list = cabinListPriceParts(priced, fit);
  const classPrice = {} as Record<CabinClass, number>;
  for (const c of CABIN_CLASSES) classPrice[c] = atCost(list.classes[c], month);

  const typePrice = refit ? 0 : atCost(type.basePrice, month);
  const labour = refit ? refitLabour(totalSeats, month) : 0;
  const unitPrice = refit
    ? refitPrice(list.total, totalSeats, month)
    : newAircraftPrice(type.basePrice, list.total, month);

  return {
    space,
    seatSpace: seatSpaces,
    seats,
    totalSeats,
    usedSpace: usedByOthers + economy * seatSpaces.economy,
    overbooked: remaining < 0,
    maxSeats,
    fittedExtras: deliverableExtras(choice.extras, fit),
    interior,
    typeAppeal: appeal,
    cabinCondition,
    cabinRating: rating,
    averageCabinRating: averageCabinRating(CABIN_CLASSES.map((c) => ({ rating: rating[c], seats: seats[c] }))),
    cabinListPrice1960: list.total,
    classPrice,
    extrasPrice: atCost(list.cabinExtras, month),
    typePrice,
    labour,
    unitPrice,
  };
}

// ===========================================================================
// Angebot der Teile (Listen im Dialog)
// ===========================================================================

/** Ein Teil der Auswahl (Sitztyp, Ausstattung, Extra) mit Lieferbarkeit, Punkten und Preis. */
export interface CabinPartOffer<K extends string = string> {
  readonly key: K;
  /** Im Monat lieferbar (und groß genug, falls verlangt). */
  readonly deliverable: boolean;
  /** Erster lieferbarer Spielmonat. */
  readonly availableFrom: number;
  /** Mindest-Sitze des Typs, falls verlangt. */
  readonly minCapacity?: number;
  /** Punkte im Interior score (Sitztyp: schon × `SEAT_TYPE_FACTOR`, wie sie zählen). */
  readonly points: number;
  /** Preis in $ des Monats: Sitztyp und Ausstattung je Sitz, Extras je Flugzeug. */
  readonly price: number;
  /** Nur Sitztypen: Platzfaktor (Platz eines Sitzes = Sitzabstand × Faktor, 7.5). */
  readonly spaceFactor?: number;
}

function offer<K extends string>(
  key: K,
  item: InteriorItem,
  points: number,
  price1960: number,
  month: number,
  capacity: number,
): CabinPartOffer<K> {
  return {
    key,
    deliverable: isDeliverable(item, { installedMonth: month, capacity }),
    availableFrom: item.availableFrom,
    minCapacity: item.minCapacity,
    points,
    price: atCost(price1960, month),
  };
}

/** Sitztypen einer Klasse in der Reihenfolge der Daten (Standard zuerst). Punkte × `SEAT_TYPE_FACTOR`. */
export function seatTypeOffers(c: CabinClass, month: number, capacity: number): CabinPartOffer[] {
  return Object.entries(SEAT_TYPE_POINTS[c]).map(([key, item]) =>
    ({
      ...offer(key, item, SEAT_TYPE_FACTOR * item.points, SEAT_TYPE_PRICE_1960[c][key] ?? 0, month, capacity),
      spaceFactor: SEAT_SPACE_FACTOR[c][key] ?? 1,
    }),
  );
}

/** Ausstattung einer Klasse (Schlüssel wie `FEATURE_POINTS`). */
export function featureOffers(c: CabinClass, month: number, capacity: number): CabinPartOffer[] {
  return Object.entries(FEATURE_POINTS[c]).map(([key, item]) =>
    offer(key, item, item.points, FEATURE_PRICE_1960[c][key] ?? 0, month, capacity),
  );
}

/** Kabinenweite Extras. */
export function extraOffers(month: number, capacity: number): CabinPartOffer<CabinExtra>[] {
  return (Object.keys(CABIN_EXTRA_POINTS) as CabinExtra[]).map((key) =>
    offer(key, CABIN_EXTRA_POINTS[key], CABIN_EXTRA_POINTS[key].points, CABIN_EXTRA_PRICE_1960[key], month, capacity),
  );
}
