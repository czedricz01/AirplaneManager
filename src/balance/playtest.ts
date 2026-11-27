/**
 * Spieltest ohne Browser: spielt ein freies Spiel (kein Szenario) Monat für Monat wie ein Mensch mit einer festen
 * Strategie. Gerechnet wird nur mit denselben Funktionen wie im Spiel: Start wie „New game“ (`foundStartRivals`,
 * `startCapital`, `START_HUB_SETUP`), Kauf wie im Kaufdialog (`newAircraftPrice`, `modelCabin`), Slots und Verwaltung
 * wie im Planer (`slotBuyPrice`, `tierPrice`, `applyInfrastructureChange`, `applyManagementUnlock`), Prognose wie im
 * Planer (`routeForecast`, `routeBestFares`), Abschluss wie „Next month“ (`runModelMonth`).
 *
 * Nicht nachgebaut: Fragen an den Spieler (Krisen, Streiks, Störungen, Jahresziel) bleiben unbeantwortet, kein
 * Gebrauchtmarkt, keine Vorbestellungen, keine Werbung. Aufruf: `scripts/playtest.ts`.
 */
import { aircraftList, type Aircraft } from '../data/aircraft';
import { airports as registryAirports } from '../data/airportRegistry';
import type { Airport } from '../data/airportTypes';
import { getAirportStats } from '../data/airports';
import type { ConfigOutput } from '../components/ConfigurePurchaseView';
import type { OwnedAircraft } from '../components/MyFleetView';
import { CABIN_CLASSES, RAMP_MONTHS, WEEKS_PER_MONTH, START_CAPITAL_TIERS_1960, START_HUB_SETUP, START_REPUTATION, type CabinClass, type RivalPersonality } from '../model/constants';
import { blockMinutes as modelBlockMinutes, distanceKm } from '../model/demand';
import { newAircraftPrice } from '../model/fleet';
import { atCost } from '../model/basics';
import { effectiveRank, isAirportOpen, milestoneSlotFactor, researchPrice, researchStartBlocker, startCapital, startResearch, startingResearch } from '../model/progress';
import { rivalCabin, rivalService } from '../model/rivals';
import { FREE_MODE_RANK } from '../lib/airlineRank';
import { classOfAircraft, openClasses } from '../lib/aircraftClasses';
import { airportStandings } from '../lib/airportAccess';
import { applyInfrastructureChange, applyManagementUnlock, getFlightDurationMinutes } from '../lib/financeUtils';
import { createOwnedAircraft, defaultCabin } from '../lib/fleet';
import { createGameSystems } from '../lib/gameState';
import type { AirportInfrastructure, ScheduledTrip, SimulatedRoute } from '../lib/gameTypes';
import { EXTRA_FLAGS, FEATURE_FLAGS, modelCabin } from '../lib/modelBridge';
import { withTradeValue } from '../lib/modelBridgeCompany';
import { newWorldState, type RivalRecord } from '../lib/modelBridgeWorld';
import { infraAvailability, rivalSlotsByAirport, slotBuyPrice, slotCapacity, tierPrice, type AirportPricing, type SlotKind } from '../lib/modelAirport';
import { defaultModelEnv, foundStartRivals, modelGame, planesValue, runModelMonth, type AppGame } from '../lib/modelMonth';
import { pricesAtLevel, routeBestFares, routeForecast, routeMarketFares, type PlannedRoute } from '../lib/modelRoute';
import { addCapexItem } from '../lib/monthClose';
import { planeFigures, resoldPlane } from '../lib/modelFleet';
import { getTurnoverMinutes, blockMinutes as tripBlock, tripsUtilization } from '../lib/scheduleUtils';


// ===========================================================================
// Einstellungen
// ===========================================================================

export type Difficulty = 'Easy' | 'Normal' | 'Hard';
export type Style = RivalPersonality | 'default';

/** Wie ein Spieler entscheidet. */
export interface Strategy {
  readonly name: string;
  /** Kabine und Service nach einer KI-Persönlichkeit (7.5): lcc = alles Economy, kein Service; boutique = Luxus.
   * `default` = was Kaufdialog und Planer ohne Änderung vorschlagen (alles Economy, Service „none“). */
  readonly style: Style;
  /** Preisniveau zum Marktpreis (1 = Marktpreis) oder `best` (gewinnbester Preis des Planers, jeden Monat neu). */
  readonly price: number | 'best';
  /** Wie Ziele gewählt werden: `popular` = beliebteste Ziele (Tourismus + Geschäft) ohne Blick auf die Prognose;
   * `forecast` = höchste Prognose des Planers; `random` = zufällig unter den 40 beliebtesten in Reichweite;
   * `any` = zufällig unter allen offenen Zielen in Reichweite (auch unbeliebte). */
  readonly pick: 'popular' | 'forecast' | 'random' | 'any';
  /** Flugzeugwahl: `cheap` = billigster passender Typ, `big` = meiste Sitze, `efficient` = beste Effizienz,
   * `mid` = größter Typ bis 150 Sitze (typische Wahl), `narrow` = größter Typ ohne Großraum (Regional/Narrowbody). */
  readonly plane: 'cheap' | 'big' | 'efficient' | 'mid' | 'narrow';
  /** Umläufe je Woche: Zahl (höchstens), `max` (so viele, wie das Flugzeug schafft, bis 28) oder `fit`
   * (7, 14, 21 oder 28, je nachdem, was die Prognose am höchsten zeigt). */
  readonly trips: number | 'max' | 'fit';
  /** Strecke schließen und Flugzeug neu einsetzen, wenn sie nach dem Anlauf so viele Monate in Folge Verlust macht (0 = nie). */
  readonly cutAfter: number;
  /** Kasse, die nach einem Kauf bleiben soll, in $ von 1960 (wird mit dem Kostenindex nicht angepasst; grob). */
  readonly reserve1960: number;
  /** Nur bis zu so vielen Strecken wachsen (0 = unbegrenzt). */
  readonly maxRoutes: number;
  /** Vorsichtig: nur kaufen, wenn die Prognose der neuen Strecke positiv ist (auch bei `popular`). */
  readonly needPositiveForecast: boolean;
  /** Bis zu so viele Käufe je Monat. */
  readonly buysPerMonth: number;
  /** Nur diesen Typ kaufen (Kennung aus `aircraftList`); sonst nach `plane`. */
  readonly typeId?: string;
  /** Flugzeuge ohne Strecke nach so vielen Monaten verkaufen (wie „Sell“ in der Flotte); 0 = nie. Standard 2. */
  readonly sellIdleAfter?: number;
}

export interface PlaySettings {
  readonly label: string;
  readonly hub: string;
  readonly startYear: number;
  readonly years: number;
  readonly difficulty: Difficulty;
  readonly aiDifficulty: Difficulty;
  readonly aiCount: number;
  /** Startkapital in $ von 1960 (`START_CAPITAL_TIERS_1960`). */
  readonly budget1960: number;
  readonly mode: 'normal' | 'free';
  readonly seed: number;
  readonly strategy: Strategy;
}

/** Ein Monat im Protokoll. */
export interface PlayMonth {
  readonly month: number;
  readonly cash: number;
  readonly profit: number;
  readonly revenue: number;
  readonly routes: number;
  readonly fleet: number;
  readonly reputation: number;
  readonly rank: number;
  readonly loadFactor: number;
  readonly companyValue: number;
}

/** Eine Strecke im Protokoll (Stand am Ende oder bei Schließung). */
export interface PlayRoute {
  readonly pair: string;
  readonly type: string;
  readonly opened: number;
  readonly closed?: number;
  /** Prognose „Expected weekly profit“ beim Eröffnen. */
  readonly forecastWeekly: number;
  /** Mittleres Ergebnis je Monat nach dem Anlauf (ab Monat 10, `RAMP_MONTHS` = 9). */
  readonly avgMonthlyAfterRamp: number;
  /** Mittleres Ergebnis je Monat in den Monaten 10–21 (erstes Jahr nach dem vollen Anlauf, `RAMP_MONTHS` = 9). */
  readonly avgMonthlyYear1?: number;
  readonly months: number;
  readonly loadFactor: number;
  /** Beliebtheit des Ziels: Tourismus + Geschäft im Eröffnungsjahr. */
  readonly destPopularity: number;
  readonly km: number;
}

export interface PlayResult {
  readonly settings: PlaySettings;
  readonly months: PlayMonth[];
  readonly routes: PlayRoute[];
  readonly bankrupt: boolean;
  readonly bankruptMonth?: number;
  readonly events: string[];
  readonly ms: number;
}

// ===========================================================================
// Spielstand
// ===========================================================================

type Game = { -readonly [K in keyof AppGame]: AppGame[K] } & { companyValue: number };

const ENV = defaultModelEnv();
const AIRPORTS: ReadonlyMap<string, Airport> = new Map(registryAirports.map((a) => [a.id, a]));

/** Zufall mit festem Startwert (mulberry32). */
function rngOf(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Neues Spiel wie `startNewGame` in `App.tsx` (ohne Szenario). */
export function newGame(s: PlaySettings): Game {
  if (!START_CAPITAL_TIERS_1960.includes(s.budget1960)) throw new Error(`Startkapital ${s.budget1960} gibt es nicht`);
  const start = (s.startYear - 1960) * 12;
  const sys = createGameSystems();
  const rank = s.mode === 'free' ? FREE_MODE_RANK : 0;
  const career = { ...sys.career, mode: s.mode, rank, research: { done: [...startingResearch(rank).done], active: [] } };
  const management: Record<string, AirportInfrastructure> = {
    [s.hub]: {
      level: START_HUB_SETUP.managementTier,
      slots: { regional: START_HUB_SETUP.slots, narrowbody: START_HUB_SETUP.slots, widebody: START_HUB_SETUP.slots },
      stands: { narrowbody: 0, widebody: 0 },
      desks: { ...START_HUB_SETUP.desks },
    },
  };
  const base: Game = {
    month: start, startMonth: start, airlineCode: 'PT', brandingColor: '#e0a030', selectedHub: s.hub,
    difficulty: s.difficulty, aiDifficulty: s.aiDifficulty, aiAirlinesCount: s.aiCount,
    capital: startCapital(s.budget1960, start), monthlyCapex: [], ledgerValues: null, overdrawnMonths: 0,
    fleet: [], routes: [], airportManagement: management,
    reputation: START_REPUTATION, profitStreak: 0, staff: sys.staff, marketing: sys.marketing, eventChoices: {},
    career, milestones: [], annualGoal: null, scenario: null, reportHistory: [],
    aiAirlines: [], rivals: [], modelWorld: newWorldState(s.seed), randomEvents: [], disruptions: [],
    companyValue: 0,
  };
  const founded = foundStartRivals(base, ENV);
  return { ...base, rivals: [...founded.rivals], aiAirlines: [...founded.aiAirlines] };
}

function spend(g: Game, amount: number, label: string): void {
  g.capital -= amount;
  g.monthlyCapex = addCapexItem([...g.monthlyCapex], label, amount);
}

function pricingOf(g: Game): AirportPricing {
  return {
    month: g.month,
    completedResearch: g.career.research.done,
    milestoneSlotFactor: milestoneSlotFactor(g.milestones),
    rivalSlots: rivalSlotsByAirport((g.rivals ?? []) as RivalRecord[]),
  };
}

const rankOf = (g: Game): number => effectiveRank(g.career.mode, g.career.rank);

/** Darf der Spieler den Flughafen nutzen (Rang, 6.7)? */
function airportOpen(g: Game, a: Airport): boolean {
  const st = airportStandings(g.selectedHub, g.airportManagement, g.routes).get(a.id) ?? {};
  return isAirportOpen(rankOf(g), a.level, st);
}

/** Lieferbare Typen, deren Klasse offen ist. */
function buyableTypes(g: Game): Aircraft[] {
  const open = openClasses(g.career.research.done, g.fleet, g.career.mode);
  return aircraftList.filter((a) =>
    a.firstDeliveryOffset <= g.month && (a.lastDeliveryOffset === null || a.lastDeliveryOffset >= g.month) && open.has(classOfAircraft(a)),
  );
}

const ICAO = 'ABCDEF';
const fitsAirport = (t: Aircraft, a: Airport): boolean => ICAO.indexOf(t.icaoCode) <= ICAO.indexOf(a.maxIcaoCode ?? 'F');

// ===========================================================================
// Kabine, Service, Kauf
// ===========================================================================

/** Kabine nach der Persönlichkeit als Eingabe des Kaufdialogs. */
function cabinConfig(style: Style, t: Aircraft, month: number): ConfigOutput {
  if (style === 'default') return defaultCabin(t).config;
  const cabin = rivalCabin(style, { capacity: t.capacity, class: t.class } as never, month);
  const setup = (c: CabinClass) => {
    const flags: Record<string, boolean> = {};
    for (const f of cabin.interiors[c].features) flags[FEATURE_FLAGS[c][f]] = true;
    return { seats: cabin.seats[c], pitch: cabin.interiors[c].pitch || 74, seatType: cabin.interiors[c].seatType, hasIFE: false, hasPower: false, ...flags };
  };
  const details: Record<string, unknown> = { first: setup('first'), business: setup('business'), premium: setup('premium'), economy: setup('economy') };
  for (const [extra, flag] of Object.entries(EXTRA_FLAGS)) details[flag] = cabin.fit.extras.includes(extra as never);
  return { first: cabin.seats.first, business: cabin.seats.business, premium: cabin.seats.premium, economy: cabin.seats.economy, details } as unknown as ConfigOutput;
}

function unitPrice(t: Aircraft, config: ConfigOutput, month: number): number {
  const cabin = modelCabin(config, { installedMonth: month, capacity: t.capacity });
  return newAircraftPrice(t.basePrice, cabin.cabinListPrice1960, month);
}

function buyPlane(g: Game, t: Aircraft, style: Style): OwnedAircraft {
  const config = cabinConfig(style, t, g.month);
  const price = unitPrice(t, config, g.month);
  spend(g, price, 'Aircraft Purchases');
  const [p] = createOwnedAircraft(t, 1, { config, baseInteriorPop: 50, hub: g.selectedHub, existingRegistrations: g.fleet.map((x) => x.registration), purchasedAt: g.month });
  if (g.ledgerValues && g.ledgerValues.month === g.month) g.ledgerValues = withTradeValue(g.ledgerValues, planesValue([p], g.month));
  g.fleet = [...g.fleet, p];
  return p;
}

function classConfigsOf(style: Style, km: number, t: Aircraft): Record<string, unknown> {
  if (style === 'default') {
    const none = () => ({ catering: [['none']], extras: ['none'], service: ['none'] });
    return { general: none(), economy: none(), premium: none(), business: none(), first: none() };
  }
  const block = modelBlockMinutes(km, t.cruiseSpeed);
  const out: Record<string, unknown> = {};
  for (const c of CABIN_CLASSES) {
    const s = rivalService(style, c, block);
    out[c] = { catering: s.meals, extras: s.extras, service: s.onboardService };
  }
  return out;
}

// ===========================================================================
// Flughäfen und Slots
// ===========================================================================

const slotKindOf = (t: Pick<Aircraft, 'class'>): SlotKind => t.class.toLowerCase() as SlotKind;

function usedSlots(g: Game, airportId: string, kind: SlotKind): number {
  let n = 0;
  for (const r of g.routes) {
    if (r.origin !== airportId && r.destination !== airportId) continue;
    const p = g.fleet.find((f) => f.registration === r.aircraft);
    if (!p || slotKindOf(p) !== kind) continue;
    n += (r.schedule ?? []).length;
  }
  return n;
}

/** Kosten, um an `id` `need` freie Slots der Art zu haben und (außer am Hub) Verwaltungsstufe 1; ohne Kauf. */
function airportCost(g: Game, id: string, kind: SlotKind, need: number): number | null {
  const a = AIRPORTS.get(id)!;
  const infra = g.airportManagement[id];
  let cost = (infra?.level ?? 0) >= 1 ? 0 : tierPrice(1, a.level, g.month);
  const have = (infra?.slots?.[kind] ?? 0) - usedSlots(g, id, kind);
  const missing = Math.max(0, need - have);
  if (missing > 0) {
    const pricing = pricingOf(g);
    const free = slotCapacity(id, a.level, infra ?? { level: 0, slots: { regional: 0, narrowbody: 0, widebody: 0 }, stands: {}, desks: { normal: 0, self: 0 } } as AirportInfrastructure, pricing).free;
    if (free < missing) return null;
    cost += missing * slotBuyPrice(kind, pricing);
  }
  return cost;
}

function prepareAirport(g: Game, id: string, kind: SlotKind, need: number): void {
  const a = AIRPORTS.get(id)!;
  let infra = g.airportManagement[id];
  if ((infra?.level ?? 0) < 1) {
    spend(g, tierPrice(1, a.level, g.month), 'Airport Infrastructure');
    infra = applyManagementUnlock(infra, 1);
  }
  const missing = Math.max(0, need - ((infra.slots?.[kind] ?? 0) - usedSlots(g, id, kind)));
  if (missing > 0) {
    const pricing = pricingOf(g);
    const r = applyInfrastructureChange({
      infra, type: 'slots', subType: kind, requestedAmount: missing, hubAutoUpgrade: (infra.level ?? 0) >= 2, autoBuyStands: !!infra.autoBuyStands,
      standsAvailable: infraAvailability(a.level, g.month).stands,
      availableSlots: slotCapacity(id, a.level, infra, pricing).free, utilizedSlots: 0, costPerUnit: slotBuyPrice(kind, pricing),
    });
    if (r.cost > 0) spend(g, r.cost, 'Slot Purchases');
    infra = r.infra;
  }
  g.airportManagement = { ...g.airportManagement, [id]: infra };
}

// ===========================================================================
// Strecken
// ===========================================================================

/** Fahrplan: `trips` Umläufe je Woche, gleichmäßig über die Tage, ab 6 Uhr hintereinander (wie der Planer, E51). */
function schedule(origin: Airport, dest: Airport, t: Aircraft, want: number | 'max' | 'fit'): ScheduledTrip[] {
  if (want === 'fit') want = 7;
  const durMin = getFlightDurationMinutes(origin, dest, t);
  const turnoverMin = getTurnoverMinutes(t.class);
  const cycle = tripBlock({ durMin, turnoverMin });
  const perDay = Math.max(0, Math.floor((24 * 60 - 6 * 60) / cycle));
  const trips: ScheduledTrip[] = [];
  if (cycle > 24 * 60) {
    // Langstrecke: ein Umlauf dauert über einen Tag; jeden zweiten/dritten Tag.
    const every = Math.ceil(cycle / (24 * 60));
    for (let d = 1; d <= 7; d += every) trips.push(trip(d, 8 * 60, durMin, turnoverMin, trips.length));
  } else {
    const maxPerWeek = Math.min(perDay * 7, 28);
    const n = want === 'max' ? maxPerWeek : Math.min(want, maxPerWeek);
    const daily = Math.ceil(n / 7);
    for (let d = 1; d <= 7 && trips.length < n; d++) {
      for (let k = 0; k < daily && trips.length < n; k++) trips.push(trip(d, 6 * 60 + k * cycle, durMin, turnoverMin, trips.length));
    }
  }
  while (trips.length > 0 && tripsUtilization(trips) > 1) trips.pop();
  return trips;
}

function trip(day: number, startMin: number, durMin: number, turnoverMin: number, i: number): ScheduledTrip {
  return { id: `t${i}`, flightNumOut: `PT${100 + i * 2}`, flightNumIn: `PT${101 + i * 2}`, dayId: day, startHour: Math.floor(startMin / 60), startMin: startMin % 60, durMin, turnoverMin };
}

function popularity(a: Airport, month: number): number {
  const s = getAirportStats(a, 1960 + Math.floor(month / 12));
  return s.tourism + s.business;
}

let routeSeq = 0;

function draftRoute(g: Game, origin: Airport, dest: Airport, plane: OwnedAircraft, st: Strategy, fares: Record<string, number>, trips?: number): SimulatedRoute {
  const km = distanceKm(origin.coords, dest.coords);
  const sched = schedule(origin, dest, plane, trips ?? st.trips);
  return {
    id: `pt${++routeSeq}`, airline: g.airlineCode, origin: origin.id, destination: dest.id, distance: Math.round(km), aircraft: plane.registration,
    weeklyFlights: sched.length, paxPerWeek: 0, schedule: sched, classConfigs: classConfigsOf(st.style, km, plane) as never,
    ticketPrices: fares, activeTicketPrices: fares, durMin: getFlightDurationMinutes(origin, dest, plane),
  } as SimulatedRoute;
}

/** Preise der Strecke nach der Strategie, im Modell-Stand `state`. */
function faresFor(state: ReturnType<typeof modelGame>['state'], g: Game, route: SimulatedRoute, plane: OwnedAircraft, st: Strategy, isNew: boolean): Record<string, number> {
  const classes = CABIN_CLASSES.filter((c) => ((plane.config as unknown as Record<string, number>)?.[c] ?? 0) > 0);
  const market = routeMarketFares(state, route);
  if (st.price !== 'best') return pricesAtLevel(market, st.price, classes);
  const best = routeBestFares(state, { route, isNew, startMonth: g.startMonth });
  const out: Record<string, number> = pricesAtLevel(market, 1, classes);
  for (const c of classes) if (best[c]) out[c] = best[c]!.fare;
  return out;
}

// ===========================================================================
// Ein Spiel
// ===========================================================================

export function play(s: PlaySettings, onYear?: (year: number, cash: number) => void): PlayResult {
  const t0 = Date.now();
  const st = s.strategy;
  const rng = rngOf(s.seed * 7919 + 13);
  let g = newGame(s);
  const months: PlayMonth[] = [];
  const events: string[] = [];
  const log: Map<string, { pair: string; type: string; opened: number; forecast: number; results: number[]; loads: number[]; pop: number; km: number; closed?: number }> = new Map();
  const lossStreak = new Map<string, number>();
  const idleMonths = new Map<string, number>();
  const hub = AIRPORTS.get(s.hub)!;
  const end = g.month + s.years * 12;
  let bankrupt = false;
  let bankruptMonth: number | undefined;

  while (g.month < end) {
    // --- 1. Preise anpassen (nur `best`: jeden Monat neu, wie ein aufmerksamer Spieler).
    if (st.price === 'best' && g.routes.length > 0) {
      const state = modelGame(g, ENV).state;
      g.routes = g.routes.map((r) => {
        const plane = g.fleet.find((p) => p.registration === r.aircraft)!;
        const fares = faresFor(state, g, r, plane, st, false);
        return { ...r, ticketPrices: fares };
      });
    }

    // --- 2. Verlust-Strecken schließen (nach dem Anlauf), Flugzeug wird frei.
    if (st.cutAfter > 0) {
      const closing = g.routes.filter((r) => (lossStreak.get(r.id) ?? 0) >= st.cutAfter);
      for (const r of closing) {
        g.routes = g.routes.filter((x) => x.id !== r.id);
        const entry = log.get(r.id);
        if (entry) entry.closed = g.month;
        lossStreak.delete(r.id);
        events.push(`${ym(g.month)} schließt ${r.origin}-${r.destination} (Verlust)`);
      }
    }

    // --- 2b. Flugzeuge, die schon `sellIdleAfter` Monate ohne Strecke stehen, verkaufen (wie `handleSellAircraft`).
    const sellAfter = st.sellIdleAfter ?? 2;
    for (const p of g.fleet) {
      const busy = g.routes.some((r) => r.aircraft === p.registration);
      idleMonths.set(p.registration, busy ? 0 : (idleMonths.get(p.registration) ?? 0) + 1);
    }
    if (sellAfter > 0) {
      for (const p of g.fleet.filter((x) => (idleMonths.get(x.registration) ?? 0) > sellAfter)) {
        const value = planeFigures(p, g.month, g.career.research.done).saleProceeds;
        if (g.modelWorld) g.modelWorld = { ...g.modelWorld, resold: [...g.modelWorld.resold, resoldPlane(p, g.month)] };
        g.capital += value;
        g.monthlyCapex = addCapexItem([...g.monthlyCapex], 'Aircraft Sales', -value);
        if (g.ledgerValues && g.ledgerValues.month === g.month) g.ledgerValues = withTradeValue(g.ledgerValues, -planesValue([p], g.month));
        g.fleet = g.fleet.filter((x) => x.registration !== p.registration);
        idleMonths.delete(p.registration);
        events.push(`${ym(g.month)} verkauft ${p.registration} (${p.type}) für ${Math.round(value / 1e5) / 10} Mio.`);
      }
    }

    // --- 3. Wachsen: freies Flugzeug einsetzen oder neues kaufen.
    for (let k = 0; k < st.buysPerMonth; k++) {
      if (st.maxRoutes > 0 && g.routes.length >= st.maxRoutes) break;
      const opened = openRoute(g, s, st, hub, rng, log, events);
      if (!opened) break;
    }

    // --- 4. Forschung im Normal Mode: nächste Klasse entwickeln, wenn es leicht geht.
    if (g.career.mode === 'normal') {
      for (const id of ['class-regional', 'class-narrowbody', 'class-widebody', 'class-jumbo']) {
        if (g.career.research.done.includes(id)) continue;
        const blocker = researchStartBlocker(g.career.research, id, rankOf(g), g.capital, g.month);
        if (blocker === null && researchPrice(id, g.month) < g.capital * 0.3) {
          const started = startResearch(g.career.research, id, rankOf(g), g.capital, g.month);
          spend(g, started.price, 'Development Projects');
          g.career = { ...g.career, research: started.state };
          events.push(`${ym(g.month)} Forschung ${id}`);
        }
        break;
      }
    }

    // --- 5. Abschluss.
    const r = runModelMonth(g, ENV, () => 0);
    const rep = r.modelReport;
    const routeFigures = rep?.routes ?? [];
    let seats = 0;
    let pax = 0;
    for (const f of routeFigures) {
      const fs = CABIN_CLASSES.reduce((n, c) => n + (f.offeredSeats[c] ?? 0), 0);
      const fp = CABIN_CLASSES.reduce((n, c) => n + (f.passengers[c] ?? 0) + (f.transferPassengers[c] ?? 0), 0);
      seats += fs;
      pax += fp;
      const entry = log.get(f.routeId);
      if (!entry) continue;
      const monthly = f.result * WEEKS_PER_MONTH;
      entry.results.push(monthly);
      if (fs > 0) entry.loads.push(fp / fs);
      if (entry.results.length > RAMP_MONTHS) lossStreak.set(f.routeId, monthly < 0 ? (lossStreak.get(f.routeId) ?? 0) + 1 : 0);
    }
    g = {
      ...g,
      month: r.month, capital: r.capital, monthlyCapex: [...r.monthlyCapex], ledgerValues: r.ledgerValues ?? null, overdrawnMonths: r.overdrawnMonths,
      fleet: [...r.fleet], routes: [...r.routes], airportManagement: { ...r.airportManagement }, reputation: r.reputation, profitStreak: r.profitStreak,
      staff: r.staff, marketing: r.marketing, career: r.career, milestones: [...r.milestones], annualGoal: r.annualGoal, scenario: r.scenario,
      reportHistory: [...r.reportHistory], rivals: [...r.rivals], aiAirlines: [...r.aiAirlines], modelWorld: r.modelWorld,
      randomEvents: [...r.randomEvents], disruptions: [...r.disruptions], companyValue: r.companyValue,
    };
    months.push({
      month: r.month - 1, cash: r.capital, profit: rep?.result ?? 0, revenue: rep?.revenue ?? 0, routes: g.routes.length, fleet: g.fleet.length,
      reputation: g.reputation, rank: g.career.rank, loadFactor: seats > 0 ? pax / seats : 0, companyValue: r.companyValue,
    });
    if (r.bankrupt) {
      bankrupt = true;
      bankruptMonth = r.month - 1;
      events.push(`${ym(r.month - 1)} PLEITE`);
      break;
    }
    if (g.month % 12 === 0) onYear?.(1960 + g.month / 12, g.capital);
  }

  const routes: PlayRoute[] = [...log.values()].map((e) => {
    const after = e.results.slice(RAMP_MONTHS);
    return {
      pair: e.pair, type: e.type, opened: e.opened, closed: e.closed, forecastWeekly: e.forecast,
      avgMonthlyAfterRamp: after.length > 0 ? after.reduce((a, b) => a + b, 0) / after.length : NaN,
      avgMonthlyYear1: e.results.length >= 21 ? e.results.slice(9, 21).reduce((a, b) => a + b, 0) / 12 : undefined,
      months: e.results.length,
      loadFactor: e.loads.length > 0 ? e.loads.slice(RAMP_MONTHS).reduce((a, b) => a + b, 0) / Math.max(1, e.loads.slice(RAMP_MONTHS).length) : NaN,
      destPopularity: e.pop, km: e.km,
    };
  });
  return { settings: s, months, routes, bankrupt, bankruptMonth, events, ms: Date.now() - t0 };
}

const ym = (m: number): string => `${String((m % 12) + 1).padStart(2, '0')}/${1960 + Math.floor(m / 12)}`;

/** Freies Flugzeug (ohne Strecke) oder Kauf, dann die beste Strecke nach der Strategie. */
function openRoute(
  g: Game, s: PlaySettings, st: Strategy, hub: Airport, rng: () => number,
  log: Map<string, { pair: string; type: string; opened: number; forecast: number; results: number[]; loads: number[]; pop: number; km: number; closed?: number }>,
  events: string[],
): boolean {
  const served = new Set(g.routes.filter((r) => r.origin === hub.id || r.destination === hub.id).map((r) => (r.origin === hub.id ? r.destination : r.origin)));
  const idle = g.fleet.find((p) => !g.routes.some((r) => r.aircraft === p.registration));

  // Typ wählen: aus den kaufbaren Typen nach der Strategie.
  const types = buyableTypes(g).filter((t) => fitsAirport(t, hub) && (!st.typeId || t.id === st.typeId));
  if (!idle && types.length === 0) return false;
  const priceOf = (t: Aircraft) => unitPrice(t, cabinConfig(st.style, t, g.month), g.month);
  const pool = st.plane === 'mid' ? (types.some((t) => t.capacity <= 150) ? types.filter((t) => t.capacity <= 150) : types)
    : st.plane === 'narrow' ? (types.some((t) => t.class !== 'Widebody') ? types.filter((t) => t.class !== 'Widebody') : types)
    : types;
  const order = [...pool].sort((a, b) =>
    st.plane === 'cheap' ? priceOf(a) - priceOf(b)
      : st.plane === 'efficient' ? b.efficiency - a.efficiency || priceOf(a) - priceOf(b)
      : b.capacity - a.capacity || b.efficiency - a.efficiency || priceOf(a) - priceOf(b),
  );
  const reserve = atCost(st.reserve1960, g.month);

  // Kandidaten-Ziele: offen, in Reichweite, noch nicht bedient.
  const candidates = (t: Pick<Aircraft, 'maxRange' | 'icaoCode'>) =>
    registryAirports
      .filter((a) => a.id !== hub.id && !served.has(a.id) && airportOpen(g, a) && fitsAirport(t as Aircraft, a))
      .map((a) => ({ a, km: distanceKm(hub.coords, a.coords), pop: popularity(a, g.month) }))
      .filter((x) => x.km <= t.maxRange && x.km >= 150)
      .sort((x, y) => y.pop - x.pop);

  // Flugzeug: das freie, sonst der erste bezahlbare Typ (Preis + Slots + Verwaltung + Reserve).
  let plane: OwnedAircraft | undefined = idle;
  let type: Aircraft | undefined = idle ? (aircraftList.find((a) => a.id === idle.id) ?? idle) : undefined;
  if (!plane) {
    for (const t of order) {
      if (g.capital - priceOf(t) - reserve > 0) {
        type = t;
        break;
      }
    }
    if (!type) return false;
  }
  const kind = slotKindOf(type!);
  let list = candidates(type!);
  if (st.pick === 'random' || st.pick === 'any') {
    if (st.pick === 'random') list = list.slice(0, 40);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  list = list.slice(0, st.pick === 'forecast' ? (st.trips === 'fit' ? 15 : 30) : 8);
  if (list.length === 0) return false;

  // Hypothetisches Flugzeug in die Flotte, damit der Planer rechnen kann.
  let testPlane = plane;
  if (!testPlane) {
    const config = cabinConfig(st.style, type!, g.month);
    [testPlane] = createOwnedAircraft(type!, 1, { config, baseInteriorPop: 50, hub: g.selectedHub, existingRegistrations: g.fleet.map((x) => x.registration), purchasedAt: g.month });
  }
  const test: Game = { ...g, fleet: plane ? g.fleet : [...g.fleet, testPlane!] };
  const state = modelGame(test, ENV).state;

  let best: { a: Airport; km: number; pop: number; forecast: number; route: SimulatedRoute; cost: number } | undefined;
  for (const c of list) {
    const tripOptions = st.trips === 'fit' ? [7, 14, 21, 28] : [undefined];
    for (const n of tripOptions) {
      const draft = draftRoute(test, hub, c.a, testPlane!, st, {}, n);
      const need = draft.schedule!.length;
      if (need === 0 || (n !== undefined && need < n)) continue;
      const costHub = airportCost(g, hub.id, kind, need);
      const costDest = airportCost(g, c.a.id, kind, need);
      if (costHub === null || costDest === null) continue;
      const fares = faresFor(state, test, draft, testPlane!, st, true);
      const route = { ...draft, ticketPrices: fares, activeTicketPrices: fares };
      const planned: PlannedRoute = { route, isNew: true, startMonth: g.startMonth };
      let forecast = NaN;
      try {
        forecast = routeForecast(state, planned)?.weeklyProfit ?? NaN;
      } catch {
        forecast = NaN;
      }
      const cost = costHub + costDest + (plane ? 0 : priceOf(type!));
      if (g.capital - cost - (plane ? 0 : reserve) < 0) continue;
      if (st.needPositiveForecast && !(forecast > 0)) continue;
      const better = !best || (st.pick === 'forecast' || st.trips === 'fit' ? forecast > best.forecast : false);
      if (better) best = { a: c.a, km: c.km, pop: c.pop, forecast, route, cost };
    }
    if (st.pick !== 'forecast' && best) break;
  }
  if (!best) return false;
  if (st.pick === 'forecast' && !(best.forecast > 0) && !plane) return false;

  // Kaufen und eröffnen.
  if (!plane) plane = buyPlane(g, type!, st.style);
  const need = best.route.schedule!.length;
  prepareAirport(g, hub.id, kind, need);
  prepareAirport(g, best.a.id, kind, need);
  const route: SimulatedRoute = { ...best.route, aircraft: plane.registration, openedOffset: g.month };
  g.routes = [...g.routes, route];
  log.set(route.id, { pair: `${hub.id}-${best.a.id}`, type: type!.id, opened: g.month, forecast: best.forecast, results: [], loads: [], pop: best.pop, km: best.km });
  events.push(`${ym(g.month)} eröffnet ${hub.id}-${best.a.id} (${type!.type}, ${need}×/Wo, Prognose ${Math.round(best.forecast)} $/Wo, Kasse ${Math.round(g.capital / 1e6)} Mio.)`);
  void s;
  return true;
}

// ===========================================================================
// Strecken-Probe: Prognose des Planers ohne Spielen
// ===========================================================================

export interface ProbeRow {
  readonly dest: string;
  readonly km: number;
  readonly popularity: number;
  readonly type: string;
  readonly seats: number;
  readonly trips: number;
  /** „Expected weekly profit“ nach dem Anlauf. */
  readonly weekly: number;
  /** Auslastung nach dem Anlauf. */
  readonly load: number;
  /** Erlös je Woche. */
  readonly revenue: number;
  /** Preisniveau der Economy (1 = Marktpreis). */
  readonly fareRatio: number;
}

/**
 * Prognose für jedes beliebte Ziel (die `top` beliebtesten offenen in Reichweite) mit jedem Typ aus `typeIds`, im
 * Startmonat eines neuen Spiels mit `s` (KI wie gegründet). Slots und Verwaltung zählen nicht (Einmalkosten).
 */
export function probeForecasts(s: PlaySettings, typeIds: readonly string[], top: number, style: Style, price: number | 'best', trips: number | 'max' | 'fit'): ProbeRow[] {
  const g = newGame(s);
  const hub = AIRPORTS.get(s.hub)!;
  const st: Strategy = { name: 'probe', style, price, pick: 'popular', plane: 'cheap', trips, cutAfter: 0, reserve1960: 0, maxRoutes: 0, needPositiveForecast: false, buysPerMonth: 1 };
  const rows: ProbeRow[] = [];
  for (const id of typeIds) {
    const t = aircraftList.find((a) => a.id === id);
    if (!t) throw new Error(`Typ ${id} fehlt`);
    const config = cabinConfig(style, t, g.month);
    const [plane] = createOwnedAircraft(t, 1, { config, baseInteriorPop: 50, hub: g.selectedHub, existingRegistrations: [], purchasedAt: g.month });
    const test: Game = { ...g, fleet: [plane] };
    const state = modelGame(test, ENV).state;
    const dests = registryAirports
      .filter((a) => a.id !== hub.id && airportOpen(g, a) && fitsAirport(t, a))
      .map((a) => ({ a, km: distanceKm(hub.coords, a.coords), pop: popularity(a, g.month) }))
      .filter((x) => x.km <= t.maxRange && x.km >= 150)
      .sort((x, y) => y.pop - x.pop)
      .slice(0, top);
    for (const d of dests) {
      const draft = draftRoute(test, hub, d.a, plane, st, {});
      if (draft.schedule!.length === 0) continue;
      const fares = faresFor(state, test, draft, plane, st, true);
      const route = { ...draft, ticketPrices: fares, activeTicketPrices: fares };
      const f = routeForecast(state, { route, isNew: true, startMonth: g.startMonth });
      if (!f) continue;
      const seatsW = CABIN_CLASSES.reduce((n, c) => n + f.figures.offeredSeats[c], 0);
      const paxW = CABIN_CLASSES.reduce((n, c) => n + f.figures.passengers[c], 0);
      rows.push({ dest: d.a.id, km: Math.round(d.km), popularity: d.pop, type: t.id, seats: t.capacity, trips: draft.schedule!.length, weekly: f.weeklyProfit, load: seatsW > 0 ? paxW / seatsW : 0, revenue: f.figures.revenue, fareRatio: f.classes.economy?.fareRatio ?? NaN });
    }
  }
  return rows;
}
