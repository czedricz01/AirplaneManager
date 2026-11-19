/**
 * Kosten der Flotte: SPEZIFIKATION 5.12 (Flugzeug-Unterhalt) und 5.13 (Wertmodell und Abschreibung).
 * Teil von Abschnitt 5, aus `costs.ts` ausgelagert (Paket 3.5b).
 *
 * Unterhalt und Abschreibung gelten **je Monat**. Ein Wertmodell für Spieler, KI, Gebrauchtmarkt,
 * Kreditlinie und Übernahme (E29, R13). Alter immer seit dem **Baumonat** (wie 2.2). Alles ungerundet (R4).
 */

import { atCost, clamp } from './basics';
import {
  AIRFRAME_VALUE_SHARE,
  COMMONALITY_DISCOUNTS,
  CONDITION_VALUE_SPAN,
  DEPRECIATION_YEARS,
  FREE_FAMILIES,
  INSURANCE_RATE,
  MAINTENANCE_FULL_AGE,
  MAINTENANCE_RATE_NEW,
  MAINTENANCE_RATE_OLD,
  PARKED_SHARE,
  RESIDUAL_SHARE,
  VARIETY_PENALTY_MAX,
  VARIETY_PENALTY_PER_FAMILY,
} from './constants';
import { researchCostFactor } from './costs';
import { ageYears } from './satisfaction';

// ---------------------------------------------------------------------------
// 5.12 Flugzeug-Unterhalt
// ---------------------------------------------------------------------------

/**
 * Neupreis eines Typs im Monat `month`: `atCost(LIST_PRICE_1960[type], month)`. Der Listenpreis ist das Feld
 * `basePrice` in `src/data/aircraft.ts`, gelesen als Wert von 1960 (E54). SPEZIFIKATION 5.12.
 */
export function newPrice(listPrice1960: number, month: number): number {
  return atCost(listPrice1960, month);
}

/**
 * Wartungsprogramm je Jahr als Anteil des Neupreises: von `MAINTENANCE_RATE_NEW` (Alter 0) gerade bis
 * `MAINTENANCE_RATE_OLD` (ab `MAINTENANCE_FULL_AGE` Jahren). SPEZIFIKATION 5.12.
 */
export function maintenanceRate(age: number): number {
  return MAINTENANCE_RATE_NEW + (MAINTENANCE_RATE_OLD - MAINTENANCE_RATE_NEW) * clamp(age / MAINTENANCE_FULL_AGE, 0, 1);
}

/** Wartungs-Nachlass für ein Flugzeug, dessen Familie `familySize` Flugzeuge in der Flotte hat (0 … 15 %). SPEZIFIKATION 5.12. */
export function familyDiscount(familySize: number): number {
  return COMMONALITY_DISCOUNTS.find((d) => familySize >= d.from)?.discount ?? 0;
}

/** Wartungs-Zuschlag auf jedes Flugzeug für `families` Familien in der Flotte: 3 % je Familie über 3, höchstens 30 %. SPEZIFIKATION 5.12. */
export function varietyPenalty(families: number): number {
  return Math.min(VARIETY_PENALTY_MAX, Math.max(0, families - FREE_FAMILIES) * VARIETY_PENALTY_PER_FAMILY);
}

/**
 * Flotten-Mischung eines Flugzeugs: `1 + varietyPenalty(Familien der Flotte) − familyDiscount(Größe der eigenen
 * Familie)`. Für Spieler und KI (E44, E45). SPEZIFIKATION 5.12.
 */
export function commonalityFactor(familySize: number, familiesInFleet: number): number {
  return 1 + varietyPenalty(familiesInFleet) - familyDiscount(familySize);
}

/**
 * `commonalityFactor` für jedes Flugzeug einer Flotte, in derselben Reihenfolge. Familie = Feld `family` des
 * Typs (`src/data/aircraft.ts`). SPEZIFIKATION 5.12.
 */
export function fleetCommonalityFactors(fleet: readonly { readonly family: string }[]): number[] {
  const counts = new Map<string, number>();
  for (const plane of fleet) counts.set(plane.family, (counts.get(plane.family) ?? 0) + 1);
  return fleet.map((plane) => commonalityFactor(counts.get(plane.family) as number, counts.size));
}

/** Eingaben für `aircraftUpkeep`. */
export interface AircraftUpkeepInput {
  /** Listenpreis des Typs in $ von 1960 (`basePrice`). */
  readonly listPrice1960: number;
  /** Baumonat (Alter wie 2.2). */
  readonly builtMonth: number;
  readonly month: number;
  /** `commonalityFactor` des Flugzeugs. */
  readonly commonalityFactor: number;
  /** Auf keiner Strecke eingesetzt (gecharterte Flüge zählen als eingesetzt, E32). */
  readonly parked: boolean;
  /** Ids der fertigen Forschungen (KI: keine). */
  readonly completedResearch?: readonly string[];
}

/** Unterhalt eines Flugzeugs je Monat, nach Posten. */
export interface AircraftUpkeepParts {
  readonly insurance: number;
  readonly maintenance: number;
  readonly total: number;
}

/**
 * Versicherung und Wartungsprogramm eines Flugzeugs je Monat, ob es fliegt oder steht:
 * `newPrice × (INSURANCE_RATE + maintenanceRate(Alter) × commonalityFactor × researchCostFactor(maintenance)) / 12
 *  × (PARKED_SHARE, wenn geparkt)`. Bezug ist der **heutige** Neupreis (laufender Aufwand). SPEZIFIKATION 5.12.
 */
export function aircraftUpkeepParts(input: AircraftUpkeepInput): AircraftUpkeepParts {
  const price = newPrice(input.listPrice1960, input.month);
  const share = (input.parked ? PARKED_SHARE : 1) / 12;
  const insurance = price * INSURANCE_RATE * share;
  const maintenance =
    price *
    maintenanceRate(ageYears(input.builtMonth, input.month)) *
    input.commonalityFactor *
    researchCostFactor('maintenance', input.completedResearch) *
    share;
  return { insurance, maintenance, total: insurance + maintenance };
}

/** Unterhalt eines Flugzeugs je Monat. Siehe `aircraftUpkeepParts`. SPEZIFIKATION 5.12. */
export function aircraftUpkeep(input: AircraftUpkeepInput): number {
  return aircraftUpkeepParts(input).total;
}

// ---------------------------------------------------------------------------
// 5.13 Wertmodell
// ---------------------------------------------------------------------------

/** Was das Wertmodell von einem Flugzeug braucht. */
export interface ValuedAircraft {
  /** Listenpreis des Typs in $ von 1960 (`basePrice`). */
  readonly listPrice1960: number;
  /** Baumonat. */
  readonly builtMonth: number;
  /** `cabinListPrice` der eingebauten Kabine in $ von 1960 (`src/model/cabin.ts`). */
  readonly cabinListPrice1960: number;
  /** Einbaumonat der Kabine (Kauf oder letzter Umbau). */
  readonly cabinInstalledMonth: number;
  /** Zustand der Zelle in Prozent (0 … 100). */
  readonly airframeCondition: number;
  /** Zustand der Kabine in Prozent (0 … 100). */
  readonly cabinCondition: number;
}

/**
 * Grundwert eines Flugzeugs: `atCost(Listenpreis, Baumonat) + atCost(cabinListPrice, Einbaumonat der Kabine)`.
 * Bleibt nach dem Kauf fest (kein späterer Kostenindex); ein Gebrauchtflugzeug hat dieselbe `valueBase` wie als
 * Neuflugzeug (R13). SPEZIFIKATION 5.13.
 */
export function valueBase(plane: Pick<ValuedAircraft, 'listPrice1960' | 'builtMonth' | 'cabinListPrice1960' | 'cabinInstalledMonth'>): number {
  return atCost(plane.listPrice1960, plane.builtMonth) + atCost(plane.cabinListPrice1960, plane.cabinInstalledMonth);
}

/**
 * Kaufpreis eines neuen Flugzeugs mit Kabine im Monat `month` = `valueBase` mit Bau- und Einbaumonat `month`
 * (E29, E54). Ein neues Flugzeug ist genau diesen Preis wert. SPEZIFIKATION 5.13, 8.12.
 */
export function newAircraftPrice(listPrice1960: number, cabinListPrice1960: number, month: number): number {
  return valueBase({ listPrice1960, builtMonth: month, cabinListPrice1960, cabinInstalledMonth: month });
}

/**
 * Anteil des Grundwerts nach Alter: `1 − (1 − RESIDUAL_SHARE) × kappen(Alter / DEPRECIATION_YEARS, 0, 1)`
 * (neu 1, ab 25 Jahren 0,2). SPEZIFIKATION 5.13.
 */
export function ageFactor(age: number): number {
  return 1 - (1 - RESIDUAL_SHARE) * clamp(age / DEPRECIATION_YEARS, 0, 1);
}

/**
 * Zu- oder Abschlag nach Zustand: `1 − CONDITION_VALUE_SPAN × (1 − (0,75 × Zelle + 0,25 × Kabine) / 100)`.
 * Zustand 100 ist neutral (sonst gälte „Wert neu = Kaufpreis“ nicht, E29); ganz abgenutzt 0,4. SPEZIFIKATION 5.13.
 */
export function conditionFactor(airframeCondition: number, cabinCondition: number): number {
  const condition = AIRFRAME_VALUE_SHARE * airframeCondition + (1 - AIRFRAME_VALUE_SHARE) * cabinCondition;
  return 1 - CONDITION_VALUE_SPAN * (1 - condition / 100);
}

/**
 * Wert eines Flugzeugs im Monat `month`: `valueBase × ageFactor(Alter) × conditionFactor`. Gleiches Flugzeug →
 * gleicher Wert für Spieler, KI und Gebrauchtmarkt. Händler-Spanne und Gebrauchtpreise setzt Abschnitt 8
 * relativ zu diesem Wert (E30). SPEZIFIKATION 5.13.
 */
export function aircraftValue(plane: ValuedAircraft, month: number): number {
  return (
    valueBase(plane) *
    ageFactor(ageYears(plane.builtMonth, month)) *
    conditionFactor(plane.airframeCondition, plane.cabinCondition)
  );
}

/**
 * Planbare Abschreibung je Monat für den Flugzeug-Anteil der Strecken (5.9):
 * `valueBase × (1 − RESIDUAL_SHARE) / (DEPRECIATION_YEARS × 12) × conditionFactor` bis `DEPRECIATION_YEARS`,
 * danach 0. Ohne Zustandsänderungen und Käufe (die stehen in `fleetValueResult`). SPEZIFIKATION 5.13.
 */
export function ageDepreciation(plane: ValuedAircraft, month: number): number {
  if (ageYears(plane.builtMonth, month) >= DEPRECIATION_YEARS) return 0;
  return (
    ((valueBase(plane) * (1 - RESIDUAL_SHARE)) / (DEPRECIATION_YEARS * 12)) *
    conditionFactor(plane.airframeCondition, plane.cabinCondition)
  );
}

// ---------------------------------------------------------------------------
// 5.13 Abschreibung im Monatsergebnis
// ---------------------------------------------------------------------------

/** Was in einem Monat den Flottenwert ändert. Beträge ≥ 0. */
export interface FleetValueMonth {
  /** Σ `aircraftValue` der Flotte am Monatsanfang. */
  readonly valueStart: number;
  /** Σ `aircraftValue` der Flotte am Monatsende (nach Käufen, Verkäufen, Alter, Zustand). */
  readonly valueEnd: number;
  /**
   * Σ Wertänderung durch Käufe, Umbauten, Überholungen und Verkäufe, je zum Zeitpunkt des Geschäfts
   * (Kauf +Wert, Verkauf −Wert, Umbau und Überholung Wert danach − Wert davor).
   */
  readonly tradeValueChange: number;
  /** Gezahlte Kaufpreise. */
  readonly purchases: number;
  /** Gezahlte Kabinen-Umbauten. */
  readonly refits: number;
  /** Gezahlte Grundüberholungen. */
  readonly overhauls: number;
  /** Erhaltene Verkaufserlöse. */
  readonly saleProceeds: number;
}

/** `fleetValueResult` in den zwei Zeilen des Berichts (positiv = Gewinn, negativ = Kosten). */
export interface FleetValueResultParts {
  /** „Depreciation“: Wertänderung der gehaltenen Flugzeuge (Alter und Zustand). */
  readonly depreciation: number;
  /** „Aircraft trades“: Wertänderung durch Geschäfte − gezahlt + erhalten. */
  readonly trades: number;
  readonly total: number;
}

/**
 * Alles, was den Flottenwert ändert, als ein Ergebnis-Posten:
 * `(Wert Ende − Wert Anfang) − Käufe − Umbauten − Überholungen + Verkaufserlöse`, geteilt in „Depreciation“
 * und „Aircraft trades“. Kosten im Bericht = −Ergebnis. Ein Kauf zum Wert ist ergebnisneutral; Kaufen und
 * sofort Verkaufen bringt nie Gewinn, solange der Verkauf unter dem Wert liegt (E30). SPEZIFIKATION 5.13.
 */
export function fleetValueResultParts(m: FleetValueMonth): FleetValueResultParts {
  const depreciation = m.valueEnd - m.valueStart - m.tradeValueChange;
  const trades = m.tradeValueChange - m.purchases - m.refits - m.overhauls + m.saleProceeds;
  return { depreciation, trades, total: depreciation + trades };
}

/** Ergebnis-Posten der Flotte im Monat. Siehe `fleetValueResultParts`. SPEZIFIKATION 5.13. */
export function fleetValueResult(m: FleetValueMonth): number {
  return fleetValueResultParts(m).total;
}
