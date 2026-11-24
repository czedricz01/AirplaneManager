/**
 * Brücke Teil 3 (Paket 4.2d, E72, F56): KI-Gesellschaften und Welt-Zustand zwischen dem Spielstand der Oberfläche und
 * `ModelState` (`src/model/monthClose.ts`). Teil 1 (Welt, Betrieb des Spielers) steht in `modelBridge.ts`, Teil 2
 * (Eingaben, Kasse, Fortschritt des Spielers) in `modelBridgeCompany.ts`.
 *
 * Anders als beim Spieler speichert der Spielstand die KI und den Welt-Zustand ab 4.2e **im Format des Modells**:
 * - **KI** (`RivalRecord`): `CompanyState` mit `agent` (Persönlichkeit, Stärke, Notlage, Strecken-Gedächtnis …), dazu
 *   nur, was das Modell nicht kennt (Name, Kürzel, echt oder erfunden, Farbe). Die alte `AiAirline` ist nur noch
 *   **Ansicht** (`rivalView`) für Karte und Konkurrenz-Ansicht, bis 4.7 sie umstellt; alte Spielstände wandelt
 *   `rivalRecord` einmal um.
 * - **Welt-Zustand** (`WorldState`): Startwert des Zufalls, Zufallsereignisse, Störungen (aller Gesellschaften),
 *   Pech des Monats, weiterverkaufte Flugzeuge. Die Listen der Oberfläche (`randomEvents`, `disruptions`) sind
 *   Ansichten daraus; die Charter-Antwort des Spielers kommt mit `applyDisruptionAnswers` zurück.
 * - Regel wie in Teil 1 und 2: Lesen und gleich wieder Zurückschreiben ändert nichts (dieselben Objekte).
 */

import { closesToLiquidation } from './modelRivalProfile';
import { aircraftList, type Aircraft } from '../data/aircraft';
import { FICTIONAL_AIRLINES, REAL_AIRLINES } from '../data/rivalAirlines';
import type { AiAirline } from '../components/CompetitorsView';
import {
  AIRCRAFT_CLASSES,
  CABIN_CLASSES,
  PRICE_WAR_CUT,
  RAMP_MONTHS,
  REPORT_HISTORY_MONTHS,
  START_HUB_SETUP,
  WEEKS_PER_MONTH,
  type AircraftClass,
  type CabinClass,
  type DisruptionKind,
  type RivalPersonality,
  type WorldRegion,
} from '../model/constants';
import { yearOf } from '../model/basics';
import { blockMinutes, distanceKm } from '../model/demand';
import {
  fleetValue,
  newLedger,
  type AircraftState,
  type CompanyState,
  type HoldingState,
  type ModelAirport,
  type ModelState,
  type ResoldPlane,
  type RouteState,
} from '../model/monthClose';
import type { Disruption, WorldEvent } from '../model/monthEvents';
import { rng } from '../model/rng';
import { inPriceWar, RIVAL_INPUTS, rivalAircraft, rivalDeskType, rivalService, rivalStartSetup, rivalStrengthOf } from '../model/rivals';
import {
  newRivalAgent,
  rivalAgentOf,
  rivalDesksNeeded,
  rivalManagementTier,
  rivalSchedule,
  RIVAL_HEALTHY,
  type RivalAgent,
  type RivalDistressState,
  type RivalRouteMemory,
} from '../model/rivalMonth';
import { appEvent, type HistoricalEvent } from './eventSystem';
import type { Disruption as AppDisruption, DisruptionKind as AppDisruptionKind, Staff } from './gameState';
import type { SimulatedRoute } from './gameTypes';
import { hadOneTimeMalus } from './malus';
import { plainReport } from './modelBridgeCompany';
import { catalogType } from './modelBridge';
import { assignRivalColors, MAP_YELLOW } from './theme';

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** Gibt `before` zurück, wenn `after` Element für Element dieselben Objekte enthält. */
function sameList<T>(before: readonly T[], after: T[]): readonly T[] {
  return before.length === after.length && after.every((x, i) => x === before[i]) ? before : after;
}

// ===========================================================================
// Welt-Zustand (8.3, 8.4, 8.6, 8.8, 8.11)
// ===========================================================================

/**
 * Was der Spielstand vom Welt-Zustand des Modells speichert (neues Feld mit 4.2e). Gleiche Bedeutung wie die Felder
 * von `ModelState`.
 */
export interface WorldState {
  readonly seed: number;
  readonly randomEvents: readonly WorldEvent[];
  /** Störungen des laufenden Monats, aller Gesellschaften. */
  readonly disruptions: readonly Disruption[];
  readonly badLuck: boolean;
  readonly resold: readonly ResoldPlane[];
}

/**
 * Startwert des Zufalls für einen Spielstand ohne `WorldState` (alte Spielstände): FNV-1a über Kürzel und Startmonat.
 * Gleicher Spielstand, gleicher Startwert (8.3).
 */
export function worldSeed(airlineCode: string, startMonth: number): number {
  let h = 0x811c9dc5;
  for (const ch of `${airlineCode}|${startMonth}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Ein gewürfelter Startwert des Zufalls für ein neues Spiel (8.3: „beim neuen Spiel gewürfelt“). Nicht rein. */
export function newWorldSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

/** Welt-Zustand eines neuen Spiels: Startwert, sonst leer (keine Zufallsereignisse, Störungen, Pech, Weiterverkäufe). */
export function newWorldState(seed: number): WorldState {
  return { seed: seed >>> 0, randomEvents: [], disruptions: [], badLuck: false, resold: [] };
}

/**
 * Ein Zufallsereignis der Oberfläche als `WorldEvent`: Monat, Dauer, Nachfrage-Faktor, Regionen. Der alte
 * Treibstoff-Faktor entfällt (E8: Treibstoff nur aus der Tabelle).
 */
export function modelWorldEvent(ev: HistoricalEvent): WorldEvent {
  return {
    title: ev.title,
    startMonth: ev.startOffset,
    months: ev.duration,
    demandMultiplier: ev.demandMultiplier,
    ...(ev.regions && ev.regions.length > 0 ? { regions: [...ev.regions] as WorldRegion[] } : {}),
  };
}

/** Ein `WorldEvent` als Ereignis der Oberfläche (`appEvent`: Text aus den Modell-Daten, Treibstoff-Faktor nur bei Ölkrisen). */
export function appWorldEvent(ev: WorldEvent): HistoricalEvent {
  return appEvent(ev);
}

/** Beschreibt das alte Ereignis dasselbe Ereignis wie das Modell (ohne Treibstoff-Faktor und Text)? */
function sameEvent(app: HistoricalEvent, model: WorldEvent): boolean {
  const a = modelWorldEvent(app);
  return (
    a.title === model.title &&
    a.startMonth === model.startMonth &&
    a.months === model.months &&
    a.demandMultiplier === model.demandMultiplier &&
    (a.regions ?? []).join() === (model.regions ?? []).join()
  );
}

/** Art einer Störung: Oberfläche → Modell. */
export const MODEL_DISRUPTION_KIND: Readonly<Record<AppDisruptionKind, DisruptionKind>> = {
  technical: 'defect',
  'airport-strike': 'airportStrike',
  weather: 'weather',
};

/** Art einer Störung: Modell → Oberfläche. */
export const APP_DISRUPTION_KIND: Readonly<Record<DisruptionKind, AppDisruptionKind>> = {
  defect: 'technical',
  airportStrike: 'airport-strike',
  weather: 'weather',
};

/**
 * Störungen eines alten Spielstands im Monat `month` als `Disruption` des Modells. Ziel = `ref` (Kennzeichen,
 * Flughafen, Region). Ein alter Defekt galt je Strecke; das Modell würfelt je Flugzeug: Defekte desselben Flugzeugs
 * werden eine Störung, gechartert nur, wenn alle gechartert waren. Störungen ohne `ref` fallen weg.
 */
export function modelDisruptions(list: readonly AppDisruption[], month: number): Disruption[] {
  const out = new Map<string, Disruption>();
  for (const d of list) {
    if (d.offset !== month || !d.ref) continue;
    const kind = MODEL_DISRUPTION_KIND[d.kind];
    const key = `${kind}|${d.ref}`;
    const known = out.get(key);
    const charter = (known ? known.charter === true : true) && d.mitigated === true;
    out.set(key, { month, kind, target: d.ref, share: d.cancelShare, ...(charter ? { charter: true } : {}) });
  }
  return [...out.values()];
}

/** Was der Welt-Zustand aus dem Spielstand der Oberfläche braucht. */
export interface WorldSource {
  /** Gespeicherter Welt-Zustand (ab 4.2e); fehlt bei alten Spielständen. */
  readonly world?: WorldState | null;
  readonly randomEvents: readonly HistoricalEvent[];
  readonly disruptions: readonly AppDisruption[];
  readonly staff: Pick<Staff, 'strike'>;
  /** Kürzel und Startmonat des Spielers (Startwert alter Spielstände). */
  readonly airlineCode: string;
  readonly startMonth: number;
}

/**
 * Der Welt-Zustand im Monat `month`: gespeichert, sonst aus einem alten Spielstand. Alt: Zufallsereignisse umgewandelt,
 * Störungen des Monats (`modelDisruptions`), Pech = der Monat hatte eine Störung oder einen Personalstreik
 * (`hadOneTimeMalus`, gleiche Regel wie 8.8), kein Weiterverkauf.
 */
export function modelWorld(src: WorldSource, month: number): WorldState {
  if (src.world) return src.world;
  return {
    seed: worldSeed(src.airlineCode, src.startMonth),
    randomEvents: src.randomEvents.map(modelWorldEvent),
    disruptions: modelDisruptions(src.disruptions, month),
    badLuck: hadOneTimeMalus([...src.disruptions], src.staff, month),
    resold: [],
  };
}

/** Eine Strecke des Spielers, so weit die Störungs-Ansicht sie braucht. */
export type DisruptionRoute = Pick<SimulatedRoute, 'id' | 'origin' | 'destination' | 'aircraft'>;

/** Kennung einer Störung in der Oberfläche: `dis_<Monat>_<Art>_<Ziel>` (Format von `src/lib/disruptions.ts`). */
export const disruptionId = (d: Disruption): string => `dis_${d.month}_${APP_DISRUPTION_KIND[d.kind]}_${d.target}`;

/** Strecken des Spielers, die eine Störung trifft (Regel von `routeCauses`, 8.9). */
function hitRoutes(d: Disruption, routes: readonly DisruptionRoute[], airports: Readonly<Record<string, ModelAirport>>): string[] {
  return routes
    .filter((r) => {
      if (d.kind === 'defect') return r.aircraft === d.target;
      if (d.kind === 'airportStrike') return r.origin === d.target || r.destination === d.target;
      return airports[r.origin]?.region === d.target || airports[r.destination]?.region === d.target;
    })
    .map((r) => r.id);
}

function sameAppDisruption(a: AppDisruption, b: AppDisruption): boolean {
  return (
    a.kind === b.kind &&
    a.offset === b.offset &&
    a.ref === b.ref &&
    a.cancelShare === b.cancelShare &&
    (a.mitigated === true) === (b.mitigated === true) &&
    a.routeIds.join() === b.routeIds.join()
  );
}

/**
 * Die Störungen, die Strecken des Spielers treffen, im Format der Oberfläche (Liste, Fragen, Bericht). Störungen nur
 * der KI fehlen. Eine gleiche Störung aus `before` bleibt dasselbe Objekt (auch mit alter Kennung, damit offene Fragen
 * sie finden).
 */
export function playerDisruptions(
  disruptions: readonly Disruption[],
  routes: readonly DisruptionRoute[],
  airports: Readonly<Record<string, ModelAirport>>,
  before: readonly AppDisruption[] = [],
): readonly AppDisruption[] {
  const out: AppDisruption[] = [];
  for (const d of disruptions) {
    const routeIds = hitRoutes(d, routes, airports);
    if (routeIds.length === 0) continue;
    const view: AppDisruption = {
      id: disruptionId(d),
      kind: APP_DISRUPTION_KIND[d.kind],
      offset: d.month,
      routeIds,
      cancelShare: d.share,
      ref: d.target,
      ...(d.charter ? { mitigated: true } : {}),
    };
    out.push(before.find((b) => sameAppDisruption(b, view)) ?? view);
  }
  return sameList(before, out);
}

/**
 * Übernimmt die Antworten des Spielers (Charter oder Streichen, 8.9) aus der Ansicht `answers` in die Störungen des
 * Modells. Zuordnung über Art, Monat und Ziel. Ohne Änderung: dieselbe Liste.
 */
export function applyDisruptionAnswers(disruptions: readonly Disruption[], answers: readonly AppDisruption[]): readonly Disruption[] {
  const out = disruptions.map((d) => {
    const answer = answers.find((a) => MODEL_DISRUPTION_KIND[a.kind] === d.kind && a.offset === d.month && a.ref === d.target);
    if (!answer || (answer.mitigated === true) === (d.charter === true)) return d;
    const { charter: _old, ...rest } = d;
    return answer.mitigated ? { ...rest, charter: true } : rest;
  });
  return sameList(disruptions, out);
}

/**
 * Neue Kennungen in den Störungen (offen aus 4.2c): Ein im Übergang gelieferter Flugzeug heißt im Modell
 * `<Bestellung>-<n>`, in der Flotte bekommt es ein Kennzeichen (`deliveredAircraft().renamed`). Ein Defekt, der für
 * den neuen Monat auf die alte Kennung gewürfelt wurde, zeigt danach auf das Kennzeichen.
 */
export function renameDisruptions(disruptions: readonly Disruption[], renamed: Readonly<Record<string, string>>): readonly Disruption[] {
  const out = disruptions.map((d) => (d.kind === 'defect' && renamed[d.target] ? { ...d, target: renamed[d.target] } : d));
  return sameList(disruptions, out);
}

/** Was nach dem Abschluss zurückgeschrieben wird. */
export interface AppliedWorld {
  readonly world: WorldState;
  /** Ansicht für die Oberfläche (Ereignis-Anzeigen bis 4.7). */
  readonly randomEvents: readonly HistoricalEvent[];
  /** Ansicht für die Oberfläche (Liste, Fragen, Bericht). */
  readonly disruptions: readonly AppDisruption[];
}

/** Was das Zurückschreiben des Welt-Zustands braucht. */
export interface WorldContext {
  /** Strecken des Spielers nach dem Abschluss. */
  readonly routes: readonly DisruptionRoute[];
  readonly airports: Readonly<Record<string, ModelAirport>>;
  /** Neue Kennungen gelieferter Flugzeuge (`deliveredAircraft().renamed`). */
  readonly renamed?: Readonly<Record<string, string>>;
}

/**
 * Schreibt den Welt-Zustand nach dem Abschluss zurück: `WorldState` aus `state` (Defekte mit neuen Kennungen), dazu die
 * Ansichten der Oberfläche. Unverändertes bleibt dasselbe Objekt; ein altes Ereignis bleibt mit seinem Treibstoff-Faktor
 * und Text, solange das Modell dasselbe Ereignis führt.
 */
export function applyModelWorld(
  state: Pick<ModelState, 'seed' | 'randomEvents' | 'disruptions' | 'badLuck' | 'resold'>,
  before: Pick<WorldSource, 'world' | 'randomEvents' | 'disruptions'>,
  ctx: WorldContext,
): AppliedWorld {
  const disruptions = renameDisruptions(state.disruptions, ctx.renamed ?? {});
  const w = before.world;
  const world: WorldState =
    w &&
    w.seed === state.seed &&
    w.randomEvents === state.randomEvents &&
    w.disruptions === disruptions &&
    w.badLuck === state.badLuck &&
    w.resold === state.resold
      ? w
      : { seed: state.seed, randomEvents: state.randomEvents, disruptions, badLuck: state.badLuck, resold: state.resold };
  const randomEvents = sameList(
    before.randomEvents,
    state.randomEvents.map((e) => before.randomEvents.find((b) => sameEvent(b, e)) ?? appWorldEvent(e)),
  );
  return { world, randomEvents, disruptions: playerDisruptions(disruptions, ctx.routes, ctx.airports, before.disruptions) };
}

// ===========================================================================
// KI-Gesellschaften (7.1–7.17)
// ===========================================================================

/** Eine KI im Spielstand: die Gesellschaft im Format des Modells und was nur die Oberfläche kennt. */
export interface RivalRecord {
  readonly name: string;
  /** Zwei Zeichen, eindeutig unter allen Gesellschaften. */
  readonly code: string;
  /** Echte (`src/data/rivalAirlines.ts`) oder erfundene Gesellschaft. */
  readonly isReal: boolean;
  /** Farbe auf der Karte (#RRGGBB). */
  readonly color?: string;
  readonly company: CompanyState;
}

/** Kennung einer KI im Modell: `rival-<Kürzel>` (wie die Gründung echter KI, 7.7). */
export const rivalCompanyId = (code: string): string => `rival-${code}`;

/** Kennung eines umgewandelten KI-Flugzeugs: Gesellschaft + Kennzeichen ohne Kürzel (`LH-A100` → `rival-LH-A100`). */
function rivalPlaneId(companyId: string, code: string, reg: string): string {
  return `${companyId}-${reg.startsWith(`${code}-`) ? reg.slice(code.length + 1) : reg}`;
}

/** Kennzeichen eines KI-Flugzeugs in der Ansicht: Kürzel + Rest der Kennung (Umkehrung von `rivalPlaneId`). */
export function rivalRegistration(company: Pick<CompanyState, 'id'>, code: string, planeId: string): string {
  const prefix = `${company.id}-`;
  return `${code}-${planeId.startsWith(prefix) ? planeId.slice(prefix.length) : planeId}`;
}

/** Was die Umwandlung braucht. */
export interface RivalContext {
  /** Laufender Spielmonat X. */
  readonly month: number;
  readonly airports: Readonly<Record<string, ModelAirport>>;
  readonly catalog?: readonly Aircraft[];
}

/** Notlage der alten KI als `RivalDistressState` (7.15). */
function distressOf(ai: AiAirline, month: number): RivalDistressState {
  const distressMonths = Math.max(0, ai.distressMonths ?? 0);
  if (ai.forSale) {
    return { status: 'forSale', distressMonths, forSaleMonths: Math.max(0, month - (ai.forSaleSince ?? month)) };
  }
  return distressMonths > 0 ? { ...RIVAL_HEALTHY, distressMonths } : RIVAL_HEALTHY;
}

/**
 * Bestand einer KI je Flughafen, wie ihn die Eröffnung einer Strecke anlegt (`withRoute` in `rivalMonth.ts`, 7.10):
 * an jedem Ende so viele Slots je Flugzeugklasse wie Abflüge je Woche, Schalter nach `rivalDesksNeeded`; an den
 * Drehkreuzen Stufe 2 und mindestens die Startausstattung (`START_HUB_SETUP`, 7.7).
 */
export function rivalHoldings(
  routes: readonly RouteState[],
  aircraft: readonly AircraftState[],
  hubs: readonly string[],
  personality: RivalPersonality,
  month: number,
): Record<string, HoldingState> {
  const planeOf = new Map(aircraft.map((p) => [p.id, p]));
  const seatsOf = (p: AircraftState) => sum(CABIN_CLASSES.map((c) => p.seats[c] ?? 0));
  const deskType = rivalDeskType(personality, month);
  const ids = [...new Set([...hubs, ...routes.flatMap((r) => [r.from, r.to])])].sort();
  const out: Record<string, HoldingState> = {};
  for (const id of ids) {
    const hub = hubs.includes(id);
    const here = routes.filter((r) => r.from === id || r.to === id);
    const slots: Partial<Record<AircraftClass, number>> = {};
    for (const cls of AIRCRAFT_CLASSES) {
      const used = sum(here.filter((r) => planeOf.get(r.aircraftId)?.aircraftClass === cls).map((r) => r.departuresPerWeek / 2));
      if (used > 0) slots[cls] = used;
    }
    const seatsOut = sum(here.map((r) => seatsOf(planeOf.get(r.aircraftId) as AircraftState) * (r.departuresPerWeek / 2)));
    const setup = hub ? START_HUB_SETUP.desks.normal + START_HUB_SETUP.desks.self : 0;
    const desks = Math.max(setup, rivalDesksNeeded(seatsOut, deskType));
    out[id] = {
      managementTier: rivalManagementTier(hub),
      slots,
      stands: {},
      desks: { normal: deskType === 'normal' ? desks : 0, self: deskType === 'self' ? desks : 0 },
      facilities: [],
    };
  }
  return out;
}

/**
 * Wandelt eine KI eines alten Spielstands in eine `RivalRecord` um (einmal beim Laden, 5.1 übernimmt es).
 * - **Kennung** `rival-<Kürzel>`, damit die Gründung (7.7) dieselbe echte KI nicht ein zweites Mal gründet.
 * - **Flugzeuge:** Typ-Werte aus dem Katalog (unbekannter Typ fällt mit seinen Strecken weg), Kabine nach `rivalCabin`
 *   der Persönlichkeit, eingebaut im Kaufmonat (3.7a, 5.1), Zustand aus `conditionGeneral` / `conditionInterior`.
 * - **Strecken:** Flugzeug über `aircraftReg` (ältere Spielstände: das erste noch freie Flugzeug des Typs),
 *   Abflüge = 2 × Umläufe, Alter `Monat − openedAt` (ohne: `RAMP_MONTHS`, gilt als eingeführt), Service der
 *   Persönlichkeit, Fahrplan `rivalSchedule`, Preisniveau ohne Wert (setzt die KI im ersten Abschluss, 7.6).
 * - **Bestand** nach `rivalHoldings` (die alte KI hatte keine Slots und Schalter; ihre Strecken flogen schon).
 * - **Entscheidungs-Zustand:** neue KI (`newRivalAgent`) mit geglättetem Gewinn und Krisen-Umläufen je Strecke,
 *   Notlage, Leerlauf-Monaten; Start-Ruf der KI (`rivalStartSetup`, 7.7; die alte KI hatte keinen).
 * - **Berichte:** die alten Monatsergebnisse (`monthlyProfitsHistory`) als Berichte der Vormonate (`plainReport`).
 */
export function rivalRecord(ai: AiAirline, ctx: RivalContext): RivalRecord {
  const { month } = ctx;
  const catalog = ctx.catalog ?? aircraftList;
  const id = rivalCompanyId(ai.code);
  const personality = (ai.personality ?? 'flag') as RivalPersonality;
  const strength = rivalStrengthOf(ai.aiDifficulty ?? 'Normal');
  const hubs = [ai.hub, ...(ai.secondHub ? [ai.secondHub] : [])].filter((h) => ctx.airports[h]);

  const regToPlane = new Map<string, AircraftState>();
  const typeOfPlane = new Map<string, string>();
  const idleMonths: Record<string, number> = {};
  for (const p of ai.fleet ?? []) {
    const type = catalog.find((a) => a.id === p.id);
    if (!type) continue;
    const planeId = rivalPlaneId(id, ai.code, p.reg);
    const base = rivalAircraft(personality, catalogType(type), p.purchasedAt ?? month, planeId);
    regToPlane.set(p.reg, {
      ...base,
      airframeCondition: p.conditionGeneral ?? base.airframeCondition,
      cabinCondition: p.conditionInterior ?? base.cabinCondition,
    });
    typeOfPlane.set(p.reg, p.id);
    if (p.idleSince !== undefined) idleMonths[planeId] = Math.max(0, month - p.idleSince);
  }
  const aircraft = [...regToPlane.values()];

  const routes: RouteState[] = [];
  const memory: Record<string, RivalRouteMemory> = {};
  const used = new Set<string>();
  (ai.routes ?? []).forEach((r, i) => {
    const reg =
      r.aircraftReg && regToPlane.has(r.aircraftReg)
        ? r.aircraftReg
        : r.aircraftReg
          ? undefined
          : [...typeOfPlane.entries()].find(([g, t]) => t === r.aircraft && !used.has(g))?.[0];
    const plane = reg ? regToPlane.get(reg) : undefined;
    const a = ctx.airports[r.origin];
    const b = ctx.airports[r.destination];
    if (!reg || !plane || !a || !b) return;
    used.add(reg);
    const minutes = blockMinutes(distanceKm(a.coords, b.coords), plane.cruiseSpeed);
    const service: Partial<Record<CabinClass, RouteState['service'][CabinClass]>> = {};
    for (const c of CABIN_CLASSES) if ((plane.seats[c] ?? 0) > 0) service[c] = rivalService(personality, c, minutes);
    const routeId = `${id}-old${i + 1}`;
    const weekly = Math.max(0, r.departures || 0);
    routes.push({
      id: routeId,
      aircraftId: plane.id,
      from: r.origin,
      to: r.destination,
      departuresPerWeek: 2 * weekly,
      ageMonths: r.openedAt !== undefined ? Math.max(0, month - r.openedAt) : RAMP_MONTHS,
      service,
      schedule: rivalSchedule(weekly, minutes),
    });
    const m: { -readonly [K in keyof RivalRouteMemory]: RivalRouteMemory[K] } = {};
    if (r.avgProfit !== undefined && Number.isFinite(r.avgProfit)) m.avgProfit = r.avgProfit;
    if (r.fullDepartures !== undefined && r.fullDepartures > weekly) m.fullFrequency = r.fullDepartures;
    if (Object.keys(m).length > 0) memory[routeId] = m;
  });

  const agent: RivalAgent = { ...newRivalAgent(personality, strength), distress: distressOf(ai, month), routes: memory, idleMonths };
  const reputation = rivalStartSetup().reputation;
  const history = (ai.monthlyProfitsHistory ?? []).filter(Number.isFinite).slice(-REPORT_HISTORY_MONTHS);
  const reports = history.map((result, i) =>
    plainReport(month - history.length + i, id, { revenue: 0, result, cash: ai.capital, passengers: 0, transferPassengers: 0, reputation }),
  );
  const company: CompanyState = {
    id,
    cash: ai.capital,
    reputation,
    inputs: { ...RIVAL_INPUTS, campaigns: [], subsidized: true },
    aircraft,
    routes,
    airports: rivalHoldings(routes, aircraft, hubs, personality, month),
    preorders: [],
    overdrawnMonths: 0,
    profitStreak: 0,
    ledger: newLedger(ai.capital, fleetValue(aircraft, month), 0),
    reports,
    hubs,
    agent,
  };
  return { name: ai.name, code: ai.code, isReal: ai.isReal === true, ...(ai.color ? { color: ai.color } : {}), company };
}

/** Monatsergebnis der letzten Berichte einer Gesellschaft, ältester zuerst. */
const resultsOf = (company: CompanyState) => company.reports.map((r) => r.result);

/**
 * Die Ansicht einer KI im Format der alten `AiAirline` (Karte, Konkurrenz-Ansicht, Strecken der Rivalen), bis 4.7 die
 * Ansichten auf das Modell umstellt. Strecken-Gewinn und Auslastung aus dem letzten Bericht (Gewinn × 4,348 Wochen),
 * geglätteter Gewinn und Krisen-Umläufe aus dem Entscheidungs-Zustand; Preiskampf als `priceCut` = `PRICE_WAR_CUT`.
 * Zum Verkauf: `liquidationIn` = Abschlüsse bis zur Auflösung (7.15). Das Feld `aggression` fehlt; die Ansicht liest
 * Angriffslust und Geschäftsmodell aus der Persönlichkeit (`rivalProfile`, Paket 4.7b).
 */
export function rivalView(record: RivalRecord, ctx: RivalContext): AiAirline {
  const { company, code } = record;
  const catalog = ctx.catalog ?? aircraftList;
  const agent = rivalAgentOf(company);
  const last = company.reports[company.reports.length - 1];
  const figures = new Map((last?.routes ?? []).map((f) => [f.routeId, f]));
  const regOf = (planeId: string) => rivalRegistration(company, code, planeId);
  const planes = new Map(company.aircraft.map((p) => [p.id, p]));
  const lowerClass = (cls: AircraftClass) => cls.toLowerCase() as AiAirline['fleet'][number]['class'];

  const fleet: AiAirline['fleet'] = company.aircraft.map((p) => {
    const type = catalog.find((a) => a.id === p.typeId);
    const idle = agent?.idleMonths[p.id] ?? 0;
    return {
      id: p.typeId,
      manufacturer: type?.manufacturer ?? '',
      family: p.family,
      type: type?.type ?? p.typeId,
      class: lowerClass(p.aircraftClass),
      reg: regOf(p.id),
      maxRange: type?.maxRange,
      capacity: p.capacity,
      basePrice: type?.basePrice,
      popularity: p.catalogAppeal,
      efficiency: p.efficiency,
      cruiseSpeed: p.cruiseSpeed,
      purchasedAt: p.builtMonth,
      conditionInterior: p.cabinCondition,
      conditionGeneral: p.airframeCondition,
      config: { economy: p.seats.economy ?? 0, premium: p.seats.premium ?? 0, business: p.seats.business ?? 0, first: p.seats.first ?? 0 },
      ...(idle > 0 ? { idleSince: ctx.month - idle } : {}),
    };
  });

  const routes: AiAirline['routes'] = company.routes.map((r) => {
    const plane = planes.get(r.aircraftId) as AircraftState;
    const a = ctx.airports[r.from];
    const b = ctx.airports[r.to];
    const km = a && b ? distanceKm(a.coords, b.coords) : 0;
    const f = figures.get(r.id);
    const seats = f ? sum(CABIN_CLASSES.map((c) => f.offeredSeats[c])) : 0;
    const pax = f ? sum(CABIN_CLASSES.map((c) => f.passengers[c] + f.transferPassengers[c])) : 0;
    const memory = agent?.routes[r.id];
    return {
      origin: r.from,
      destination: r.to,
      aircraftClass: lowerClass(plane.aircraftClass),
      departures: r.departuresPerWeek / 2,
      monthlyProfit: f ? f.result * WEEKS_PER_MONTH : 0,
      distance: Math.round(km),
      durMin: Math.round(blockMinutes(km, plane.cruiseSpeed)),
      aircraftReg: regOf(plane.id),
      aircraft: plane.typeId,
      openedAt: ctx.month - r.ageMonths,
      ...(memory?.avgProfit !== undefined ? { avgProfit: memory.avgProfit } : {}),
      ...(seats > 0 ? { loadFactor: pax / seats } : {}),
      ...(memory?.fullFrequency !== undefined ? { fullDepartures: memory.fullFrequency } : {}),
      ...(memory?.priceWar && inPriceWar(memory.priceWar) ? { priceCut: PRICE_WAR_CUT } : {}),
    };
  });

  const distress = agent?.distress ?? RIVAL_HEALTHY;
  return {
    id: company.id,
    name: record.name,
    code,
    hub: company.hubs?.[0] ?? '',
    ...(company.hubs?.[1] ? { secondHub: company.hubs[1] } : {}),
    capital: company.cash,
    aiDifficulty: agent ? (`${agent.strength[0].toUpperCase()}${agent.strength.slice(1)}` as AiAirline['aiDifficulty']) : 'Normal',
    fleet,
    routes,
    monthlyProfitsHistory: resultsOf(company),
    ...(distress.distressMonths > 0 ? { distressMonths: distress.distressMonths } : {}),
    ...(distress.status === 'forSale'
      ? { forSale: true, forSaleSince: ctx.month - distress.forSaleMonths, liquidationIn: closesToLiquidation(distress.forSaleMonths) }
      : {}),
    ...(agent ? { personality: agent.personality } : {}),
    isReal: record.isReal,
    ...(record.color ? { color: record.color } : {}),
  };
}

/** Die Ansichten aller KI, die noch fliegen (aufgelöste fehlen, wie in der alten Liste). */
export function rivalViews(records: readonly RivalRecord[], ctx: RivalContext): AiAirline[] {
  return records.filter((r) => rivalAgentOf(r.company)?.distress.status !== 'liquidated').map((r) => rivalView(r, ctx));
}

/** Die KI im Monat `month`: gespeichert, sonst aus den alten `AiAirline` umgewandelt. */
export function modelRivals(src: { readonly rivals?: readonly RivalRecord[] | null; readonly aiAirlines: readonly AiAirline[] }, ctx: RivalContext): readonly RivalRecord[] {
  return src.rivals ?? src.aiAirlines.map((ai) => rivalRecord(ai, ctx));
}

/** Was die Namen neuer KI brauchen. */
export interface RivalNamingContext {
  readonly seed: number;
  /** Monat des Spielstands nach dem Abschluss (Gründungsmonat). */
  readonly month: number;
  /** Kürzel des Spielers: keine KI trägt es. */
  readonly playerCode?: string;
  /** Farbe des Spielers: keine KI wird so gezeichnet. */
  readonly playerColor?: string;
}

/**
 * Name, Kürzel und Farbe einer im Abschluss gegründeten KI (7.7): echte KI (`rival-<Kürzel>`) nach
 * `src/data/rivalAirlines.ts`, bei gleichem Kürzel die im Gründungsjahr aktive (BOAC / British Airways); erfundene: ein freier Name aus `FICTIONAL_AIRLINES`, gewählt mit `rng` (8.3; gleicher
 * Spielstand, gleicher Name); ist keiner frei, `Airline <Drehkreuz>` mit dem Kürzel aus dem Drehkreuz.
 */
export function newRivalIdentity(company: CompanyState, taken: readonly RivalRecord[], ctx: RivalNamingContext): Omit<RivalRecord, 'company' | 'color'> {
  const year = yearOf(ctx.month);
  const sameCode = REAL_AIRLINES.filter((r) => rivalCompanyId(r.code) === company.id);
  const real = sameCode.find((r) => r.founded <= year && (r.ceased === undefined || year < r.ceased)) ?? sameCode[0];
  if (real) return { name: real.name, code: real.code, isReal: true };
  const usedCodes = new Set([...taken.map((r) => r.code.toUpperCase()), ...(ctx.playerCode ? [ctx.playerCode.toUpperCase()] : [])]);
  const free = FICTIONAL_AIRLINES.filter((f) => !usedCodes.has(f.code.toUpperCase()));
  if (free.length > 0) {
    const pick = free[Math.floor(rng(ctx.seed, ctx.month, 'rivalName', company.id) * free.length)];
    return { name: pick.name, code: pick.code, isReal: false };
  }
  const hub = company.hubs?.[0] ?? company.id;
  return { name: `Airline ${hub}`, code: hub.slice(0, 2).toUpperCase(), isReal: false };
}

/**
 * Schreibt die KI nach dem Abschluss zurück: jede Gesellschaft mit KI-Zustand aus `companies` (Reihenfolge des
 * Modells). Bekannte behalten Name, Kürzel und Farbe; neu gegründete bekommen sie nach `newRivalIdentity` und
 * `assignRivalColors`; übernommene (nicht mehr im Spielstand) fallen weg. Aufgelöste bleiben im Spielstand (das
 * Nachrücken zählt sie nicht, 7.7); die Ansicht lässt sie aus. Ohne Änderung: dieselbe Liste.
 */
export function applyModelRivals(
  before: readonly RivalRecord[],
  companies: readonly CompanyState[],
  ctx: RivalNamingContext,
): readonly RivalRecord[] {
  const byId = new Map(before.map((r) => [r.company.id, r]));
  const out: RivalRecord[] = [];
  const fresh: number[] = [];
  for (const company of companies) {
    if (!rivalAgentOf(company)) continue;
    const known = byId.get(company.id);
    if (known) {
      out.push(known.company === company ? known : { ...known, company });
      continue;
    }
    out.push({ ...newRivalIdentity(company, [...before, ...out], ctx), company });
    fresh.push(out.length - 1);
  }
  if (fresh.length > 0) {
    const colors = assignRivalColors(out.map((r) => ({ code: r.code, color: r.color })), ctx.playerColor ?? MAP_YELLOW);
    for (const i of fresh) out[i] = { ...out[i], color: colors[i] };
  }
  return sameList(before, out);
}
