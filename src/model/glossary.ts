/**
 * Glossar und Erklärtexte (Paket 4.1, E52): Jede Zahl in einem Text kommt aus `constants.ts` oder aus einer
 * Modell-Funktion. Ändert sich eine Konstante, ändert sich der Text mit. Die Texte sind Oberflächentexte und
 * deshalb englisch. Keine Zahl mit Spielbedeutung in dieser Datei (Test `glossary.test.ts`).
 */

import { yearOf } from './basics';
import {
  AIRFRAME_VALUE_SHARE,
  CABIN_CLASSES,
  CABIN_EXPECTATION,
  CABIN_LIMIT,
  CONDITION_VALUE_SPAN,
  DESK_CAPACITY,
  DESK_FIXED_SHARE,
  DESK_OVERLOAD_FROM,
  DESK_OVERLOAD_MAX,
  DESK_OVERLOAD_STEEP_FROM,
  DESK_OVERLOAD_STEEP_SLOPE,
  DESK_TYPE_PENALTY,
  EFFICIENCY_MAX,
  EFFICIENCY_PER_RESEARCH,
  EXTERNAL_OVERHAUL_SURCHARGE,
  FLIGHT_TIME_INDEX_ANCHORS,
  FREE_STANDS_FROM_TIER,
  HANGAR_DEFECT_FACTOR,
  HUB_FEE_FACTOR_TIER2,
  HUB_FEE_FACTOR_TIER3,
  HUB_QUALITY_BASE,
  HUB_QUALITY_EXTRA_LEVEL,
  HUB_QUALITY_PER_EXTRA,
  HUB_QUALITY_PER_LEVEL,
  INTERIOR_SHARE,
  LOUNGE_POINTS,
  MAX_MANAGEMENT_TIER,
  MEALS_MAX,
  MORALE_NEUTRAL,
  OVERHAUL_POINTS,
  OWNER_FEE_SHARE,
  REFIT_CONDITION_MIN,
  REFIT_CONDITION_START,
  REFIT_CONDITION_STEP,
  RESEARCH_PROJECTS,
  SAT_PER_MORALE_POINT,
  SCALES,
  SELF_DESK_FROM,
  SERVICE_DELIGHT,
  SLOT_RESALE_SHARE,
  SLOTS_PER_AIRPORT_LEVEL,
  STAND_POINTS,
  STANDS_MIN_AIRPORT_SIZE,
  TIER_PRICE_1960,
  TYPE_APPEAL_SHARE,
  WEAR_FLOOR,
} from './constants';
import { cabinWeight, deskOverloadPoints, groundWeight, maxServiceShortfall, satisfactionFactor } from './satisfaction';

/** Ein Glossar-Eintrag: Überschrift und Erklärung (Absätze mit Leerzeile getrennt). */
export interface GlossaryEntry {
  readonly title: string;
  readonly desc: string;
}

// ---------------------------------------------------------------------------
// Zahlen für Texte (Rundung nur hier, in der Anzeige; R4)
// ---------------------------------------------------------------------------

/** Zahl für einen Text: höchstens `digits` Nachkommastellen, ohne Nullen am Ende, mit Tausender-Komma. */
export function textNumber(value: number, digits = 1): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

/** Anteil (0 … 1) als Prozent-Text, z. B. 0,2 → „20%“. */
export function textPercent(share: number, digits = 0): string {
  return `${textNumber(share * 100, digits)}%`;
}

/** Punkte mit Vorzeichen, z. B. „+4“ oder „−10“. */
export function textSigned(value: number, digits = 1): string {
  return `${value < 0 ? '−' : '+'}${textNumber(Math.abs(value), digits)}`;
}

// ---------------------------------------------------------------------------
// Abgeleitete Werte (alle aus Konstanten oder Modell-Funktionen)
// ---------------------------------------------------------------------------

const FIRST_ANCHOR = FLIGHT_TIME_INDEX_ANCHORS[0];
const LAST_ANCHOR = FLIGHT_TIME_INDEX_ANCHORS[FLIGHT_TIME_INDEX_ANCHORS.length - 1];
/** Kleinster und größter Flugzeit-Index und die Minuten dazu (2.1). */
const INDEX_MIN = FIRST_ANCHOR[1];
const INDEX_MAX = LAST_ANCHOR[1];
const INDEX_MIN_MINUTES = FIRST_ANCHOR[0];
const INDEX_MAX_MINUTES = LAST_ANCHOR[0];

const SAT_NEUTRAL = SCALES.satisfaction.neutral;
const SAT_MAX = SCALES.satisfaction.max;
const SAT_MIN = SCALES.satisfaction.min;
/** Ein Wert in der Mitte zwischen 0 und neutral, für das Beispiel „bei 50 zahlen sie …“. */
const SAT_HALF = (SAT_MIN + SAT_NEUTRAL) / 2;

/** Höchste Satisfaction-Punkte aus Forschung: Summe aller `satisfactionPoints` (2.6.5). */
const RESEARCH_SATISFACTION_MAX = RESEARCH_PROJECTS.reduce((sum, p) => sum + (p.effect.satisfactionPoints ?? 0), 0);

/** Personal-Teil ganz oben bzw. unten: Moral 0 oder 100 gegen den Neutralwert (2.6.4). */
const STAFF_SWING = SAT_PER_MORALE_POINT * MORALE_NEUTRAL;

/** Günstigste und teuerste Kabinenklasse (Economy, First). */
const LOWEST_CLASS = CABIN_CLASSES[0];
const HIGHEST_CLASS = CABIN_CLASSES[CABIN_CLASSES.length - 1];

/** Schalter-Last in der Mitte des flachen Abschnitts und am Beginn des steilen (2.6.3), für Beispiele im Text. */
const LOAD_EXAMPLES = [(DESK_OVERLOAD_FROM + DESK_OVERLOAD_STEEP_FROM) / 2, DESK_OVERLOAD_STEEP_FROM];
/** Schalter-Last, ab der der volle Abzug `DESK_OVERLOAD_MAX` gilt. */
const LOAD_AT_MAX =
  DESK_OVERLOAD_STEEP_FROM +
  (DESK_OVERLOAD_MAX + deskOverloadPoints(DESK_OVERLOAD_STEEP_FROM)) / (DESK_OVERLOAD_STEEP_SLOPE * 100);

/** Verwaltungsstufen 1 … `MAX_MANAGEMENT_TIER`. */
const TIERS = Array.from({ length: MAX_MANAGEMENT_TIER }, (_, i) => i + 1) as (keyof typeof TIER_PRICE_1960)[];
const FIRST_TIER = TIERS[0];

/** Wie viel teurer jede Verwaltungsstufe als die vorige ist (5.11). */
const TIER_STEPS = TIERS.slice(1).map((t) => ({
  tier: t,
  ratio: TIER_PRICE_1960[t] / TIER_PRICE_1960[(t - 1) as keyof typeof TIER_PRICE_1960],
}));

// ---------------------------------------------------------------------------
// Einzelne Erklärtexte (auch außerhalb des Glossars genutzt)
// ---------------------------------------------------------------------------

/**
 * Wirkung einer VIP-Lounge auf die Satisfaction (2.6.3): Punkte je Klasse bei einer Lounge an einem Ende
 * (die Hälfte von `LOUNGE_POINTS`, Mittel beider Enden) und an beiden Enden. Klassen ohne Wirkung fehlen.
 */
export function loungeEffectText(): string {
  const byPoints = new Map<number, string[]>();
  for (const c of CABIN_CLASSES) {
    const points = LOUNGE_POINTS[c];
    if (points <= 0) continue;
    byPoints.set(points, [...(byPoints.get(points) ?? []), CLASS_LABEL[c]]);
  }
  const groups = [...byPoints.entries()].sort((a, b) => b[0] - a[0]);
  const oneEnd = groups.map(([p, names]) => `${textSigned(p / 2)} (${names.join('/')})`).join(', ');
  const bothEnds = groups.map(([p]) => textSigned(p)).join(' / ');
  return `${oneEnd} satisfaction per route end (${bothEnds} with a lounge at both ends)`;
}

/**
 * Was eine Verwaltungsstufe bringt (5.1, 5.10, 5.15, 3.13, E63), für die Karten der Flughafen-Ansicht. Stufe 1: das
 * Recht, hier zu fliegen. Stufen außerhalb 1 … `MAX_MANAGEMENT_TIER` ergeben eine leere Liste.
 */
export function managementTierFeatures(tier: number): string[] {
  const quality = `Hub quality +${textPercent(HUB_QUALITY_PER_LEVEL)} per tier`;
  if (tier === FIRST_TIER) return ['Fly from and to this airport', 'Buy slots, desks and stands', quality];
  if (tier === FREE_STANDS_FROM_TIER) {
    return [
      'A stand at every slot, without rent',
      `Fees and rents here ${textPercent(1 - HUB_FEE_FACTOR_TIER2)} lower`,
      'Build a hangar, a VIP lounge and a catering kitchen',
      quality,
    ];
  }
  if (tier === MAX_MANAGEMENT_TIER) {
    return [
      `Fees and rents here ${textPercent(1 - HUB_FEE_FACTOR_TIER3)} lower`,
      `${quality}, +${textPercent(HUB_QUALITY_PER_EXTRA)} for owning it`,
      'Rivals open no new routes here',
      `${textPercent(OWNER_FEE_SHARE)} of the rivals' landing fees here paid to you`,
    ];
  }
  return [];
}

/** Drehkreuz-Güte (3.13): woraus sie besteht, für die Karte „Transfer Hub“. */
export function hubQualityText(): string {
  return (
    `How well passengers connect here: ${textPercent(HUB_QUALITY_BASE)} base, +${textPercent(HUB_QUALITY_PER_LEVEL)} per management tier, ` +
    `+${textPercent(HUB_QUALITY_PER_EXTRA)} each for owning the airport (T${textNumber(HUB_QUALITY_EXTRA_LEVEL)}), a VIP lounge and a catering kitchen, ` +
    `at most ${textPercent(1)}. It scales how attractive your connections through here are.`
  );
}

/** Was ein eigener Hangar bringt (8.6, 8.13, E62). */
export function hangarEffectText(): string {
  return (
    `Aircraft flying from here break down ${textPercent(1 - HANGAR_DEFECT_FACTOR)} less often, and their general checks ` +
    `cost no yard surcharge (+${textPercent(EXTERNAL_OVERHAUL_SURCHARGE)} without an own hangar on their routes)`
  );
}

/** Was eine eigene Catering-Küche bringt (2.5, 3.13). */
export function cateringEffectText(): string {
  return `One meal tier more on routes from here for aircraft with a premium galley; hub quality +${textPercent(HUB_QUALITY_PER_EXTRA)}`;
}

/** Englische Klassen-Namen für Texte. */
export const CLASS_LABEL: Readonly<Record<(typeof CABIN_CLASSES)[number], string>> = {
  economy: 'Economy',
  premium: 'Premium',
  business: 'Business',
  first: 'First',
};

/** Alle Klassen außer Economy, für den Schalter-Abzug (E55). */
const PREMIUM_CABINS = CABIN_CLASSES.filter((c) => c !== LOWEST_CLASS)
  .map((c) => CLASS_LABEL[c])
  .join(', ');

// ---------------------------------------------------------------------------
// Glossar
// ---------------------------------------------------------------------------

/** Name eines Glossar-Eintrags. */
export type GlossaryKey =
  | 'sat'
  | 'cabinRating'
  | 'typeAppeal'
  | 'loadFactor'
  | 'breakEven'
  | 'timeClass'
  | 'icaoCode'
  | 'airportLevel'
  | 'managementTier'
  | 'slots'
  | 'stands'
  | 'desks'
  | 'deskLoad'
  | 'efficiency'
  | 'conditionInterior'
  | 'conditionGeneral'
  | 'businessTourism'
  | 'capex';

/**
 * Alle Begriffe, die das Spiel erklärt, an einer Stelle (Wortlaut kann zwischen Ansichten nicht auseinanderlaufen).
 * Jeder Eintrag sagt, was die Zahl ist, welche Richtung besser ist und, wo es zählt, was sie kostet.
 * „Utilization“ hängt am Zeitplan und steht bis Paket 4.4 in `src/components/InfoTooltip.tsx`.
 */
export const MODEL_GLOSSARY: Readonly<Record<GlossaryKey, GlossaryEntry>> = {
  sat: {
    title: 'Satisfaction',
    desc:
      `How well a cabin class on this route meets what its passengers expect for the class and the length of the flight, ${textNumber(SAT_MIN)} to ${textNumber(SAT_MAX)}.\n\n` +
      `${textNumber(SAT_NEUTRAL)} means you met expectations exactly. Above that, passengers pay more for the same seat (up to about ${textPercent(satisfactionFactor(SAT_MAX) - 1)} more at ${textNumber(SAT_MAX)}); below it, less (${textPercent(1 - satisfactionFactor(SAT_HALF))} less at ${textNumber(SAT_HALF)}, half at ${textNumber(SAT_MIN)}).\n\n` +
      `It starts at ${textNumber(SAT_NEUTRAL)} and moves by parts, each against what the class expects: the cabin (at most ±${textNumber(CABIN_LIMIT)}, counts more on long flights), meals, drinks and extras (at most ${textSigned(SERVICE_DELIGHT)}; none at all costs from ${textNumber(maxServiceShortfall(LOWEST_CLASS, INDEX_MIN))} on the shortest ${CLASS_LABEL[LOWEST_CLASS]} flight to ${textNumber(maxServiceShortfall(HIGHEST_CLASS, INDEX_MAX), 0)} on the longest ${CLASS_LABEL[HIGHEST_CLASS]} flight), and the ground at both ends (lounge, stands, check-in; counts less on long flights). Staff morale adds ±${textNumber(STAFF_SWING)}, research up to ${textSigned(RESEARCH_SATISFACTION_MAX)}.`,
  },
  cabinRating: {
    title: 'Cabin rating',
    desc:
      `How good the cabin of one class in this aircraft is, ${textNumber(SCALES.cabinRating.min)} to ${textNumber(SCALES.cabinRating.max)}.\n\n` +
      `${textPercent(INTERIOR_SHARE)} comes from the interior (seats, features, extras), worn down with the cabin condition; ${textPercent(TYPE_APPEAL_SHARE)} from the type appeal of the aircraft.\n\n` +
      `Each class expects a different rating: ${CABIN_CLASSES.map((c) => `${CLASS_LABEL[c]} ${textNumber(CABIN_EXPECTATION[c])}`).join(', ')}. Above that the cabin raises satisfaction, below it lowers it.`,
  },
  typeAppeal: {
    title: 'Type appeal',
    desc:
      `How much passengers like flying on this aircraft type, ${textNumber(SCALES.typeAppeal.min)} to ${textNumber(SCALES.typeAppeal.max)}.\n\n` +
      `It fades as the individual aircraft gets older, and a brand-new type gets a short launch bonus. It makes up ${textPercent(TYPE_APPEAL_SHARE)} of the cabin rating.`,
  },
  loadFactor: {
    title: 'Load Factor (LF)',
    desc:
      'The share of your seats that are actually filled.\n\n' +
      'It is the link between price and profit: a high fare on a half-empty aircraft can earn less than a low fare on a full one.',
  },
  breakEven: {
    title: 'Break-even price',
    desc:
      'The fare level at which this route covers its costs exactly, the same share of the market fare in every class.\n\n' +
      'It is shown twice: at the load factor you can expect at your current fares, and with a full aircraft, which is the lowest break-even that could ever work.\n\n' +
      'Price below the first mark and the route loses money unless you fill more seats than expected.',
  },
  timeClass: {
    title: 'Flight-time index',
    desc:
      `How long a flight counts for passengers' expectations, a smooth scale from ${textNumber(INDEX_MIN)} (${textNumber(INDEX_MIN_MINUTES)} minutes or less) to ${textNumber(INDEX_MAX)} (${textNumber(INDEX_MAX_MINUTES)} minutes or more). It is not a cabin class.\n\n` +
      `On a longer flight passengers expect more service and up to ${textNumber(MEALS_MAX)} meals, and the cabin counts more (× ${textNumber(cabinWeight(INDEX_MIN))} at ${textNumber(INDEX_MIN)}, × ${textNumber(cabinWeight(INDEX_MAX))} at ${textNumber(INDEX_MAX)}) while the airports count less (× ${textNumber(groundWeight(INDEX_MIN))} down to × ${textNumber(groundWeight(INDEX_MAX))}). The base fare per kilometre also falls with it.`,
  },
  icaoCode: {
    title: 'Max ICAO Code',
    desc:
      'The largest aircraft this airport can physically handle, A (smallest) through F (largest).\n\n' +
      'It is a hard gate: an aircraft with a bigger code will not appear in the route planner for this airport at all. A regional turboprop is around B or C, a narrowbody C, a widebody D or E, and F is reserved for the very largest types.',
  },
  airportLevel: {
    title: 'Airport Level',
    desc:
      'The size of the airport itself, which you cannot change.\n\n' +
      `It sets how many slots exist in total (${textNumber(SLOTS_PER_AIRPORT_LEVEL)} per level, shared with every other airline here), what landing and handling fees cost, and whether there are stands (from level ${textNumber(STANDS_MIN_AIRPORT_SIZE)}).\n\n` +
      `Not to be confused with Management Tier (T${textNumber(FIRST_TIER)}-T${textNumber(MAX_MANAGEMENT_TIER)}), which is what you buy to operate here.`,
  },
  managementTier: {
    title: `Management Tier (T${textNumber(FIRST_TIER)}-T${textNumber(MAX_MANAGEMENT_TIER)})`,
    desc:
      'Your own standing at this airport, bought once per airport.\n\n' +
      `T${textNumber(FIRST_TIER)} is required before you can fly here at all. From T${textNumber(FREE_STANDS_FROM_TIER)} every slot comes with a stand without rent and your fees here drop by ${textPercent(1 - HUB_FEE_FACTOR_TIER2)}. T${textNumber(MAX_MANAGEMENT_TIER)} cuts them by ${textPercent(1 - HUB_FEE_FACTOR_TIER3)} and earns you part of the fees other airlines pay here.\n\n` +
      `The price is per airport level and grows with the years. Each tier costs far more than the one before: ${TIER_STEPS.map((s) => `T${textNumber(s.tier)} about ${textNumber(s.ratio, 0)} times`).join(', ')}.`,
  },
  slots: {
    title: 'Slots',
    desc:
      'The right to one departure per week from this airport. A route flying five round trips a week needs five slots at each end; arrivals need none.\n\n' +
      `Slots are bought once (CAPEX), rented weekly whether used or not, and sell back for ${textPercent(SLOT_RESALE_SHARE)} of today's price. They are finite: the airport has ${textNumber(SLOTS_PER_AIRPORT_LEVEL)} per level in total and rival airlines take from the same pool, so a busy hub can simply run out.`,
  },
  stands: {
    title: 'Stands',
    desc:
      `Parking positions for your aircraft, only at airports from level ${textNumber(STANDS_MIN_AIRPORT_SIZE)}. Rented weekly; from management tier T${textNumber(FREE_STANDS_FROM_TIER)} every slot has one without rent.\n\n` +
      `A stand for every used slot adds ${textNumber(STAND_POINTS)} satisfaction points at that airport (× ${textNumber(groundWeight(INDEX_MIN))} on the shortest flights, × ${textNumber(groundWeight(INDEX_MAX))} on the longest; the route takes the average of both ends). With fewer stands the bonus shrinks in proportion.`,
  },
  desks: {
    title: 'Check-in Desks',
    desc:
      `Where your passengers are processed, rented weekly. Every route needs at least one desk at both ends. Each staffed desk handles ${textNumber(DESK_CAPACITY.normal)} seats a week, a self-service desk ${textNumber(DESK_CAPACITY.self)} (from ${yearOf(SELF_DESK_FROM)}).\n\n` +
      `The rent follows the use: an idle desk costs ${textPercent(DESK_FIXED_SHARE)} of its full rate, a full one the whole rate.\n\n` +
      `${PREMIUM_CABINS} lose ${textNumber(Math.abs(DESK_TYPE_PENALTY))} satisfaction points at an airport with only self-service desks; ${CLASS_LABEL[LOWEST_CLASS]} does not mind. Overloaded desks cost satisfaction again (see Desk Load).`,
  },
  deskLoad: {
    title: 'Desk Load',
    desc:
      'How much of your check-in capacity at this airport your departing seats already use, across every route.\n\n' +
      `Above ${textPercent(DESK_OVERLOAD_FROM)} the queue starts costing satisfaction on all of them, not just this route: ${LOAD_EXAMPLES.map((l) => `about ${textNumber(-deskOverloadPoints(l), 0)} points at ${textPercent(l)}`).join(', ')} and the full ${textNumber(DESK_OVERLOAD_MAX)} from ${textPercent(LOAD_AT_MAX)}. A route takes the average of both ends, weighted like the other ground parts.`,
  },
  efficiency: {
    title: 'Efficiency',
    desc:
      `How much fuel this aircraft burns, up to ${textNumber(EFFICIENCY_MAX)}, where higher is better. Each finished efficiency research adds ${textNumber(EFFICIENCY_PER_RESEARCH)}.\n\n` +
      'Fuel is the largest variable cost on almost every route, so this is usually the most important number on an aircraft after its capacity and range.',
  },
  conditionInterior: {
    title: 'Interior Condition',
    desc:
      'Wear on the cabin, falling with every hour flown.\n\n' +
      `It scales the interior part of the cabin rating (a fully worn cabin keeps ${textPercent(WEAR_FLOOR)} of it; the type appeal is not affected), so a tired cabin quietly lowers the fare passengers will pay. It also counts ${textPercent(1 - AIRFRAME_VALUE_SHARE)} of the condition that sets the aircraft's value.\n\n` +
      `A refit brings it back to ${textPercent(REFIT_CONDITION_START / 100)}, ${textNumber(REFIT_CONDITION_STEP)} points less with each earlier refit, never below ${textPercent(REFIT_CONDITION_MIN / 100)}.`,
  },
  conditionGeneral: {
    title: 'Airframe Condition',
    desc:
      'Wear on the airframe itself, falling with the hours flown.\n\n' +
      `It counts ${textPercent(AIRFRAME_VALUE_SHARE)} of the condition that sets what the aircraft is worth: a fully worn aircraft is worth ${textPercent(CONDITION_VALUE_SPAN)} less than the same one in new condition.\n\n` +
      `An overhaul restores part of it, later ones less: ${OVERHAUL_POINTS.map((p) => textSigned(p)).join(', ')} points in turn. After ${textNumber(OVERHAUL_POINTS.length)} overhauls there is no further one.`,
  },
  businessTourism: {
    title: 'Business / Tourism',
    desc:
      'How much traffic this city generates of each kind, in the currently selected year. Both grow over the decades.\n\n' +
      'Demand on a route comes from the pairing of the two ends, weighted heavily toward the smaller of them: a huge hub paired with a small field produces a small route.',
  },
  capex: {
    title: 'CAPEX vs. weekly rent',
    desc:
      'CAPEX is a one-off purchase price. It comes out of your capital the moment you buy, and the monthly report lists it below the line.\n\n' +
      `A weekly rate is recurring upkeep that appears in every month from now on. Slots cost both; desks and stands are rent only (stands are free from tier T${textNumber(FREE_STANDS_FROM_TIER)}).`,
  },
};
