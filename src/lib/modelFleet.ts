/**
 * Flotte, Verkauf, Gebrauchtmarkt, Übernahme-Kabine und Vorbestellung nach dem Modell (Paket 4.6b, docs/neubau F66).
 *
 * Die Flotten-Ansicht, das Detail-Fenster und der Markt rechneten Alter, Satisfaction, Verkaufserlös, Gebrauchtpreise
 * und Vorbestell-Preise selbst (alte Formeln, Listenpreis von 1960, `getPlaneSat`, `getAircraftResaleValue`; Art D
 * „Alter“ und „Wiederverkauf“). Hier kommt alles aus `src/model/`, mit denselben Funktionen wie der Abschluss (R2):
 * Alter und Type appeal (2.2), Cabin rating (2.4), Effizienz (5.3), Unterhalt (5.12), Wert (5.13), Verkaufserlös und
 * Gebrauchtmarkt (8.11), Vorbestellung (8.12).
 *
 * Alles hier ist rein (keine Zustände, keine globalen Daten).
 */
import { aircraftList, type Aircraft } from '../data/aircraft';
import type { ClassSetup, ConfigOutput } from '../components/ConfigurePurchaseView';
import type { OwnedAircraft } from '../components/MyFleetView';
import { averageCabinRating, cabinRating, type ClassInterior } from '../model/cabin';
import { CABIN_CLASSES, PERSONALITY_IDS, type CabinClass, type CabinExtra, type RivalPersonality } from '../model/constants';
import { aircraftEfficiency } from '../model/costs';
import { aircraftUpkeepParts, aircraftValue, fleetCommonalityFactors, newAircraftPrice, newPrice, type AircraftUpkeepParts } from '../model/fleet';
import {
  isPreorderable,
  preorderBalance,
  preorderDeliveryMonth,
  preorderDeposit,
  preorderDiscount,
  preorderQuantity,
  preorderRefund,
  preorderUnitPrice,
  resoldInMarket,
  saleProceeds,
  usedMarketPrice,
  usedOffers,
} from '../model/fleetMarket';
import type { AircraftState, ResoldPlane } from '../model/monthClose';
import { researchEffects } from '../model/progress';
import { rivalCabin, type RivalCabin } from '../model/rivals';
import { ageYears, typeAppeal } from '../model/satisfaction';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { aircraftState, catalogType, EXTRA_FLAGS, FEATURE_FLAGS, modelCabin } from './modelBridge';
import type { RivalRecord } from './modelBridgeWorld';
import type { PreOrder } from './preorders';

// ===========================================================================
// Kennzahlen eines Flugzeugs (2.2, 2.4, 5.3, 5.13, 8.11)
// ===========================================================================

/** Was die Ansichten von einem Flugzeug der Flotte zeigen, im Monat `month`. */
export interface PlaneFigures {
  /** Alter in Jahren seit dem Baumonat (2.2), mit Bruchteil. */
  readonly ageYears: number;
  /** Type appeal (2.2): Katalogwert − Alters-Abzug + Erstkunden-Bonus. */
  readonly typeAppeal: number;
  /** Effizienz mit Forschung (5.3). */
  readonly efficiency: number;
  /** Sitze je Klasse (nur Klassen mit Sitzen). */
  readonly seats: Readonly<Partial<Record<CabinClass, number>>>;
  /** Cabin rating je Klasse mit Sitzen (2.4), wie der Abschluss sie rechnet. */
  readonly cabinRating: Readonly<Partial<Record<CabinClass, number>>>;
  /** Mittel der Cabin ratings nach Sitzen, „Cabin rating (avg.)“; ohne Sitze `NaN`. */
  readonly averageCabinRating: number;
  /** Wert nach dem Wertmodell (5.13). */
  readonly value: number;
  /** Verkaufserlös an den Markt (8.11) mit dem Forschungs-Zuschlag `resaleBonus` (6.9). */
  readonly saleProceeds: number;
}

/** Kennzahlen aus einem Flugzeug im Format des Modells. */
function stateFigures(s: AircraftState, month: number, completedResearch: readonly string[]): PlaneFigures {
  const appeal = typeAppeal({ catalogAppeal: s.catalogAppeal, builtMonth: s.builtMonth, month, launchCustomer: s.launchCustomer });
  const ratings: Partial<Record<CabinClass, number>> = {};
  for (const c of CABIN_CLASSES) {
    if ((s.seats[c] ?? 0) > 0) ratings[c] = cabinRating(appeal, s.interiorScore[c] ?? 0, s.cabinCondition);
  }
  const value = aircraftValue(s, month);
  return {
    ageYears: ageYears(s.builtMonth, month),
    typeAppeal: appeal,
    efficiency: aircraftEfficiency(s.efficiency, completedResearch),
    seats: s.seats,
    cabinRating: ratings,
    averageCabinRating: averageCabinRating(CABIN_CLASSES.map((c) => ({ rating: ratings[c] ?? 0, seats: s.seats[c] ?? 0 }))),
    value,
    saleProceeds: saleProceeds(value, researchEffects(completedResearch).resaleBonus),
  };
}

/**
 * Kennzahlen eines Flugzeugs der Flotte im Monat `month`. Typ-Werte aus dem Katalog (`aircraftState`); Type appeal und
 * Cabin rating wie `routeSatisfactionSetup` im Abschluss; Verkaufserlös wie `sellAircraft` (8.11).
 */
export function planeFigures(
  plane: OwnedAircraft,
  month: number,
  completedResearch: readonly string[] = [],
  catalog: readonly Aircraft[] = aircraftList,
): PlaneFigures {
  return stateFigures(aircraftState(plane, catalog), month, completedResearch);
}

/**
 * Versicherung und Wartung eines Flugzeugs je Monat (5.12) wie im Abschluss: Flotten-Mischung über die ganze Flotte
 * (`fleetCommonalityFactors`), Forschung, halber Satz, wenn es auf keiner Strecke fliegt.
 */
export function planeUpkeep(
  plane: OwnedAircraft,
  fleet: readonly OwnedAircraft[],
  month: number,
  parked: boolean,
  completedResearch: readonly string[] = [],
  catalog: readonly Aircraft[] = aircraftList,
): AircraftUpkeepParts {
  const inFleet = fleet.some((p) => p.registration === plane.registration) ? fleet : [...fleet, plane];
  const states = inFleet.map((p) => aircraftState(p, catalog));
  const factor = fleetCommonalityFactors(states)[inFleet.findIndex((p) => p.registration === plane.registration)];
  const s = states[inFleet.findIndex((p) => p.registration === plane.registration)];
  return aircraftUpkeepParts({
    listPrice1960: s.listPrice1960,
    builtMonth: s.builtMonth,
    month,
    commonalityFactor: factor,
    parked,
    completedResearch,
  });
}

/** Alter für die Anzeige: „New“, „n mo“ oder „n y m mo“ (ganze Monate seit dem Baumonat). */
export function ageLabel(years: number): string {
  const months = Math.max(0, Math.round(years * 12));
  if (months < 1) return 'New';
  if (months < 12) return `${months} mo`;
  return `${Math.floor(months / 12)} y ${months % 12} mo`;
}

// ===========================================================================
// Kabine eines Modell-Flugzeugs im Format des Kaufdialogs
// ===========================================================================

/** Eine Klasse im Format des Kaufdialogs. */
function classSetup(c: CabinClass, seats: number, interior: ClassInterior): ClassSetup {
  const setup: ClassSetup = { seats, pitch: interior.pitch, seatType: interior.seatType, hasIFE: false, hasPower: false };
  for (const key of interior.features) {
    const flag = FEATURE_FLAGS[c][key];
    if (flag) (setup as Record<string, unknown>)[flag] = true;
  }
  return setup;
}

/** Eine Kabine der KI (7.5) im Format des Kaufdialogs: Sitze, Sitztyp, Sitzabstand, Ausstattung, eingebaute Extras. */
export function rivalCabinConfig(cabin: RivalCabin): ConfigOutput {
  const details = {
    first: classSetup('first', cabin.seats.first, cabin.interiors.first),
    business: classSetup('business', cabin.seats.business, cabin.interiors.business),
    premium: classSetup('premium', cabin.seats.premium, cabin.interiors.premium),
    economy: classSetup('economy', cabin.seats.economy, cabin.interiors.economy),
  } as ConfigOutput['details'];
  for (const e of Object.keys(EXTRA_FLAGS) as CabinExtra[]) {
    (details as Record<string, unknown>)[EXTRA_FLAGS[e]] = cabin.fit.extras.includes(e);
  }
  return { first: cabin.seats.first, business: cabin.seats.business, premium: cabin.seats.premium, economy: cabin.seats.economy, details };
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Die Kabine im Kaufdialog-Format ergibt dieselben Modell-Werte wie das Flugzeug (Sitze, Interior score, Listenpreis). */
function sameCabin(config: ConfigOutput, s: AircraftState): boolean {
  const m = modelCabin(config, { installedMonth: s.cabinInstalledMonth, capacity: s.capacity });
  return (
    near(m.cabinListPrice1960, s.cabinListPrice1960) &&
    m.hasWifi === s.hasWifi &&
    m.hasPremiumGalley === s.hasPremiumGalley &&
    CABIN_CLASSES.every((c) => (m.seats[c] ?? 0) === (s.seats[c] ?? 0) && near(m.interiorScore[c] ?? 0, s.interiorScore[c] ?? 0))
  );
}

/** Einfache Kabine mit den Sitzen des Flugzeugs: Standard-Sitze, Sitzabstand des Dialogs, keine Ausstattung. */
function plainSeatsConfig(s: AircraftState, type: Aircraft): ConfigOutput {
  const base = defaultCabin(type).config;
  const seat = (c: CabinClass) => s.seats[c] ?? 0;
  return {
    first: seat('first'),
    business: seat('business'),
    premium: seat('premium'),
    economy: seat('economy'),
    details: {
      ...base.details,
      first: { ...base.details.first, seats: seat('first') },
      business: { ...base.details.business, seats: seat('business') },
      premium: { ...base.details.premium, seats: seat('premium') },
      economy: { ...base.details.economy, seats: seat('economy') },
    },
  };
}

/** Kabine eines Flugzeugs und ob sie genau die des Modells ist. */
export interface StateCabin {
  readonly config: ConfigOutput;
  /** `true`: Die Kabine hat dieselben Modell-Werte wie das Flugzeug (Sitze, Interior score, Listenpreis). */
  readonly exact: boolean;
}

/**
 * Kabine eines Modell-Flugzeugs (KI oder weiterverkauft) im Format des Kaufdialogs. Eine KI richtet jedes Flugzeug im
 * Baumonat nach ihrer Persönlichkeit ein (`rivalCabin`, 7.5) und erneuert später nur dieselbe Kabine (F43); gesucht
 * wird die Persönlichkeit, deren Kabine genau die Modell-Werte ergibt (`personality` zuerst). Ohne Treffer (z. B. ein
 * früheres Flugzeug des Spielers) die Sitze des Flugzeugs mit Standard-Sitzen; `exact` sagt, ob diese genau passen
 * (so bei der Auslieferungs-Kabine).
 */
export function stateCabin(s: AircraftState, type: Aircraft, personality?: RivalPersonality): StateCabin {
  const order = personality ? [personality, ...PERSONALITY_IDS.filter((p) => p !== personality)] : PERSONALITY_IDS;
  for (const p of order) {
    const config = rivalCabinConfig(rivalCabin(p, catalogType(type), s.builtMonth));
    if (sameCabin(config, s)) return { config, exact: true };
  }
  const plain = plainSeatsConfig(s, type);
  return { config: plain, exact: sameCabin(plain, s) };
}

/** Mittel der Interior scores nach Sitzen, für das alte Feld `baseInteriorPop` (bis 5.1 / 5.2, F65 (5)). */
function baseInteriorPopOf(config: ConfigOutput, installedMonth: number, capacity: number): number {
  const m = modelCabin(config, { installedMonth, capacity });
  let seats = 0;
  let weighted = 0;
  for (const c of CABIN_CLASSES) {
    seats += m.seats[c] ?? 0;
    weighted += (m.seats[c] ?? 0) * (m.interiorScore[c] ?? 0);
  }
  return seats > 0 ? weighted / seats : 50;
}

/** Ein Flugzeug für die Flotte des Spielers aus einem Modell-Flugzeug: Baumonat, Kabine, Einbaumonat, Zustand bleiben. */
function ownedFromState(
  s: AircraftState,
  type: Aircraft,
  config: ConfigOutput,
  opts: { readonly hub: string; readonly existingRegistrations: readonly string[] },
): OwnedAircraft {
  const [made] = createOwnedAircraft(type, 1, {
    config,
    baseInteriorPop: baseInteriorPopOf(config, s.cabinInstalledMonth, type.capacity),
    hub: opts.hub,
    existingRegistrations: [...opts.existingRegistrations],
    purchasedAt: s.builtMonth,
  });
  return {
    ...made,
    conditionGeneral: s.airframeCondition,
    conditionInterior: s.cabinCondition,
    cabinInstalledAt: s.cabinInstalledMonth,
  };
}

const typeOf = (id: string, catalog: readonly Aircraft[]): Aircraft | undefined => catalog.find((a) => a.id === id);

// ===========================================================================
// Übernahme (7.16): Flugzeuge mit ihrer Kabine
// ===========================================================================

/**
 * Die Flugzeuge einer übernommenen KI für die Flotte des Spielers: Baumonat, Kabine (`stateCabin` mit der
 * Persönlichkeit der KI), Einbaumonat, Zustand, bisherige Überholungen und Umbauten bleiben; Kennzeichen neu (Land des
 * Drehkreuzes `hub`). Ihr Wert (`planesValue`) ist der Wert der KI-Flugzeuge im Modell.
 */
export function takeoverFleet(
  rival: RivalRecord,
  hub: string,
  existingRegistrations: readonly string[],
  catalog: readonly Aircraft[] = aircraftList,
): OwnedAircraft[] {
  const agent = rival.company.agent as { personality?: RivalPersonality; overhauls?: Record<string, number>; refits?: Record<string, number> } | undefined;
  const taken = [...existingRegistrations];
  const planes: OwnedAircraft[] = [];
  for (const s of rival.company.aircraft) {
    const type = typeOf(s.typeId, catalog);
    if (!type) continue;
    const { config } = stateCabin(s, type, agent?.personality);
    const plane = ownedFromState(s, type, config, { hub, existingRegistrations: taken });
    taken.push(plane.registration);
    planes.push({
      ...plane,
      hubId: hub,
      generalChecksDone: agent?.overhauls?.[s.id] ?? 0,
      refitsDone: agent?.refits?.[s.id] ?? 0,
    });
  }
  return planes;
}

// ===========================================================================
// Gebrauchtmarkt (8.11)
// ===========================================================================

/** Ein Angebot im Gebrauchtmarkt. */
export interface UsedListing {
  /** Neues Angebot: `<Monat>:<n>` (wie `usedOffers`); weiterverkauft: `resold:<Verkaufsmonat>:<Kennung>`. */
  readonly id: string;
  readonly typeId: string;
  /** `offer` = neues Angebot des Monats; `resold` = an den Markt verkauftes Flugzeug (Spieler, KI, Auflösung). */
  readonly source: 'offer' | 'resold';
  readonly builtMonth: number;
  readonly airframeCondition: number;
  readonly cabinCondition: number;
  /** Kennung im Modell (nur `resold`): Kennzeichen des Spielers oder Kennung der KI (`rival-<Kürzel>-…`). */
  readonly planeId?: string;
  readonly soldMonth?: number;
  /** Einbaumonat der Kabine (neue Angebote: Baumonat). */
  readonly cabinInstalledMonth: number;
  /** Kabine, die der Käufer bekommt; neue Angebote: Auslieferungs-Kabine (alles Economy, 74 cm, keine Extras). */
  readonly config: ConfigOutput;
  /** Die Kabine ist genau die des verkauften Flugzeugs (sonst die Sitze mit Standard-Sitzen, `stateCabin`). */
  readonly exactCabin: boolean;
  /** Kennzahlen des Flugzeugs, so wie der Käufer es bekommt (Wert, Cabin rating, Type appeal). */
  readonly figures: PlaneFigures;
  /** Preis = `usedPrice(aircraftValue)` des Flugzeugs, wie der Käufer es bekommt (8.11). */
  readonly price: number;
  /** Neupreis des Typs im Monat (`newPrice`, ohne Kabine). */
  readonly newPrice: number;
}

/** Das Flugzeug eines Angebots, wie es in die Flotte käme (Kennzeichen noch leer). */
function draftPlane(
  listing: Pick<UsedListing, 'builtMonth' | 'airframeCondition' | 'cabinCondition' | 'config' | 'cabinInstalledMonth'>,
  type: Aircraft,
): OwnedAircraft {
  const cabinInstalledMonth = listing.cabinInstalledMonth;
  return {
    ...type,
    registration: '',
    purchasedAt: listing.builtMonth,
    conditionGeneral: listing.airframeCondition,
    conditionInterior: listing.cabinCondition,
    config: listing.config,
    baseInteriorPop: baseInteriorPopOf(listing.config, cabinInstalledMonth, type.capacity),
    refitsDone: 0,
    cabinInstalledAt: cabinInstalledMonth,
  };
}

function listing(
  base: Omit<UsedListing, 'figures' | 'price' | 'newPrice'>,
  type: Aircraft,
  month: number,
  completedResearch: readonly string[],
  catalog: readonly Aircraft[],
): UsedListing {
  const s = aircraftState(draftPlane(base, type), catalog);
  return {
    ...base,
    figures: stateFigures(s, month, completedResearch),
    price: usedMarketPrice(s, month),
    newPrice: newPrice(type.basePrice, month),
  };
}

/**
 * Der Gebrauchtmarkt im Monat `month`: die neuen Angebote (`usedOffers`, gleiche in jedem Spiel, 8.3) und die
 * weiterverkauften Flugzeuge (`resoldInMarket`: höchstens `USED_RESOLD_MONTHS` Monate, die neuesten `USED_RESOLD_MAX`).
 * Preis je Angebot = `usedPrice(aircraftValue)` des Flugzeugs, so wie der Käufer es bekommt (R2).
 *
 * @param resold `world.resold` des Modell-Spielstands (gespeichert in `modelWorld`).
 */
export function usedMarket(
  month: number,
  resold: readonly ResoldPlane[],
  completedResearch: readonly string[] = [],
  catalog: readonly Aircraft[] = aircraftList,
): UsedListing[] {
  const out: UsedListing[] = [];
  for (const o of usedOffers(catalog, month)) {
    const type = typeOf(o.typeId, catalog);
    if (!type) continue;
    out.push(
      listing(
        {
          id: o.id,
          typeId: o.typeId,
          source: 'offer',
          builtMonth: o.builtMonth,
          airframeCondition: o.airframeCondition,
          cabinCondition: o.cabinCondition,
          cabinInstalledMonth: o.builtMonth,
          config: defaultCabin(type).config,
          exactCabin: true,
        },
        type,
        month,
        completedResearch,
        catalog,
      ),
    );
  }
  for (const p of resoldInMarket(resold, month)) {
    const type = typeOf(p.typeId, catalog);
    if (!type) continue;
    const cabin = stateCabin(p, type);
    out.push(
      listing(
        {
          id: resoldListingId(p),
          typeId: p.typeId,
          source: 'resold',
          builtMonth: p.builtMonth,
          airframeCondition: p.airframeCondition,
          cabinCondition: p.cabinCondition,
          planeId: p.id,
          soldMonth: p.soldMonth,
          cabinInstalledMonth: p.cabinInstalledMonth,
          config: cabin.config,
          exactCabin: cabin.exact,
        },
        type,
        month,
        completedResearch,
        catalog,
      ),
    );
  }
  return out;
}

/** Kennung eines weiterverkauften Flugzeugs im Markt. */
export const resoldListingId = (p: Pick<ResoldPlane, 'id' | 'soldMonth'>): string => `resold:${p.soldMonth}:${p.id}`;

/** Ohne das gekaufte weiterverkaufte Flugzeug (es verlässt den Markt). */
export function withoutResold(resold: readonly ResoldPlane[], listingId: string): readonly ResoldPlane[] {
  const left = resold.filter((p) => resoldListingId(p) !== listingId);
  return left.length === resold.length ? resold : left;
}

/** Ein an den Markt verkauftes Flugzeug des Spielers kommt mit Baumonat, Zustand und Kabine in den Markt (8.11, E49). */
export function resoldPlane(plane: OwnedAircraft, month: number, catalog: readonly Aircraft[] = aircraftList): ResoldPlane {
  return { ...aircraftState(plane, catalog), soldMonth: month };
}

/** Kürzel der KI, die ein weiterverkauftes Flugzeug verkauft hat (`rival-<Kürzel>-…`), sonst `null`. */
export function resoldSellerCode(planeId: string | undefined): string | null {
  const m = /^rival-([^-]+)-/.exec(planeId ?? '');
  return m ? m[1] : null;
}

/**
 * Das gekaufte Flugzeug für die Flotte: Baumonat, Zustand, Kabine und Einbaumonat des Angebots (8.11), Kennzeichen
 * neu. Sein Wert ist der, aus dem der Preis kommt.
 */
export function usedPurchase(
  l: UsedListing,
  opts: { readonly hub: string; readonly existingRegistrations: readonly string[] },
  catalog: readonly Aircraft[] = aircraftList,
): OwnedAircraft | null {
  const type = typeOf(l.typeId, catalog);
  if (!type) return null;
  const [made] = createOwnedAircraft(type, 1, {
    config: l.config,
    baseInteriorPop: draftPlane(l, type).baseInteriorPop,
    hub: opts.hub,
    existingRegistrations: [...opts.existingRegistrations],
    purchasedAt: l.builtMonth,
  });
  return { ...made, conditionGeneral: l.airframeCondition, conditionInterior: l.cabinCondition, cabinInstalledAt: l.cabinInstalledMonth };
}

// ===========================================================================
// Vorbestellung (8.12)
// ===========================================================================

/** Vorbestellbare Typen im Monat `month`, nach Erstauslieferung sortiert (`isPreorderable`). */
export function preorderableTypes(month: number, catalog: readonly Aircraft[] = aircraftList): Aircraft[] {
  return catalog.filter((a) => isPreorderable(a, month)).sort((a, b) => a.firstDeliveryOffset - b.firstDeliveryOffset);
}

/** `valueBase` eines neuen Flugzeugs mit Auslieferungs-Kabine im Monat `month` (Kabine wie geliefert, eingebaut im Liefermonat). */
function newPlaneBase(type: Aircraft, cabinMonth: number, month: number): number {
  const cabin = modelCabin(defaultCabin(type).config, { installedMonth: cabinMonth, capacity: type.capacity });
  return newAircraftPrice(type.basePrice, cabin.cabinListPrice1960, month);
}

/** Angebot einer Vorbestellung. */
export interface PreorderQuote {
  readonly quantity: number;
  readonly discount: number;
  readonly deliveryMonth: number;
  /** Preis je Flugzeug im Geld des Liefermonats (`preorderUnitPrice`, 8.12). */
  readonly unitPrice: number;
  readonly total: number;
  /** Anzahlung jetzt: `PREORDER_DEPOSIT_SHARE` × Preis mit dem Wert des Bestellmonats × Stück. */
  readonly deposit: number;
  /** Rest bei Lieferung im geplanten Liefermonat. */
  readonly balance: number;
}

/** Was eine Bestellung von `quantity` Flugzeugen kostet und wann sie kommt (8.12), wie der Abschluss sie bucht. */
export function preorderQuote(type: Aircraft, quantity: number, month: number): PreorderQuote {
  const n = preorderQuantity(quantity);
  const deliveryMonth = preorderDeliveryMonth(type.firstDeliveryOffset, n);
  const atDelivery = newPlaneBase(type, deliveryMonth, deliveryMonth);
  const deposit = preorderDeposit(newPlaneBase(type, deliveryMonth, month), n);
  const unitPrice = preorderUnitPrice(atDelivery, n);
  return {
    quantity: n,
    discount: preorderDiscount(n),
    deliveryMonth,
    unitPrice,
    total: unitPrice * n,
    deposit,
    balance: preorderBalance(atDelivery, n, deposit),
  };
}

/** Eine neue Bestellung der Oberfläche aus dem Angebot. `unitPrice` ist nur Anzeige; bei Lieferung rechnet das Modell. */
export function preorderOf(type: Aircraft, quantity: number, month: number, id: string): PreOrder {
  const q = preorderQuote(type, quantity, month);
  return {
    id,
    aircraftId: type.id,
    quantity: q.quantity,
    placedOffset: month,
    deliveryOffset: q.deliveryMonth,
    unitPrice: q.unitPrice,
    deposit: q.deposit,
    postponed: 0,
  };
}

/** Zahlen einer offenen Bestellung: Rest bei Lieferung im (verschobenen) Liefermonat und Erstattung bei Storno. */
export function preorderFigures(order: PreOrder, catalog: readonly Aircraft[] = aircraftList): { readonly unitPrice: number; readonly balance: number; readonly refund: number } {
  const type = typeOf(order.aircraftId, catalog);
  if (!type) return { unitPrice: order.unitPrice, balance: order.unitPrice * order.quantity - order.deposit, refund: preorderRefund(order.deposit) };
  const atDelivery = newPlaneBase(type, order.deliveryOffset, order.deliveryOffset);
  return {
    unitPrice: preorderUnitPrice(atDelivery, order.quantity),
    balance: preorderBalance(atDelivery, order.quantity, order.deposit),
    refund: preorderRefund(order.deposit),
  };
}
