/**
 * Regeltests zu SPEZIFIKATION 7.8–7.17 (Monat der KI, Planung, Slots/Schalter/Drehkreuze mit Sperre E63, Flotte,
 * Krise, Größe, Dividende, Zuschuss, Notlage, Übernahme, Ticker) und dem Rest von Beispiel 7.18. Paket 3.7b.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { atCost } from './basics';
import { aircraftTripMinutes, weeklyTripCapacity } from './schedule';
import { deskLoad } from './satisfaction';
import { departuresAt, departuresOnPair, facilityPrice, slotLimit, slotPrice, slotResalePrice } from './airportCosts';
import { aircraftValue } from './fleet';
import { companyValue } from './progress';
import { rivalCashReserve } from './rivals';
import type { CatalogType } from './monthClose';
import {
  CORE_NETWORK,
  CRISIS_IDLE_MONTHS,
  DIVIDEND_FLOOR_1960,
  MAX_IDLE_MONTHS,
  MINUTES_PER_WEEK,
  PERSONALITIES,
  PERSONALITY_IDS,
  RIVAL_CAPITAL_RATE,
  RIVAL_DECISION_STEPS,
  RIVAL_SLOT_SHARE_HUB,
  RIVAL_SLOT_SHARE_OTHER,
  RIVAL_SUBSIDY_ENABLED,
  RIVAL_STRENGTHS,
  TAKEOVER_MIN_PRICE_1960,
  type DeskType,
} from './constants';
import {
  RIVAL_HEALTHY,
  crisisFrequency,
  crisisSeverity,
  dividendLimit,
  emergencySaleCandidate,
  fineTune,
  fineTuneThisMonth,
  forecastWithNoise,
  growthStopped,
  idleSlotsToSell,
  isCrisis,
  isEligibleTarget,
  liquidate,
  loserDecisions,
  mayModernize,
  mayOpenRoute,
  mayOverhaul,
  mayTakeOver,
  modernizationCandidate,
  needsModernization,
  needsOverhaul,
  newHubTierPrice,
  newHubWeights,
  nextIdleMonths,
  pickPurchaseType,
  planFrequencies,
  profitAfterCapital,
  referenceTypeIndex,
  referenceTypeIndices,
  preselectScore,
  preselectTargets,
  rivalBuildsLounge,
  rivalBuyBlocker,
  rivalDesksNeeded,
  rivalDistressStep,
  rivalDividend,
  rivalManagementTier,
  rivalMaxRotations,
  rivalMayOpenRouteBetween,
  rivalPlanRoute,
  rivalSize,
  rivalSlotCap,
  rivalSlotCost,
  rivalSlotRoom,
  rivalSlotsToBuy,
  rivalSubsidy,
  sellIdle,
  showRivalNews,
  smoothedProfit,
  subsidy1960,
  takeover,
  takeoverPrice,
  tickerRank,
  wantsNewHub,
  worldEventDemandFactor,
  type FineTuneInput,
  type NewHubCandidate,
  type NewHubInput,
  type PreselectContext,
  type PurchaseOption,
  type RivalBuyInput,
  type RivalDistressState,
  type RivalPlaneView,
  type RivalRouteView,
  type RivalSlotState,
  type TargetCandidate,
} from './rivalMonth';

const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const at = (year: number, month = 1) => (year - 1960) * 12 + (month - 1);

// ---------------------------------------------------------------------------
// 7.8 Monat der KI
// ---------------------------------------------------------------------------

const route = (id: string, avgProfit: number, weeklyFrequency = 10, ageMonths = 24): RivalRouteView => ({
  id,
  avgProfit,
  weeklyFrequency,
  ageMonths,
});

describe('Abschnitt 7.8 Monat der KI', () => {
  it('7.8: Reihenfolge der Entscheidungen wie in der Spezifikation', () => {
    assert.deepEqual(
      [...RIVAL_DECISION_STEPS],
      ['prices', 'crisis', 'losers', 'fineTune', 'fleet', 'openings', 'growth', 'dividend', 'distress'],
    );
  });

  it('7.8: geglätteter Gewinn = 0,65 × alt + 0,35 × Monatswert; neue Strecke = erster Monatswert', () => {
    near(smoothedProfit(100, 200), 135);
    near(smoothedProfit(undefined, -50), -50);
  });

  it('7.8: Verlierer erst nach der Geduld, die schlechtesten zuerst, Normal 1 und Hard 2 je Monat', () => {
    const routes = [route('a', -10), route('b', -30), route('c', -20), route('d', 5), route('young', -99, 10, 1)];
    const lossEverywhere = () => -1;
    const normal = loserDecisions(routes, 'flag', 'normal', lossEverywhere);
    assert.deepEqual(normal.map((d) => d.routeId), ['b']);
    const hard = loserDecisions(routes, 'flag', 'hard', lossEverywhere);
    assert.deepEqual(hard.map((d) => d.routeId), ['b', 'c']);
    // Die junge Strecke (1 Monat < Geduld 6) bleibt, obwohl sie am schlechtesten ist.
    assert.ok(!hard.some((d) => d.routeId === 'young'));
  });

  it('7.8: erst ausdünnen auf 40 %, wenn das Gewinn bringt, sonst streichen', () => {
    const routes = [route('a', -10, 10), route('b', -5), route('c', 1)];
    const thin = loserDecisions(routes, 'flag', 'normal', (_id, f) => (f === 4 ? 1000 : -1));
    assert.deepEqual(thin, [{ routeId: 'a', action: 'thin', weeklyFrequency: 4 }]);
    const close = loserDecisions(routes, 'flag', 'normal', () => -1);
    assert.deepEqual(close, [{ routeId: 'a', action: 'close', weeklyFrequency: 0 }]);
  });

  it('7.8: mindestens CORE_NETWORK Strecken bleiben', () => {
    const routes = [route('a', -10), route('b', -20)];
    assert.equal(routes.length, CORE_NETWORK);
    assert.deepEqual(loserDecisions(routes, 'flag', 'hard', () => -1), []);
    const three = [...routes, route('c', -5)];
    assert.deepEqual(loserDecisions(three, 'flag', 'hard', () => -1).map((d) => d.action), ['close']);
  });

  it('7.8: Feinabstimmung behält nur, wenn die Planer-Hauptzahl um mehr als 2 % steigt', () => {
    const base: FineTuneInput = { route: route('a', 50, 8), maxRotations: 14, slotRoom: 10, crisisReduced: false };
    // + max(1, 25 % von 8) = 10 Umläufe.
    assert.equal(fineTune(base, (_id, f) => (f === 10 ? 1030 : 1000)), 10);
    assert.equal(fineTune(base, (_id, f) => (f === 10 ? 1020 : 1000)), null);
    // Verlust: weniger Flüge.
    const losing = { ...base, route: route('a', -50, 8) };
    assert.equal(fineTune(losing, (_id, f) => (f === 6 ? -10 : -100)), 6);
  });

  it('7.8: Feinabstimmung braucht freie Slots, Alter 2 und keine laufende Krisen-Kürzung', () => {
    const base: FineTuneInput = { route: route('a', 50, 8), maxRotations: 14, slotRoom: 0, crisisReduced: false };
    const better = (_id: string, f: number) => f * 1000;
    assert.equal(fineTune(base, better), null);
    assert.equal(fineTune({ ...base, slotRoom: 1 }, better), 9);
    assert.equal(fineTune({ ...base, slotRoom: 5, route: route('a', 50, 8, 1) }, better), null);
    assert.equal(fineTune({ ...base, slotRoom: 5, crisisReduced: true }, better), null);
    assert.equal(fineTune({ ...base, slotRoom: 5, maxRotations: 8 }, better), null);
  });

  it('7.3/7.8: Feinabstimmung Easy nie, Normal jeden 2. Monat, Hard immer', () => {
    assert.equal(fineTuneThisMonth('easy', 0), false);
    assert.equal(fineTuneThisMonth('normal', 0.49), true);
    assert.equal(fineTuneThisMonth('normal', 0.5), false);
    assert.equal(fineTuneThisMonth('hard', 0.999), true);
  });

  it('7.8: Entscheidungen ändern keine Zahl des laufenden Monats (reine Funktionen, Eingaben bleiben gleich)', () => {
    const routes = Object.freeze([route('a', -10), route('b', -20), route('c', -30)].map((r) => Object.freeze(r)));
    loserDecisions(routes, 'lcc', 'hard', () => -1);
    assert.deepEqual(routes.map((r) => r.weeklyFrequency), [10, 10, 10]);
  });
});

// ---------------------------------------------------------------------------
// 7.9 Planung einer Strecke
// ---------------------------------------------------------------------------

const target = (over: Partial<TargetCandidate> = {}): TargetCandidate => ({
  id: 'X',
  km: 1000,
  business: 50,
  tourism: 50,
  otherDepartures: 0,
  runwayOk: true,
  slotsFree: true,
  playerTier3: false,
  served: false,
  ...over,
});

const ctx: PreselectContext = { personality: 'flag', strength: 'normal', hubBusiness: 80, hubTourism: 40, rangeKm: 5000 };

describe('Abschnitt 7.9 Planung einer Strecke', () => {
  it('7.9: ein Ziel ohne freie Slots, mit Spieler-Stufe 3, außer Reichweite, zu nah, schon bedient oder ohne Piste wird nie gewählt', () => {
    const bad = [
      target({ slotsFree: false }),
      target({ playerTier3: true }),
      target({ km: 6000 }),
      target({ km: 149 }),
      target({ served: true }),
      target({ runwayOk: false }),
    ];
    for (const t of bad) {
      assert.equal(isEligibleTarget(t, ctx.rangeKm), false);
      assert.equal(preselectScore(t, ctx), 0);
    }
    assert.deepEqual(preselectTargets(bad, { ...ctx, strength: 'hard' }, () => 0), []);
  });

  it('7.9: Vorauswahl-Wert nach Formel (Gewichte der Persönlichkeit, kurze Strecke anteilig, Abflüge anderer)', () => {
    // Flag: Gewicht = 1,5 × Geschäft + 0,5 × Tourismus; Drehkreuz 140, Ziel 100.
    const t = target({ km: 500, otherDepartures: 14 });
    near(preselectScore(t, ctx), (Math.sqrt(140 * 100) * Math.min(1, 500 / 1000)) / 2);
    // LCC: Langstrecke × 0,4.
    const lcc = { ...ctx, personality: 'lcc' as const };
    const long = target({ km: 4000 });
    const short = target({ km: 3000 });
    near(preselectScore(long, lcc) / preselectScore(short, lcc), 0.4);
  });

  it('7.9 (E66): Drehkreuz einer anderen KI zählt × 2, ihre Abflüge teilen nicht', () => {
    const plain = preselectScore(target(), ctx);
    near(preselectScore(target({ otherRivalHub: true }), ctx), 2 * plain);
    near(preselectScore(target({ otherRivalHub: true, otherDepartures: 28 }), ctx), 2 * plain);
    near(preselectScore(target({ otherDepartures: 28 }), ctx), plain / 3);
  });

  it('7.3/7.9: die besten Suchbreite Ziele + 2 zufällige', () => {
    const many = Array.from({ length: 20 }, (_, i) => target({ id: String(i), business: 10 + i }));
    for (const strength of RIVAL_STRENGTHS) {
      const picked = preselectTargets(many, { ...ctx, strength }, () => 0);
      const width = { easy: 4, normal: 8, hard: 12 }[strength];
      assert.equal(picked.length, width + 2);
      // Die besten zuerst: die höchsten Geschäfts-Werte.
      assert.deepEqual(picked.slice(0, width), Array.from({ length: width }, (_, k) => 19 - k));
      assert.equal(new Set(picked).size, picked.length);
    }
  });

  it('7.9 (E51): höchste Umläufe = Planer-Regel: Woche ÷ Umlaufzeit (mit Boden- und Wendezeit), ohne die Zeit anderer Umläufe, mindestens 1', () => {
    // FRA–MAD-ähnlich: 1 420 km mit 830 km/h; Umlauf = 30 + Flug + 60 + Flug + 30, auf 5 Minuten aufgerundet.
    const cycle = aircraftTripMinutes(1420, 830, 'Narrowbody');
    assert.equal(cycle % 5, 0);
    assert.equal(rivalMaxRotations(1420, 830, 'Narrowbody'), Math.floor(MINUTES_PER_WEEK / cycle));
    assert.equal(rivalMaxRotations(1420, 830, 'Narrowbody', 5 * cycle), Math.floor(MINUTES_PER_WEEK / cycle) - 5);
    assert.equal(rivalMaxRotations(1420, 830, 'Narrowbody', MINUTES_PER_WEEK), 1);
    // Kurze Strecke: mehr als die alten 21 (keine Nachtpause, wie im Planer).
    assert.ok(rivalMaxRotations(300, 500, 'Regional') > 21);
    // Widebody wendet länger als Narrowbody.
    assert.ok(aircraftTripMinutes(6000, 900, 'Widebody') > aircraftTripMinutes(6000, 900, 'Narrowbody'));
    assert.equal(weeklyTripCapacity(MINUTES_PER_WEEK + 1), 0);
    assert.throws(() => weeklyTripCapacity(0));
  });

  it('7.9: bewertet werden 100 %, 60 % und 30 % der höchsten Umläufe', () => {
    assert.deepEqual(planFrequencies(10), [10, 6, 3]);
    assert.deepEqual(planFrequencies(1), [1]);
    assert.deepEqual(planFrequencies(2), [2, 1]);
  });

  it('7.9: Planer und KI rechnen für denselben Plan dieselbe Zahl', () => {
    const planner = (t: number, f: number) => 1000 * t + 37 * f - f * f;
    const plan = rivalPlanRoute([0, 1, 2], () => 14, planner, 'normal', () => 0.7)!;
    assert.equal(plan.expectedProfit, planner(plan.targetIndex, plan.weeklyFrequency));
  });

  it('7.9: Hard (Schätzfehler 0) wählt immer den Plan mit dem höchsten erwarteten Gewinn', () => {
    const profits = new Map<string, number>([
      ['0-10', 50], ['0-6', 80], ['0-3', 20],
      ['1-10', 120], ['1-6', 90], ['1-3', -5],
    ]);
    const plan = rivalPlanRoute([0, 1], () => 10, (t, f) => profits.get(`${t}-${f}`)!, 'hard', (k) => (k % 2 ? 1 : -1))!;
    assert.deepEqual([plan.targetIndex, plan.weeklyFrequency, plan.forecast], [1, 10, 120]);
    // Easy mit Schätzfehler kann sich irren: ± 40 %.
    near(forecastWithNoise(100, 'easy', -1), 60);
    near(forecastWithNoise(100, 'normal', 1), 110);
  });

  it('7.9: eröffnen nur mit erwartetem Gewinn > 0 (Easy jeder 2. Versuch) und Kasse ≥ Slots + Reserve', () => {
    const loss = { targetIndex: 0, weeklyFrequency: 7, expectedProfit: -10, forecast: -10 };
    const gain = { ...loss, expectedProfit: 10, forecast: 10 };
    assert.equal(mayOpenRoute(loss, 'normal', 0, 1e9, 0, 0), false);
    assert.equal(mayOpenRoute(loss, 'easy', 0.4, 1e9, 0, 0), true);
    assert.equal(mayOpenRoute(loss, 'easy', 0.6, 1e9, 0, 0), false);
    assert.equal(mayOpenRoute(gain, 'normal', 0.9, 100, 60, 40), true);
    assert.equal(mayOpenRoute(gain, 'normal', 0.9, 99, 60, 40), false);
  });
});

// ---------------------------------------------------------------------------
// 7.10 Slots, Schalter, Drehkreuze, Einrichtungen
// ---------------------------------------------------------------------------

describe('Abschnitt 7.10 Slots, Schalter, Drehkreuze und Einrichtungen', () => {
  it('7.10: Anteil der Grenze 0,25 am eigenen Drehkreuz, 0,10 sonst', () => {
    assert.equal(rivalSlotCap(5, true), Math.floor(RIVAL_SLOT_SHARE_HUB * slotLimit(5)));
    assert.equal(rivalSlotCap(3, false), Math.floor(RIVAL_SLOT_SHARE_OTHER * slotLimit(3)));
  });

  it('7.10: Σ gekaufte Slots aller ≤ Grenze, je KI ≤ Anteil und belegt ≤ gekauft, auch wenn viele KI kaufen', () => {
    const size = 2;
    const limit = slotLimit(size);
    // Spieler hat schon fast alles; zehn KI wollen je 40 Slots, eine davon mit Drehkreuz hier.
    let ownedByAll = limit - 50;
    const rivals = Array.from({ length: 10 }, (_, i) => ({ owned: 0, used: 0, hub: i === 0 }));
    for (let round = 0; round < 5; round++) {
      for (const r of rivals) {
        const state: RivalSlotState = { airportSize: size, ownHub: r.hub, owned: r.owned, used: r.used, ownedByAll };
        const buy = rivalSlotsToBuy(state, 14);
        if (buy === null) continue;
        r.owned += buy;
        ownedByAll += buy;
        r.used += 14;
        assert.ok(r.used <= r.owned);
        assert.ok(r.owned <= rivalSlotCap(size, r.hub));
      }
    }
    assert.ok(ownedByAll <= limit);
  });

  it('7.10: freie eigene Slots zuerst, dann kaufen', () => {
    const s: RivalSlotState = { airportSize: 5, ownHub: true, owned: 20, used: 14, ownedByAll: 100 };
    assert.equal(rivalSlotRoom(s), 6 + (rivalSlotCap(5, true) - 20));
    assert.equal(rivalSlotsToBuy(s, 4), 0);
    assert.equal(rivalSlotsToBuy(s, 10), 4);
    near(rivalSlotCost(4, 10, 'Narrowbody', at(1990)), 14 * slotPrice('Narrowbody', at(1990)));
  });

  it('7.10: Slots, die 6 Monate frei sind, verkauft die KI', () => {
    assert.equal(idleSlotsToSell([4, 4, 3, 5, 6, 3]), 3);
    assert.equal(idleSlotsToSell([9, 4, 4, 3, 5, 6, 3]), 3);
    assert.equal(idleSlotsToSell([4, 4, 3, 5, 6]), 0);
    assert.equal(idleSlotsToSell([4, 4, 0, 5, 6, 3]), 0);
  });

  it('7.10: jede KI-Strecke hat an beiden Enden einen Schalter, ohne Überlast (deskLoad ≤ 0,8)', () => {
    for (const deskType of ['normal', 'self'] as DeskType[]) {
      for (const seats of [1, 150, 3999, 4000, 4001, 25_000, 123_456]) {
        const n = rivalDesksNeeded(seats, deskType);
        assert.ok(n >= 1);
        const desks = { normal: deskType === 'normal' ? n : 0, self: deskType === 'self' ? n : 0 };
        assert.ok(deskLoad(seats, desks) <= 0.8 + 1e-12, `${deskType} ${seats}`);
        // Einer weniger wäre zu wenig (oder es ist schon der eine Pflicht-Schalter).
        if (n > 1) {
          const fewer = { normal: desks.normal && n - 1, self: desks.self && n - 1 };
          assert.ok(deskLoad(seats, fewer) > 0.8);
        }
      }
    }
    assert.equal(rivalDesksNeeded(0, 'normal'), 0);
  });

  it('7.10: Verwaltungsstufe 2 an eigenen Drehkreuzen, sonst keine, nie 3 (E63)', () => {
    assert.equal(rivalManagementTier(true), 2);
    assert.equal(rivalManagementTier(false), 0);
  });

  it('7.10/E63: an einem Flughafen mit Spieler-Stufe 3 eröffnet keine KI eine neue Strecke oder ein Drehkreuz', () => {
    assert.equal(rivalMayOpenRouteBetween(true, false), false);
    assert.equal(rivalMayOpenRouteBetween(false, true), false);
    assert.equal(rivalMayOpenRouteBetween(false, false), true);
    const hubs: NewHubCandidate[] = [
      { id: 'A', level: 5, demand: 100, region: 'EU', rivalHub: false, playerHub: false, playerTier3: true },
      { id: 'B', level: 5, demand: 100, region: 'EU', rivalHub: false, playerHub: false, playerTier3: false },
    ];
    assert.deepEqual(newHubWeights(hubs, 'flag', 'EU').map((w) => w > 0), [false, true]);
  });

  it('7.10/E63: bestehende Strecken dort bleiben und dürfen mehr Flüge bekommen (Feinabstimmung kennt keine Sperre)', () => {
    // Feinabstimmung fragt nur Slots, nicht die Sperre.
    const input: FineTuneInput = { route: route('a', 50, 8), maxRotations: 14, slotRoom: 4, crisisReduced: false };
    assert.equal(fineTune(input, (_id, f) => f * 1000), 10);
  });

  it('7.10: VIP-Lounge nur Flag und Boutique, mit Premium-Sitzen ab dem Drehkreuz und 3-facher Deckung', () => {
    const m = at(1990);
    const price = facilityPrice('vipLounge', m);
    for (const p of PERSONALITY_IDS) {
      assert.equal(rivalBuildsLounge(p, false, true, 3 * price, m), p === 'flag' || p === 'boutique');
    }
    assert.equal(rivalBuildsLounge('flag', false, true, 3 * price - 1, m), false);
    assert.equal(rivalBuildsLounge('flag', false, false, 10 * price, m), false);
    assert.equal(rivalBuildsLounge('flag', true, true, 10 * price, m), false);
  });
});

// ---------------------------------------------------------------------------
// 7.11 Flotte
// ---------------------------------------------------------------------------

const buyInput = (over: Partial<RivalBuyInput> = {}): RivalBuyInput => ({
  personality: 'flag',
  strength: 'normal',
  month: at(1990),
  cash: 200e6,
  allFlying: true,
  growthStop: false,
  routeFound: true,
  price: 50e6,
  slotCost: 1e6,
  recentProfit: true,
  u: 0,
  buyChance: 0.45,
  ...over,
});

const plane = (over: Partial<RivalPlaneView> = {}): RivalPlaneView => ({
  id: 'p',
  builtMonth: at(1980),
  typeLastDeliveryOffset: null,
  airframeCondition: 90,
  cabinCondition: 90,
  flying: true,
  routeResult: 1000,
  idleMonths: 0,
  ...over,
});

describe('Abschnitt 7.11 Flotte der KI', () => {
  it('7.11: kein Kauf, der die Kasse unter die Reserve drückt', () => {
    const m = at(1990);
    const reserve = rivalCashReserve('flag', m);
    for (const cash of [20e6, 60e6, 100e6, 200e6, 1e9]) {
      for (const price of [5e6, 20e6, 50e6, 90e6]) {
        const input = buyInput({ cash, price, slotCost: 2e6 });
        if (rivalBuyBlocker(input) === null) assert.ok(cash - price - 2e6 >= reserve);
      }
    }
  });

  it('7.11: Bedingungen des Kaufs der Reihe nach', () => {
    assert.equal(rivalBuyBlocker(buyInput()), null);
    assert.equal(rivalBuyBlocker(buyInput({ allFlying: false })), 'aircraftIdle');
    assert.equal(rivalBuyBlocker(buyInput({ growthStop: true })), 'growthStop');
    assert.equal(rivalBuyBlocker(buyInput({ routeFound: false })), 'noRoute');
    assert.equal(rivalBuyBlocker(buyInput({ u: 0.45 })), 'notThisMonth');
    // Flag: Preis ≤ 45 % der Kasse.
    assert.equal(rivalBuyBlocker(buyInput({ price: 91e6 })), 'cashShare');
    assert.equal(rivalBuyBlocker(buyInput({ personality: 'lcc', price: 91e6 })), null);
    // Ohne Gewinn in den letzten 3 Monaten nur Preis ≤ Kasse / 3.
    assert.equal(rivalBuyBlocker(buyInput({ recentProfit: false, price: 70e6 })), 'noRecentProfit');
    assert.equal(rivalBuyBlocker(buyInput({ recentProfit: false, price: 60e6 })), null);
  });

  it('7.11: Typ mit dem besten Gewinn nach Kapitalkosten unter den lieferbaren mit Piste und Reichweite (E81)', () => {
    const m = at(1990);
    const opt = (over: Partial<PurchaseOption>): PurchaseOption => ({
      firstDeliveryOffset: 0,
      lastDeliveryOffset: null,
      runwayOk: true,
      inRange: true,
      price: 50e6,
      expectedProfit: 1e6,
      ...over,
    });
    const options = [
      opt({ price: 40e6, expectedProfit: 1e6 }),
      opt({ price: 80e6, expectedProfit: 3e6 }),
      opt({ price: 10e6, expectedProfit: 9e6, firstDeliveryOffset: m + 1 }),
      opt({ price: 10e6, expectedProfit: 9e6, runwayOk: false }),
      opt({ price: 10e6, expectedProfit: 9e6, inRange: false }),
      opt({ price: 10e6, expectedProfit: 9e6, lastDeliveryOffset: m - 1 }),
    ];
    assert.equal(pickPurchaseType(options, m), 1);
    assert.equal(pickPurchaseType(options.slice(2), m), -1);
  });

  it('7.11: Kapitalkosten = Kaufpreis × Zins / 12; der teure Typ mit mehr Gewinn schlägt den mit mehr Gewinn je Preis (E81)', () => {
    assert.equal(profitAfterCapital(1e6, 12e6), 1e6 - (12e6 * RIVAL_CAPITAL_RATE) / 12);
    const m = at(1990);
    const opt = (price: number, expectedProfit: number): PurchaseOption => ({
      firstDeliveryOffset: 0,
      lastDeliveryOffset: null,
      runwayOk: true,
      inRange: true,
      price,
      expectedProfit,
    });
    // Narrowbody 30 Mio. $ mit 0,6 Mio. $ je Monat (2 % je Preis), Widebody 120 Mio. $ mit 1,5 Mio. $ (1,25 % je Preis).
    const options = [opt(30e6, 0.6e6), opt(120e6, 1.5e6)];
    assert.ok(options[0].expectedProfit / options[0].price > options[1].expectedProfit / options[1].price);
    assert.equal(pickPurchaseType(options, m), 1);
    // Reicht der Mehrgewinn nicht für die Zinsen, bleibt es beim günstigen Typ.
    assert.equal(pickPurchaseType([opt(30e6, 0.6e6), opt(120e6, 0.6e6 + (90e6 * RIVAL_CAPITAL_RATE) / 12 - 1)], m), 0);
  });

  it('7.11: Bezugs-Typen vor einem Kauf: eigener Typ, dazu der beliebteste lieferbare Narrowbody und Widebody, ohne doppelte (E81)', () => {
    const m = at(1990);
    const type = (id: string, cls: string, popularity: number, first = 0, last: number | null = null): CatalogType => ({
      id,
      family: id,
      class: cls,
      capacity: 150,
      cruiseSpeed: 800,
      efficiency: 1,
      popularity,
      maxRange: 5000,
      basePrice: 1e6,
      icaoCode: 'C',
      firstDeliveryOffset: first,
      lastDeliveryOffset: last,
    });
    const catalog = [
      type('rj', 'Regional', 9),
      type('nb1', 'Narrowbody', 5),
      type('nb2', 'Narrowbody', 7),
      type('wb-old', 'Widebody', 9, 0, m - 1),
      type('wb', 'Widebody', 4),
      type('wb-new', 'Widebody', 8, m + 1),
    ];
    assert.deepEqual(referenceTypeIndices(catalog, 'rj', m), [0, 2, 4]);
    // Eigener Typ ist schon der beliebteste Narrowbody: nicht doppelt.
    assert.deepEqual(referenceTypeIndices(catalog, 'nb2', m), [2, 4]);
    assert.equal(referenceTypeIndices(catalog, 'nb1', m)[0], referenceTypeIndex(catalog, 'nb1', m));
    // Ohne lieferbaren Widebody nur die anderen.
    assert.deepEqual(referenceTypeIndices(catalog.slice(0, 4), undefined, m), [0, 2]);
  });

  it('7.11: Modernisierung ab 20 Jahren oder 12 Jahre nach dem Lieferende des Typs, das älteste zuerst', () => {
    const m = at(2000);
    assert.equal(needsModernization(plane({ builtMonth: m - 240 }), m), false);
    assert.equal(needsModernization(plane({ builtMonth: m - 241 }), m), true);
    assert.equal(needsModernization(plane({ builtMonth: m - 12, typeLastDeliveryOffset: m - 144 }), m), false);
    assert.equal(needsModernization(plane({ builtMonth: m - 12, typeLastDeliveryOffset: m - 145 }), m), true);
    const fleet = [plane({ builtMonth: m - 250 }), plane({ builtMonth: m - 300 }), plane({ builtMonth: m - 10 })];
    assert.equal(modernizationCandidate(fleet, m), 1);
    assert.equal(modernizationCandidate([plane({ builtMonth: m })], m), -1);
  });

  it('7.11/7.12: Modernisierung nur bezahlbar und ohne Wachstumsstopp', () => {
    const m = at(2000);
    const reserve = rivalCashReserve('optimizer', m);
    assert.equal(mayModernize('optimizer', m, 10e6, 5e6, 15e6 - reserve, false), true);
    assert.equal(mayModernize('optimizer', m, 10e6, 5e6, 15e6 - reserve + 1, false), false);
    assert.equal(mayModernize('optimizer', m, 1e9, 5e6, 1e6, true), false);
  });

  it('7.11: Grundüberholung unter 60 % Zelle oder Kabine, wenn die Kasse nach Reserve reicht', () => {
    assert.equal(needsOverhaul(plane({ airframeCondition: 59.9 })), true);
    assert.equal(needsOverhaul(plane({ cabinCondition: 59 })), true);
    assert.equal(needsOverhaul(plane({ airframeCondition: 60, cabinCondition: 60 })), false);
    const m = at(1990);
    const reserve = rivalCashReserve('lcc', m);
    assert.equal(mayOverhaul('lcc', m, reserve + 1e6, 1e6), true);
    assert.equal(mayOverhaul('lcc', m, reserve + 1e6, 1e6 + 1), false);
  });

  it('7.11: Notverkauf bei Kasse < 0: erst ein freies, sonst das der schlechtesten Strecke, auch wenn alle Gewinn machen', () => {
    const fleet = [plane({ routeResult: 500 }), plane({ routeResult: 100 }), plane({ routeResult: 900 })];
    assert.equal(emergencySaleCandidate(fleet, -1), 1);
    assert.equal(emergencySaleCandidate([...fleet, plane({ flying: false, routeResult: 0 })], -1), 3);
    assert.equal(emergencySaleCandidate(fleet, 0), -1);
    assert.equal(emergencySaleCandidate([], -1), -1);
  });

  it('7.11: Leerlauf-Verkauf nach 6 Monaten, in der Krise nach 12; die Uhr läuft auch in der Krise (W9)', () => {
    let idle = 0;
    for (let k = 0; k < MAX_IDLE_MONTHS; k++) idle = nextIdleMonths(idle, false);
    assert.equal(sellIdle(idle, false), true);
    assert.equal(sellIdle(idle, true), false);
    for (let k = MAX_IDLE_MONTHS; k < CRISIS_IDLE_MONTHS; k++) idle = nextIdleMonths(idle, false);
    assert.equal(sellIdle(idle, true), true);
    assert.equal(nextIdleMonths(idle, true), 0);
  });
});

// ---------------------------------------------------------------------------
// 7.12 Krise
// ---------------------------------------------------------------------------

describe('Abschnitt 7.12 Krise', () => {
  it('7.12: Juni 1974 → Krise (Ölkrise in der Treibstoff-Tabelle, E61)', () => {
    const severity = crisisSeverity([], at(1974, 6));
    assert.ok(isCrisis(severity), String(severity));
  });

  it('7.12: 2020 → Krise (weltweites Ereignis, Nachfrage × 0,2)', () => {
    const severity = crisisSeverity([{ demandMultiplier: 0.2 }], at(2020, 4));
    near(severity, 0.8, 1e-12);
    assert.ok(isCrisis(severity));
  });

  it('7.12: ein Monat ohne Ereignis bei gleichbleibendem Treibstoff → 0', () => {
    // Nach 2030 bleibt die Tabelle auf ihrem letzten Wert (5.2).
    assert.equal(crisisSeverity([], at(2040)), 0);
  });

  it('7.12: ein regionales Ereignis zählt mit seinem Anteil an der Welt', () => {
    near(worldEventDemandFactor([{ demandMultiplier: 0.4, regions: ['AS'] }]), 1 - 0.6 / 6);
    near(worldEventDemandFactor([]), 1);
  });

  it('7.12: Wachstumsstopp ab der Schwelle der Persönlichkeit', () => {
    for (const p of PERSONALITY_IDS) {
      const s = PERSONALITIES[p].growthStopSeverity;
      assert.equal(growthStopped(p, s), true);
      assert.equal(growthStopped(p, s - 0.01), false);
    }
  });

  it('7.12: Krisen-Fahrplan kürzt auf 80 % Auslastung, baut ab 95 % und nach der Krise um 25 % je Monat auf', () => {
    assert.equal(crisisFrequency({ current: 10, full: 10, loadFactor: 0.4, inCrisis: true }), 5);
    assert.equal(crisisFrequency({ current: 5, full: 10, loadFactor: 0.97, inCrisis: true }), 8);
    assert.equal(crisisFrequency({ current: 5, full: 10, loadFactor: 0.85, inCrisis: true }), 5);
    assert.equal(crisisFrequency({ current: 5, full: 10, inCrisis: true }), 5);
    assert.equal(crisisFrequency({ current: 8, full: 10, inCrisis: false }), 10);
    assert.equal(crisisFrequency({ current: 1, full: 2, loadFactor: 0.1, inCrisis: true }), 1);
  });
});

// ---------------------------------------------------------------------------
// 7.13 Wachstum, Größe und Dividende
// ---------------------------------------------------------------------------

const hubInput = (over: Partial<NewHubInput> = {}): NewHubInput => ({
  personality: 'expansionist',
  ownHubs: [{ usedSlots: Math.ceil(0.9 * rivalSlotCap(5, true)), airportSize: 5, monthsWithoutProfitableRoute: 0 }],
  size: 25_000,
  cash: 1e9,
  month: at(1990),
  tierPrice: newHubTierPrice(5, at(1990)),
  growthStop: false,
  u: 0,
  ...over,
});

describe('Abschnitt 7.13 Wachstum, Größe und Dividende', () => {
  it('7.13: Größe = Σ Sitze × Umläufe × 2 (beide Richtungen)', () => {
    assert.equal(rivalSize([{ seats: 180, weeklyFrequency: 14 }, { seats: 100, weeklyFrequency: 7 }]), 180 * 28 + 100 * 14);
  });

  it('7.13: neues Drehkreuz nur, wenn alle Bedingungen gelten', () => {
    assert.equal(wantsNewHub(hubInput()), true);
    assert.equal(wantsNewHub(hubInput({ u: 0.04 })), false);
    assert.equal(wantsNewHub(hubInput({ growthStop: true })), false);
    assert.equal(wantsNewHub(hubInput({ size: 19_999 })), false);
    const two = [hubInput().ownHubs[0], hubInput().ownHubs[0]];
    assert.equal(wantsNewHub(hubInput({ personality: 'boutique', ownHubs: two })), false); // MAX_HUBS 2
    assert.equal(wantsNewHub(hubInput({ personality: 'boutique' })), true);
    const notFull = [{ usedSlots: 10, airportSize: 5, monthsWithoutProfitableRoute: 2 }];
    assert.equal(wantsNewHub(hubInput({ ownHubs: notFull })), false);
    assert.equal(wantsNewHub(hubInput({ ownHubs: [{ ...notFull[0], monthsWithoutProfitableRoute: 3 }] })), true);
    const reserve = rivalCashReserve('expansionist', at(1990));
    const price = newHubTierPrice(5, at(1990));
    assert.equal(wantsNewHub(hubInput({ cash: price + reserve })), true);
    assert.equal(wantsNewHub(hubInput({ cash: price + reserve - 1 })), false);
  });

  it('7.13: Ort ab Größe 5, nicht an KI-Drehkreuzen, Heimatregion × 4, Spieler-Drehkreuz × 3 × Angriffslust / 6', () => {
    const base = { id: 'x', level: 5, demand: 100, region: 'NA' as const, rivalHub: false, playerHub: false, playerTier3: false };
    const weights = newHubWeights(
      [
        base,
        { ...base, region: 'EU' as const },
        { ...base, level: 4 },
        { ...base, rivalHub: true },
        { ...base, playerHub: true },
      ],
      'lcc',
      'EU',
    );
    assert.deepEqual(weights, [100, 400, 0, 0, 100 * 3 * (8 / 6)]);
  });

  it('7.13: Kasse nach Dividende ≤ Grenze; Grenze mindestens der Boden mit atCost', () => {
    const m = at(2000);
    const floor = atCost(DIVIDEND_FLOOR_1960, m);
    assert.equal(dividendLimit(m, []), floor);
    assert.equal(dividendLimit(m, Array(24).fill(1e6)), floor);
    near(dividendLimit(m, [...Array(12).fill(1e9), ...Array(12).fill(2e7)]), 12 * 2e7);
    for (const cash of [-1e6, 0, floor, 2 * floor, 1e12]) {
      const limit = dividendLimit(m, [2e7]);
      const div = rivalDividend(cash, limit);
      assert.ok(div >= 0);
      assert.ok(cash - div <= Math.max(cash, limit));
      if (cash > limit) near(cash - div, limit);
    }
  });
});

// ---------------------------------------------------------------------------
// 7.14 Zuschuss
// ---------------------------------------------------------------------------

describe('Abschnitt 7.14 Zuschuss', () => {
  it('7.14/7.18: Zuschuss mit atCost: 1960 450 000 $, 1985 606 000 $, 1995 455 000 $, 2005 257 000 $', () => {
    // Formel mit Schalter an (abgeschafft seit E68, Paket 3.9e).
    near(rivalSubsidy(at(1960), true), 450_000, 1);
    near(rivalSubsidy(at(1985), true), 606_000, 1000);
    near(rivalSubsidy(at(1995), true), 455_000, 1000);
    near(rivalSubsidy(at(2005), true), 257_000, 1000);
    assert.equal(subsidy1960(at(1995)), 300_000);
    assert.equal(subsidy1960(at(2030)), 150_000);
  });

  it('7.14: ausgeschaltet → kein Dollar Zuschuss in keinem Monat', () => {
    for (let m = 0; m < 12 * 80; m++) assert.equal(rivalSubsidy(m, false), 0);
  });

  it('7.14 (E68): der Zuschuss ist abgeschafft, auch für KI mit Merkmal `subsidized`', () => {
    assert.equal(RIVAL_SUBSIDY_ENABLED, false);
    for (let m = 0; m < 12 * 80; m += 5) assert.equal(rivalSubsidy(m), 0);
  });
});

// ---------------------------------------------------------------------------
// 7.15 Notlage, Verkauf, Auflösung
// ---------------------------------------------------------------------------

function runDistress(cashes: readonly number[], creditLimit = 1e9, start: RivalDistressState = RIVAL_HEALTHY) {
  let state = start;
  const events: (string | null)[] = [];
  for (const cash of cashes) {
    const step = rivalDistressStep(state, { cash, creditLimit, aircraftCount: 3 });
    state = step.state;
    events.push(step.event);
  }
  return { state, events };
}

describe('Abschnitt 7.15 Notlage, Verkauf, Auflösung', () => {
  it('7.15: 5 Monate Kasse < 0, dann 1 Monat ≥ 0, dann 5 Monate < 0 → nicht zum Verkauf', () => {
    const { state } = runDistress([...Array(5).fill(-1), 0, ...Array(5).fill(-1)]);
    assert.equal(state.status, 'healthy');
    assert.equal(state.distressMonths, 5);
  });

  it('7.15: 6 Monate in Folge → zum Verkauf; Kasse ≥ 0 → wieder gesund', () => {
    const { state, events } = runDistress(Array(6).fill(-1));
    assert.equal(state.status, 'forSale');
    assert.equal(events[5], 'forSale');
    const back = rivalDistressStep(state, { cash: 1, creditLimit: 1e9, aircraftCount: 3 });
    assert.deepEqual([back.state.status, back.event], ['healthy', 'recovered']);
  });

  it('7.15/8.14: Kasse unter der Kreditgrenze → sofort zum Verkauf', () => {
    const { state } = runDistress([-101], 100);
    assert.equal(state.status, 'forSale');
  });

  it('7.15: Auflösung nach 12 Monaten zum Verkauf oder ohne Flugzeuge', () => {
    const { state, events } = runDistress(Array(6 + 12).fill(-1));
    assert.equal(state.status, 'liquidated');
    assert.equal(events.filter((e) => e === 'liquidated').length, 1);
    const none = rivalDistressStep(RIVAL_HEALTHY, { cash: 1e9, creditLimit: 0, aircraftCount: 0 });
    assert.equal(none.state.status, 'liquidated');
  });

  it('7.15: nach der Auflösung sind alle Flugzeuge im Gebrauchtmarkt und alle Slots frei, Schulden verfallen', () => {
    const planes = [{ id: 'a' }, { id: 'b' }];
    const holdings = [
      { airportId: 'X', slots: 28, desks: { normal: 1, self: 0 }, hub: true },
      { airportId: 'Y', slots: 14, desks: { normal: 1, self: 0 }, hub: false },
      { airportId: 'Z', slots: 0, desks: { normal: 1, self: 0 }, hub: false },
    ];
    const result = liquidate(planes, holdings, -5e6);
    assert.deepEqual(result.toUsedMarket, planes);
    assert.deepEqual(result.freedSlots, [{ airportId: 'X', slots: 28 }, { airportId: 'Y', slots: 14 }]);
    assert.equal(result.debtWrittenOff, 5e6);
  });
});

// ---------------------------------------------------------------------------
// 7.16 Übernahme
// ---------------------------------------------------------------------------

describe('Abschnitt 7.16 Übernahme', () => {
  const M2010 = at(2010);
  const a320 = {
    listPrice1960: 40e6,
    builtMonth: at(1990),
    cabinListPrice1960: 0,
    cabinInstalledMonth: at(1990),
    airframeCondition: 100,
    cabinCondition: 100,
  };
  const exampleValue = {
    cash: -20e6,
    aircraftValues: Array(10).fill(aircraftValue(a320, M2010)),
    slotResaleValue: 280 * slotResalePrice('Narrowbody', M2010),
  };

  it('7.18: Beispiel – Übernahme 2010 kostet 198,7 Mio. $, der Spieler übernimmt 20 Mio. $ Schulden', () => {
    near(aircraftValue(a320, M2010), 20.6e6, 0.05e6);
    near(slotResalePrice('Narrowbody', M2010), 45_391, 1);
    near(takeoverPrice(exampleValue, M2010), 198.7e6, 0.05e6);
    const result = takeover(500e6, exampleValue, [], new Map(), M2010);
    near(result.playerCash, 500e6 - result.price - 20e6);
  });

  it('7.16: Preis = companyValue der KI, mindestens der Mindestpreis mit atCost', () => {
    assert.equal(takeoverPrice(exampleValue, M2010), companyValue(exampleValue));
    const poor = { cash: -50e6, aircraftValues: [1e6], slotResaleValue: 0 };
    assert.equal(takeoverPrice(poor, M2010), atCost(TAKEOVER_MIN_PRICE_1960, M2010));
  });

  it('7.16: Kasse danach = vorher − Preis + KI-Kasse; Slots je Flughafen; Stufe mindestens 1, an KI-Drehkreuzen 2', () => {
    const holdings = [
      { airportId: 'HUB', slots: 140, desks: { normal: 3, self: 0 }, hub: true },
      { airportId: 'B', slots: 14, desks: { normal: 1, self: 0 }, hub: false },
      { airportId: 'C', slots: 14, desks: { normal: 0, self: 1 }, hub: false },
    ];
    const mine = new Map([
      ['B', { slots: 20, desks: { normal: 2, self: 0 }, tier: 3 }],
      ['HUB', { slots: 0, desks: { normal: 0, self: 0 }, tier: 1 }],
    ]);
    const value = { cash: 7e6, aircraftValues: [30e6], slotResaleValue: 168 * 40_000 };
    const result = takeover(100e6, value, holdings, mine, M2010);
    near(result.playerCash, 100e6 - result.price + 7e6);
    assert.deepEqual(result.airports, [
      { airportId: 'HUB', slots: 140, desks: { normal: 3, self: 0 }, tier: 2 },
      { airportId: 'B', slots: 34, desks: { normal: 3, self: 0 }, tier: 3 },
      { airportId: 'C', slots: 14, desks: { normal: 0, self: 1 }, tier: 1 },
    ]);
    // Σ übernommene Slots je Flughafen = Slots der KI dort.
    for (const h of holdings) {
      const taken: number = result.airports.find((a) => a.airportId === h.airportId)!.slots;
      assert.equal(taken - (mine.get(h.airportId)?.slots ?? 0), h.slots);
    }
  });

  it('7.16: zum Verkauf ab Rang 6, gesund ab Rang 9, aufgelöst nie', () => {
    assert.equal(mayTakeOver(5, 'forSale'), false);
    assert.equal(mayTakeOver(6, 'forSale'), true);
    assert.equal(mayTakeOver(8, 'healthy'), false);
    assert.equal(mayTakeOver(9, 'healthy'), true);
    assert.equal(mayTakeOver(99, 'liquidated'), false);
  });
});

// ---------------------------------------------------------------------------
// 7.17 Wirkung auf den Spieler und Anzeige
// ---------------------------------------------------------------------------

describe('Abschnitt 7.17 Wirkung auf den Spieler und Anzeige', () => {
  it('7.17: Ticker-Rang nach Fluggästen: 1 + Anzahl KI mit mehr', () => {
    assert.equal(tickerRank(1000, [500, 2000, 1000, 3000]), 3);
    assert.equal(tickerRank(1000, []), 1);
  });

  it('7.17: Preiskampf, Kürzung, Streckenende, neues Drehkreuz nur mit Spieler-Flughafen; der Rest immer', () => {
    for (const kind of ['priceWar', 'scheduleCut', 'routeClosed', 'newHub'] as const) {
      assert.equal(showRivalNews(kind, false), false);
      assert.equal(showRivalNews(kind, true), true);
    }
    for (const kind of ['forSale', 'recovered', 'liquidated', 'modernized', 'newRival'] as const) {
      assert.equal(showRivalNews(kind, false), true);
    }
  });

  it('1.6/7.17: Abflüge je Flughafen = belegte Slots (7 Umläufe → 7 an jedem Ende), je Paar in einer Richtung', () => {
    const routes = [
      { origin: 'A', destination: 'B', weeklyFrequency: 7 },
      { origin: 'B', destination: 'A', weeklyFrequency: 3 },
      { origin: 'A', destination: 'C', weeklyFrequency: 14 },
    ];
    assert.equal(departuresAt(routes, 'A'), 24);
    assert.equal(departuresAt(routes, 'B'), 10);
    assert.equal(departuresAt(routes, 'C'), 14);
    assert.equal(departuresOnPair(routes, 'B', 'A'), 10);
    assert.equal(departuresOnPair(routes, 'B', 'C'), 0);
  });
});
