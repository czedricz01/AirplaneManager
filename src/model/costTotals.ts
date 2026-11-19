/**
 * Summen der Kosten: SPEZIFIKATION 5.9 (feste Kosten und Ergebnis je Strecke), 5.14 (Werbung und Frequent
 * flyer) und 5.16 (Kosten der Gesellschaft je Monat). Teil von Abschnitt 5, aus `costs.ts` ausgelagert
 * (Paket 3.5b).
 *
 * Strecken-Werte gelten **je Woche**, beide Richtungen zusammen; Flugzeug-, Werbe- und Abschnitt-8-Posten
 * **je Monat**. Monat = Woche × `WEEKS_PER_MONTH` (E5). Die Bausteine kommen als fertige Zahlen aus
 * `costs.ts`, `airportCosts.ts` und `fleet.ts` (wie F14); hier wird nur zusammengezählt, damit jeder Dollar
 * genau einmal zählt.
 */

import { atCost, timeOf } from './basics';
import {
  CABIN_CLASSES,
  CAMPAIGN_COST_1960,
  FFP_BASE_COST_1960,
  RIVAL_SUBSIDY_ENABLED,
  SUBSIDY_HIGH_1960,
  SUBSIDY_HIGH_UNTIL,
  SUBSIDY_LOW_1960,
  SUBSIDY_LOW_FROM,
  WEEKS_PER_MONTH,
  type CabinClass,
  type CampaignLevel,
} from './constants';
import type { PassengerCostParts } from './costs';
import type { FleetValueResultParts } from './fleet';

// ---------------------------------------------------------------------------
// 5.9 Feste Kosten je Strecke
// ---------------------------------------------------------------------------

/** Ein Abflughafen einer Strecke für den Slot-Anteil. */
export interface SlotUse {
  /** Abflüge der Strecke je Woche dort, nach Plan (auch gestrichene und gecharterte Flüge belegen ihren Slot). */
  readonly departures: number;
  /** `slotRent` der Gesellschaft dort für die Klasse des Flugzeugs (5.10). */
  readonly slotRent: number;
}

/**
 * Slot-Anteil einer Strecke je Woche: `Σ Abflughafen x: belegte Slots der Strecke in x × slotRent(x, Klasse)`.
 * Belegte Slots = Abflüge je Woche (1.6, E50). SPEZIFIKATION 5.9.
 */
export function slotShare(uses: readonly SlotUse[]): number {
  return uses.reduce((sum, use) => sum + use.departures * use.slotRent, 0);
}

/** Blockstunden einer Strecke je Woche nach Plan: `blockMinutes × Flugabschnitte / 60`. SPEZIFIKATION 5.9. */
export function routeBlockHours(blockMinutes: number, scheduledLegs: number): number {
  return (blockMinutes * scheduledLegs) / 60;
}

/** Eingaben für `aircraftShare`. */
export interface AircraftShareInput {
  /** `aircraftUpkeep` des Flugzeugs je Monat (5.12). */
  readonly monthlyUpkeep: number;
  /** `ageDepreciation` des Flugzeugs je Monat (5.13). */
  readonly monthlyAgeDepreciation: number;
  /** Blockstunden dieser Strecke je Woche nach Plan. */
  readonly routeBlockHours: number;
  /** Blockstunden aller Strecken des Flugzeugs je Woche nach Plan (diese eingeschlossen). */
  readonly aircraftBlockHours: number;
}

/**
 * Flugzeug-Anteil einer Strecke je Woche:
 * `(aircraftUpkeep + ageDepreciation) / WEEKS_PER_MONTH × Blockstunden der Strecke / Blockstunden des Flugzeugs`.
 * Fliegt das Flugzeug nur diese Strecke, trägt sie seine ganzen Kosten (gewollt: zeigt schlechte Auslastung).
 * Mehr Strecken-Stunden als Flugzeug-Stunden oder ein Flugzeug ohne Stunden sind ein Fehler. SPEZIFIKATION 5.9, E57.
 */
export function aircraftShare(input: AircraftShareInput): number {
  if (!(input.aircraftBlockHours > 0) || input.routeBlockHours > input.aircraftBlockHours) {
    throw new Error('Blockstunden der Strecke passen nicht zum Flugzeug');
  }
  return (
    ((input.monthlyUpkeep + input.monthlyAgeDepreciation) / WEEKS_PER_MONTH) *
    (input.routeBlockHours / input.aircraftBlockHours)
  );
}

/** Feste Kosten einer Strecke je Woche, nach Posten. */
export interface FixedWeeklyCostInput {
  /** `fuelCost` (5.3). */
  readonly fuel: number;
  /** `crewCost` (5.4). */
  readonly crew: number;
  /** `landingCost` (5.5). */
  readonly landing: number;
  /** `slotShare`. */
  readonly slotShare: number;
  /** `aircraftShare`. */
  readonly aircraftShare: number;
}

/** `fixedWeeklyCost` mit Zwischensummen für Planer und Streckendetails. */
export interface FixedWeeklyCostParts extends FixedWeeklyCostInput {
  /** `flightOpsCost = fuel + crew + landing`. */
  readonly flightOps: number;
  /** „before aircraft costs“: `flightOps + slotShare` (E57). */
  readonly beforeAircraft: number;
  /** `fixedWeeklyCost = flightOps + slotShare + aircraftShare`. */
  readonly total: number;
}

/**
 * Feste Kosten einer Strecke je Woche, egal wie viele Fluggäste kommen:
 * `flightOpsCost (Treibstoff + Besatzung + Landung) + slotShare + aircraftShare` (E57). SPEZIFIKATION 5.9.
 */
export function fixedWeeklyCostParts(input: FixedWeeklyCostInput): FixedWeeklyCostParts {
  const flightOps = input.fuel + input.crew + input.landing;
  const beforeAircraft = flightOps + input.slotShare;
  return { ...input, flightOps, beforeAircraft, total: beforeAircraft + input.aircraftShare };
}

/** Feste Kosten einer Strecke je Woche. Siehe `fixedWeeklyCostParts`. SPEZIFIKATION 5.9. */
export function fixedWeeklyCost(input: FixedWeeklyCostInput): number {
  return fixedWeeklyCostParts(input).total;
}

/** Fluggäste einer Klasse und was jeder kostet. */
export interface ClassPassengerCost {
  /** Fluggäste je Woche. */
  readonly passengers: number;
  /** `costPerPassengerParts` bzw. `transferCostPerPassengerParts` der Klasse. */
  readonly cost: PassengerCostParts;
}

/** Kosten je Klasse; fehlende Klasse = keine Fluggäste. */
export type ClassPassengerCosts = Readonly<Partial<Record<CabinClass, ClassPassengerCost>>>;

/**
 * Kosten aller Fluggäste einer Strecke je Woche, nach Posten:
 * `Σ c: directPax(c) × costPerPassenger(c) + Σ c: transferPax(c) × transferCostPerPassenger(c)`.
 * Umsteiger zählen auf jeder ihrer Teilstrecken (4.14). SPEZIFIKATION 5.9.
 */
export function routePassengerCost(direct: ClassPassengerCosts, transfer: ClassPassengerCosts = {}): PassengerCostParts {
  let catering = 0;
  let fees = 0;
  let ffp = 0;
  for (const group of [direct, transfer]) {
    for (const cabinClass of CABIN_CLASSES) {
      const entry = group[cabinClass];
      if (!entry) continue;
      catering += entry.passengers * entry.cost.catering;
      fees += entry.passengers * entry.cost.fees;
      ffp += entry.passengers * entry.cost.ffp;
    }
  }
  return { catering, fees, ffp, total: catering + fees + ffp };
}

/** Eingaben für `routeResult`. */
export interface RouteResultInput {
  /** `routeRevenue` je Woche (4.7). */
  readonly revenue: number;
  /** `routePassengerCost(...).total` je Woche. */
  readonly passengerCost: number;
  /** `fixedWeeklyCost` je Woche. */
  readonly fixedWeeklyCost: number;
}

/**
 * Ergebnis einer Strecke je Woche: `routeRevenue − Kosten aller Fluggäste − fixedWeeklyCost`. Planer-Hauptzahl
 * (4.12, E26, E57), Streckenliste und Bericht lesen diesen Wert (R2). SPEZIFIKATION 5.9.
 */
export function routeResult(input: RouteResultInput): number {
  return input.revenue - input.passengerCost - input.fixedWeeklyCost;
}

// ---------------------------------------------------------------------------
// 5.14 Werbung und Frequent flyer
// ---------------------------------------------------------------------------

/**
 * Kosten einer Werbe-Kampagne je laufendem Monat: `atCost(CAMPAIGN_COST_1960[Stufe], month)`. Die eigene
 * Teuerung von 3 % je Jahr entfällt (E6, R5). KI: keine Werbung. SPEZIFIKATION 5.14.
 */
export function campaignCost(level: CampaignLevel, month: number): number {
  const cost = CAMPAIGN_COST_1960[level];
  if (cost === undefined) throw new Error(`Unbekannte Kampagnen-Stufe: ${String(level)}`);
  return atCost(cost, month);
}

/**
 * Grundbetrag des Frequent-flyer-Programms je Monat: `atCost(FFP_BASE_COST_1960, month)`, solange es läuft,
 * sonst 0. Dazu `ffpCostPerPassenger` je Reise (5.8). KI: kein Programm. SPEZIFIKATION 5.14.
 */
export function ffpBaseCost(programActive: boolean, month: number): number {
  return programActive ? atCost(FFP_BASE_COST_1960, month) : 0;
}

// ---------------------------------------------------------------------------
// 5.16 Kosten der Gesellschaft je Monat
// ---------------------------------------------------------------------------

/** Kosten einer Strecke je Woche, die im Monatsbericht nach Posten stehen. */
export interface RouteWeeklyCosts {
  /** `fuelCost`. */
  readonly fuel: number;
  /** `crewCost`. */
  readonly crew: number;
  /** `landingCost`. */
  readonly landing: number;
  /** `routePassengerCost` (Verpflegung, Gebühren, Frequent flyer je Fluggast). */
  readonly passengers: PassengerCostParts;
}

/** Posten aus Abschnitt 8, je Monat (bis Paket 3.8 sie liefert, kommen sie als Zahl). */
export interface MonthEventCosts {
  /** Charter-Gebühren (E32). */
  readonly charter: number;
  /** Krisen-Antworten (E35). */
  readonly crisisResponses: number;
  /** Zinsen der Kreditlinie (E34). */
  readonly interest: number;
  /** Schäden aus Ereignissen. */
  readonly damages: number;
}

/** Eingaben für `monthlyCosts`. */
export interface MonthlyCostsInput {
  /** Je Strecke, je Woche. */
  readonly routes: readonly RouteWeeklyCosts[];
  /** `airportUpkeep` je Flughafen, je Woche (Slots, Stände, Schalter, Einrichtungen). */
  readonly airportUpkeep: readonly number[];
  /** `aircraftUpkeep` je Flugzeug, je Monat. */
  readonly aircraftUpkeep: readonly number[];
  /** `fleetValueResultParts` des Monats. */
  readonly fleetValue: FleetValueResultParts;
  /** `campaignCost` je laufender Kampagne, je Monat. */
  readonly campaigns: readonly number[];
  /** `ffpBaseCost` des Monats. */
  readonly ffpBase: number;
  /** Posten aus Abschnitt 8, je Monat. */
  readonly events: MonthEventCosts;
  /** `ownerFeeIncome` je Flughafen, je Woche. */
  readonly ownerFeeIncome: readonly number[];
  /** Zuschuss des Monats (`subsidyIncome`, 7.14); fehlt = 0. */
  readonly subsidy?: number;
}

/** Kosten der Gesellschaft im Monat, nach den Zeilen des Berichts. Kosten positiv; `airportIncome` mindert. */
export interface MonthlyCosts {
  readonly fuel: number;
  readonly crew: number;
  readonly landingFees: number;
  readonly passengerFees: number;
  readonly catering: number;
  readonly airportUpkeep: number;
  readonly aircraftUpkeep: number;
  /** „Depreciation“ = −`fleetValueResult.depreciation`. */
  readonly depreciation: number;
  /** „Aircraft trades“ = −`fleetValueResult.trades`. */
  readonly aircraftTrades: number;
  /** Kampagnen, FFP-Grundbetrag und FFP je Fluggast. */
  readonly marketing: number;
  readonly charter: number;
  readonly crisisResponses: number;
  readonly interest: number;
  readonly damages: number;
  /** `ownerFeeIncome` (positiv; wird abgezogen). */
  readonly airportIncome: number;
  /** Zeile „Subsidy“ (7.14; positiv, wird abgezogen); 0 ohne Zuschuss. */
  readonly subsidy: number;
  /** Σ Kosten − `airportIncome` − `subsidy`. */
  readonly total: number;
}

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Die vollständige Liste der Kosten im Monatsergebnis (Wochenwerte × `WEEKS_PER_MONTH`, E5). Jeder Dollar
 * zählt genau einmal: Slot-Miete steht ganz in „Airport upkeep“, Flugzeug-Unterhalt in „Aircraft upkeep“,
 * Abschreibung in „Depreciation“ (die Anteile aus 5.9 sind nur Zurechnung). Einmalausgaben (Slots, Stufen,
 * Einrichtungen, Forschung, Übernahme) stehen nicht hier, nur in der Kasse. SPEZIFIKATION 5.16.
 */
export function monthlyCosts(input: MonthlyCostsInput): MonthlyCosts {
  const W = WEEKS_PER_MONTH;
  const fuel = sum(input.routes.map((r) => r.fuel)) * W;
  const crew = sum(input.routes.map((r) => r.crew)) * W;
  const landingFees = sum(input.routes.map((r) => r.landing)) * W;
  const passengerFees = sum(input.routes.map((r) => r.passengers.fees)) * W;
  const catering = sum(input.routes.map((r) => r.passengers.catering)) * W;
  const ffpPassengers = sum(input.routes.map((r) => r.passengers.ffp)) * W;
  const airportUpkeep = sum(input.airportUpkeep) * W;
  const aircraftUpkeep = sum(input.aircraftUpkeep);
  const depreciation = -input.fleetValue.depreciation;
  const aircraftTrades = -input.fleetValue.trades;
  const marketing = sum(input.campaigns) + input.ffpBase + ffpPassengers;
  const { charter, crisisResponses, interest, damages } = input.events;
  const airportIncome = sum(input.ownerFeeIncome) * W;
  const subsidy = input.subsidy ?? 0;
  const total =
    fuel +
    crew +
    landingFees +
    passengerFees +
    catering +
    airportUpkeep +
    aircraftUpkeep +
    depreciation +
    aircraftTrades +
    marketing +
    charter +
    crisisResponses +
    interest +
    damages -
    airportIncome -
    subsidy;
  return {
    fuel,
    crew,
    landingFees,
    passengerFees,
    catering,
    airportUpkeep,
    aircraftUpkeep,
    depreciation,
    aircraftTrades,
    marketing,
    charter,
    crisisResponses,
    interest,
    damages,
    airportIncome,
    subsidy,
    total,
  };
}

// ---------------------------------------------------------------------------
// 7.14 Zuschuss (E47)
// ---------------------------------------------------------------------------

/**
 * Zuschuss je Monat in $ von 1960: 450 000 bis 1985, dann gerade fallend auf 150 000 bis 2005, danach 150 000.
 * Stetige Zeit (R5). SPEZIFIKATION 7.14.
 */
export function subsidy1960(month: number): number {
  const t = timeOf(month);
  if (t <= SUBSIDY_HIGH_UNTIL) return SUBSIDY_HIGH_1960;
  if (t >= SUBSIDY_LOW_FROM) return SUBSIDY_LOW_1960;
  const share = (t - SUBSIDY_HIGH_UNTIL) / (SUBSIDY_LOW_FROM - SUBSIDY_HIGH_UNTIL);
  return SUBSIDY_HIGH_1960 + (SUBSIDY_LOW_1960 - SUBSIDY_HIGH_1960) * share;
}

/**
 * Zuschuss einer Gesellschaft mit dem Merkmal `subsidized` (die KI, 7.14) im Monat: `atCost(subsidy1960(month), month)`;
 * ohne Merkmal oder ausgeschaltet 0. Zeile „Subsidy“ im Monatsergebnis (`monthlyCosts.subsidy`). Hier statt in
 * `rivalMonth.ts`, weil der Abschluss ihn bucht und die KI nicht kennt (7.1, F43). SPEZIFIKATION 7.14.
 */
export function subsidyIncome(month: number, subsidized: boolean, enabled: boolean = RIVAL_SUBSIDY_ENABLED): number {
  return subsidized && enabled ? atCost(subsidy1960(month), month) : 0;
}

/** Monatsergebnis: Monatserlös (4.9) − `monthlyCosts`. SPEZIFIKATION 5.16. */
export function monthlyResult(monthlyRevenueValue: number, costs: Pick<MonthlyCosts, 'total'>): number {
  return monthlyRevenueValue - costs.total;
}

/**
 * Nicht zugerechnete Kosten je Woche (Anzeige): was vom Monatsergebnis nicht in den Strecken-Ergebnissen steht
 * (freie Slots, Stände, Schalter, Einrichtungen, Unterhalt geparkter Flugzeuge, Abschreibung aus Zustand und
 * Käufen, Werbung, Abschnitt-8-Posten, − Einnahmen):
 * `monthlyCosts / WEEKS_PER_MONTH − Σ Strecken (Kosten aller Fluggäste + fixedWeeklyCost)`.
 * Damit gilt Σ Strecken-Ergebnisse − nicht zugerechnet = Monatsergebnis / `WEEKS_PER_MONTH`. SPEZIFIKATION 5.16.
 */
export function unattributedWeeklyCost(
  costs: Pick<MonthlyCosts, 'total'>,
  routes: readonly { readonly passengerCost: number; readonly fixedWeeklyCost: number }[],
): number {
  return costs.total / WEEKS_PER_MONTH - sum(routes.map((r) => r.passengerCost + r.fixedWeeklyCost));
}
