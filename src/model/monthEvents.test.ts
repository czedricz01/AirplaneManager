/**
 * Regeltests zu SPEZIFIKATION 8.3–8.10 (Zufall, Weltereignisse, Krisen-Antworten, Störungen und Vogelschläge,
 * Personal, Pech-Deckel, gestrichene und gecharterte Flüge, Verschleiß) und den passenden Teilen von Beispiel 8.17.
 * Paket 3.8a.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fuelPrice, fuelTable } from './costs';
import { eventDemandFactor } from './demand';
import { newPrice } from './fleet';
import { cancellationPenalty, reputationTargetParts, researchEffects } from './progress';
import { RIVAL_INPUTS } from './rivals';
import {
  AIRPORT_STRIKE_CANCEL_SHARE,
  BIRD_STRIKE_CHANCE,
  CHARTER_MARKUP,
  DEFECT_CANCEL_SHARE,
  FUEL_CRISES,
  HISTORICAL_EVENTS,
  MAX_DISRUPTION_QUESTIONS,
  RANDOM_EVENT_CHANCE,
  RANDOM_EVENT_TEMPLATES,
  SALARY_PCT_MIN,
  START_YEAR,
  STRIKE_MORALE_THRESHOLD,
  WEAR_BASE,
  WEEKS_PER_MONTH,
  WINTER_CANCEL_SHARE,
} from './constants';
import {
  activeCrisisResponseFactor,
  activeWorldEvents,
  badLuckCapOpen,
  birdStrikeCost,
  charterAdvantage,
  charterCost,
  charterFee,
  claimedByRandomEvent,
  companyCancelledShare,
  crisisResponseFactor,
  crisisResponsePrice,
  defectChance,
  disruptionQuestions,
  disruptionShares,
  eventNews,
  flownHours,
  flownLegs,
  hedgePrice,
  hedgeLockMonth,
  hedgedFuelTable,
  historicalEvent,
  isBadLuckEvent,
  isWinterMonth,
  labourMarketPremium,
  moraleTarget,
  monthlyWear,
  nextMorale,
  offeredSeats,
  recoveryPrice,
  rollBirdStrike,
  rollDisruptions,
  rollRandomEvent,
  rollStaffStrike,
  rollTransition,
  routeCauses,
  salaryFloor,
  setSalary,
  settledSalary,
  strikeCancelShare,
  strikeChance,
  wornCondition,
  type DisruptedRoute,
  type DisruptionPlane,
  type TransitionRollInput,
  type WorldEvent,
} from './monthEvents';

const HERE = dirname(fileURLToPath(import.meta.url));
const m = (year: number, calendarMonth = 1) => (year - START_YEAR) * 12 + calendarMonth - 1;
const near = (actual: number, expected: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} ${actual} ≠ ${expected} ± ${tol}`);

const plane = (id: string, over: Partial<DisruptionPlane> = {}): DisruptionPlane => ({
  id,
  flies: true,
  airframeCondition: 80,
  builtMonth: m(1980),
  hasHangar: false,
  defectFactor: 1,
  badLuckCap: false,
  ...over,
});

describe('Abschnitt 8.3 Zufall und Spielstand', () => {
  it('8.3: kein Math.random in den Dateien von Abschnitt 8', () => {
    for (const name of ['monthEvents.ts', 'fleetMarket.ts', 'rng.ts']) {
      assert.doesNotMatch(readFileSync(join(HERE, name), 'utf8'), /Math\.random\(/, name);
    }
  });

  it('8.3: zwei Übergänge mit gleicher Eingabe ergeben dasselbe; die Reihenfolge der Flugzeuge ändert nichts', () => {
    const input: TransitionRollInput = {
      seed: 42,
      month: m(1990, 12),
      randomEvents: [],
      previousBadLuck: false,
      planes: ['b', 'a', 'c'].map((id) => plane(id, { defectFactor: 50, badLuckCap: id !== 'c' })),
      airports: [{ id: 'FRA', hasDepartures: true, badLuckCap: true }],
      capRegions: ['EU'],
      morale: 20,
    };
    const a = rollTransition(input);
    assert.deepEqual(rollTransition(input), a);
    assert.deepEqual(rollTransition({ ...input, planes: [...input.planes].reverse() }), a);
  });
});

describe('Abschnitt 8.4 Weltereignisse', () => {
  it('8.4: 17 geschichtliche Ereignisse, 6 weltweite mit Krisen-Antwort, 11 regionale ohne', () => {
    assert.equal(HISTORICAL_EVENTS.length, 17);
    const global = HISTORICAL_EVENTS.filter((e) => !e.regions);
    assert.equal(global.length, 6);
    assert.ok(global.every((e) => e.response));
    assert.ok(HISTORICAL_EVENTS.filter((e) => e.regions).every((e) => !e.response));
    for (const e of HISTORICAL_EVENTS) assert.ok(!('fuelMultiplier' in e), e.title);
  });

  it('8.4: Ölkrisen der Treibstoff-Tabelle (E61) passen zu Beginn und Dauer der Ereignisse', () => {
    for (const c of FUEL_CRISES) {
      const e = historicalEvent(c.name);
      assert.equal(c.startMonth, e.startMonth, c.name);
      assert.equal(c.months, e.months, c.name);
    }
  });

  it('8.4: 8 Vorlagen, 4 Pech und 4 Glück, ohne Treibstoff-Felder', () => {
    assert.equal(RANDOM_EVENT_TEMPLATES.length, 8);
    assert.equal(RANDOM_EVENT_TEMPLATES.filter((t) => t.demandMax < 1).length, 4);
    assert.equal(RANDOM_EVENT_TEMPLATES.filter((t) => t.demandMin > 1).length, 4);
    for (const t of RANDOM_EVENT_TEMPLATES) assert.ok(!('fuelMin' in t), t.title);
  });

  it('8.4: ohne laufendes Ereignis ist eventDemandFactor = 1', () => {
    const events = activeWorldEvents(m(1962, 3));
    assert.equal(events.length, 0);
    assert.equal(eventDemandFactor(events, 'EU', 'AS'), 1);
  });

  it('8.4: ein regionales Ereignis trifft jedes Angebot auf dem Paar gleich (ein Faktor je Paar, keine Gesellschaft)', () => {
    const events = activeWorldEvents(m(2003, 4)); // SARS
    assert.ok(events.some((e) => e.title === 'SARS Outbreak'));
    near(eventDemandFactor(events, 'AS', 'AS'), 0.6, 1e-12);
    near(eventDemandFactor(events, 'EU', 'AS'), 0.8, 1e-12);
    assert.equal(eventDemandFactor(events, 'EU', 'NA'), 1);
  });

  it('8.4: kein Ereignis ändert fuelPrice (Treibstoff nur aus der Tabelle)', () => {
    const month = m(2001, 10); // Aviation Downturn läuft
    assert.ok(activeWorldEvents(month).length > 0);
    assert.equal(fuelPrice(month), fuelPrice(month, []));
    assert.equal(fuelPrice.length <= 3, true);
  });

  it('8.4: Zufallsereignisse: etwa 5 % der Monate, Dauer und Faktor im Bereich der Vorlage, regional eine Region', () => {
    let count = 0;
    const N = 4000;
    for (let month = 0; month < N; month++) {
      const e = rollRandomEvent(7, month, true);
      if (!e) continue;
      count++;
      const t = RANDOM_EVENT_TEMPLATES.find((x) => x.title === e.title);
      assert.ok(t);
      assert.equal(e.startMonth, month);
      assert.ok(e.months >= t.durationMin && e.months <= t.durationMax && Number.isInteger(e.months));
      assert.ok(e.demandMultiplier >= t.demandMin && e.demandMultiplier <= t.demandMax);
      assert.equal(e.regions?.length ?? 0, t.regional ? 1 : 0);
    }
    near(count / N, RANDOM_EVENT_CHANCE, 0.012, 'Anteil');
  });

  it('8.4: bei geschlossenem Pech-Deckel kein Pech-Ereignis, Glück-Ereignisse weiter', () => {
    let good = 0;
    for (let month = 0; month < 4000; month++) {
      const e = rollRandomEvent(7, month, false);
      if (e) {
        assert.ok(!isBadLuckEvent(e));
        good++;
      }
    }
    assert.ok(good > 0);
  });

  it('8.4: Meldungen zu Beginn und Ende', () => {
    const e = historicalEvent('Aviation Downturn');
    assert.ok(eventNews(e.startMonth).started.some((x) => x.title === e.title));
    assert.ok(eventNews(e.startMonth + e.months).ended.some((x) => x.title === e.title));
    const random: WorldEvent = { title: 'Economic Slump', startMonth: 1000, months: 4, demandMultiplier: 0.88 };
    assert.deepEqual(eventNews(1000, [random]).started, [random]);
    assert.deepEqual(eventNews(1004, [random]).ended, [random]);
  });
});

describe('Abschnitt 8.5 Krisen-Antworten', () => {
  it('8.5: Preis wächst im gleichen Verhältnis wie die Bezugsgröße', () => {
    const hedge = historicalEvent('1973 Oil Crisis');
    const rec = historicalEvent('Global Pandemic');
    near(crisisResponsePrice(hedge, { fuelBill: 2e6, revenue: 0 }), 2 * crisisResponsePrice(hedge, { fuelBill: 1e6, revenue: 0 }), 1e-6);
    near(crisisResponsePrice(rec, { fuelBill: 0, revenue: 2e7 }), 2 * crisisResponsePrice(rec, { fuelBill: 0, revenue: 1e7 }), 1e-6);
  });

  it('8.17: Absicherung 1973 bei 1 Mio. $ Rechnung kostet 6,3 Mio. $ und spart mehr (E69)', () => {
    const e = historicalEvent('1973 Oil Crisis');
    near(hedgePrice(1e6, e.months), 6.3e6, 1e-6);
    let ratio = 0;
    for (let month = e.startMonth; month < e.startMonth + e.months; month++) ratio += fuelTable(month) / fuelTable(e.startMonth - 1);
    ratio /= e.months;
    assert.ok(ratio > 1.7 && ratio < 2.0, `Mittel ${ratio}`);
    assert.ok((ratio - 1) * e.months * 1e6 > hedgePrice(1e6, e.months));
  });

  it('8.17: Rückgewinnung: Faktor und Preis je Krise', () => {
    const cases: [string, number, number][] = [
      ['Aviation Downturn', 1.215, 0.42],
      ['Global Financial Crisis', 1.11, 0.495],
      ['Global Pandemic', 2.4, 1.68],
    ];
    for (const [title, factor, price] of cases) {
      const e = historicalEvent(title);
      const r = e.response?.recoveryShare ?? 0;
      near(crisisResponseFactor(e.demandMultiplier, r), factor, 0.001, title);
      near(recoveryPrice(r, e.demandMultiplier, e.months, 1), price, 1e-9, title);
      near(crisisResponsePrice(e, { fuelBill: 0, revenue: 1 }), price, 1e-9, title);
    }
  });

  it('8.5: ohne Antwort Faktor 1 und Tabellenpreis; eine Antwort wirkt nur für den Käufer', () => {
    const e = historicalEvent('Global Pandemic');
    const month = e.startMonth + 3;
    assert.equal(activeCrisisResponseFactor([], month), 1);
    assert.equal(activeCrisisResponseFactor([], month), RIVAL_INPUTS.crisisResponseFactor);
    assert.ok(activeCrisisResponseFactor([e], month) > 1);
    assert.equal(hedgedFuelTable([], month), undefined);
    assert.equal(fuelPrice(month, [], hedgedFuelTable([], month)), fuelPrice(month));
  });

  it('8.5: Absicherung hält den Preis vom Monat vor Beginn und endet mit dem Ereignis', () => {
    const e = historicalEvent('1979 Energy Crisis');
    const locked = fuelTable(e.startMonth - 1);
    assert.equal(hedgedFuelTable([e], e.startMonth), locked);
    assert.equal(hedgedFuelTable([e], e.startMonth + e.months - 1), locked);
    assert.equal(hedgedFuelTable([e], e.startMonth + e.months), undefined);
    assert.equal(fuelPrice(e.startMonth + e.months, [], hedgedFuelTable([e], e.startMonth + e.months)), fuelPrice(e.startMonth + e.months));
    assert.equal(activeCrisisResponseFactor([historicalEvent('Aviation Downturn')], historicalEvent('Aviation Downturn').startMonth + 12), 1);
  });

  it('8.5: Monat der Absicherung = Monat vor Beginn, solange das Ereignis läuft (Paket 4.2, Kopfzeile)', () => {
    const e = historicalEvent('1973 Oil Crisis');
    assert.equal(hedgeLockMonth([e], e.startMonth - 1), undefined);
    assert.equal(hedgeLockMonth([e], e.startMonth), e.startMonth - 1);
    assert.equal(hedgeLockMonth([e], e.startMonth + e.months - 1), e.startMonth - 1);
    assert.equal(hedgeLockMonth([e], e.startMonth + e.months), undefined);
    assert.equal(hedgedFuelTable([e], e.startMonth + 3), fuelTable(hedgeLockMonth([e], e.startMonth + 3) ?? -1));
  });

  it('8.5: Ereignis ohne Antwort ist ein Fehler', () => {
    assert.throws(() => crisisResponsePrice(historicalEvent('SARS Outbreak'), { fuelBill: 1, revenue: 1 }));
    assert.throws(() => historicalEvent('Unbekannt'));
  });
});

describe('Abschnitt 8.6 Betriebsstörungen und Vogelschläge', () => {
  const chance = (airframe: number, ageYears: number, hasHangar = false) =>
    defectChance({ airframeCondition: airframe, builtMonth: 0, month: ageYears * 12, hasHangar, defectFactor: 1 });

  it('8.17: Defekt-Chance je Flugzeug und Monat', () => {
    near(chance(100, 0), 0.0033, 0.00005);
    near(chance(90, 2), 0.0067, 0.00005);
    near(chance(70, 10), 0.0147, 0.00005);
    near(chance(50, 15), 0.0217, 0.00005);
    near(chance(20, 25), 0.033, 0.00005);
  });

  it('8.6: bessere Zelle oder jüngeres Flugzeug → nie höhere Chance; Hangar halbiert sie', () => {
    for (let a = 0; a <= 100; a += 10) {
      for (let y = 0; y <= 30; y += 5) {
        assert.ok(chance(Math.min(100, a + 10), y) <= chance(a, y));
        assert.ok(chance(a, Math.max(0, y - 5)) <= chance(a, y));
        near(chance(a, y, true), chance(a, y) / 2, 1e-15);
      }
    }
  });

  it('8.6: ein Flughafen-Streik streicht bei allen Gesellschaften denselben Anteil', () => {
    const always = { id: 'FRA', hasDepartures: true, badLuckCap: false };
    let roll;
    for (let seed = 0; ; seed++) {
      roll = rollDisruptions({ seed, month: m(1990, 6), capOpen: true, planes: [], airports: [always], capRegions: [] });
      if (roll.disruptions.length > 0) break;
    }
    const strike = roll.disruptions[0];
    assert.equal(strike.kind, 'airportStrike');
    const route = (planeId: string): DisruptedRoute => ({ planeId, airportIds: ['FRA', 'MAD'], regions: ['EU', 'EU'] });
    const player = disruptionShares(routeCauses(route('p1'), roll.disruptions));
    const rival = disruptionShares(routeCauses(route('r1'), roll.disruptions));
    assert.deepEqual(player, rival);
    near(player.cancelledShare, AIRPORT_STRIKE_CANCEL_SHARE, 1e-12);
  });

  it('8.6: Winterwetter nur Dezember bis Februar', () => {
    assert.deepEqual(
      Array.from({ length: 12 }, (_, i) => isWinterMonth(m(1990, i + 1))),
      [true, true, false, false, false, false, false, false, false, false, false, true],
    );
    for (let seed = 0; seed < 300; seed++) {
      const roll = rollDisruptions({ seed, month: m(1990, 7), capOpen: true, planes: [], airports: [], capRegions: [] });
      assert.equal(roll.disruptions.length, 0);
    }
  });

  it('8.6: Defekt je Flugzeug: ein Flugzeug mit drei Strecken bekommt einen Wurf, alle drei Strecken verlieren denselben Anteil', () => {
    const roll = rollDisruptions({
      seed: 1,
      month: m(1990, 6),
      capOpen: true,
      planes: [plane('x', { defectFactor: 1e6 })],
      airports: [],
      capRegions: [],
    });
    assert.equal(roll.disruptions.length, 1);
    for (const to of ['MAD', 'LHR', 'CDG']) {
      const s = disruptionShares(routeCauses({ planeId: 'x', airportIds: ['FRA', to], regions: ['EU', 'EU'] }, roll.disruptions));
      assert.equal(s.cancelledShare, DEFECT_CANCEL_SHARE);
    }
  });

  it('8.6: Vogelschlag: Anteil des Neupreises, Wurf fest je Monat und Flugzeug, etwa 0,2 %', () => {
    near(birdStrikeCost(40e6, m(2010)), 0.005 * newPrice(40e6, m(2010)), 1e-6);
    assert.equal(rollBirdStrike(3, 100, 'a'), rollBirdStrike(3, 100, 'a'));
    let hits = 0;
    const N = 50_000;
    for (let i = 0; i < N; i++) if (rollBirdStrike(3, i % 700, `p${i}`)) hits++;
    near(hits / N, BIRD_STRIKE_CHANCE, 0.0008);
  });

  it('8.6: Fragen nur ab 25 % mit Erlösverlust, höchstens 3, größter Verlust zuerst', () => {
    const ids = disruptionQuestions([
      { id: 'w', share: WINTER_CANCEL_SHARE, revenueLoss: 9e9 },
      { id: 'a', share: 0.5, revenueLoss: 10 },
      { id: 'b', share: 0.6, revenueLoss: 30 },
      { id: 'c', share: 0.5, revenueLoss: 0 },
      { id: 'd', share: 0.5, revenueLoss: 20 },
      { id: 'e', share: 0.5, revenueLoss: 5 },
    ]);
    assert.deepEqual(ids, ['b', 'd', 'a']);
    assert.equal(ids.length, MAX_DISRUPTION_QUESTIONS);
  });
});

describe('Abschnitt 8.7 Personal', () => {
  it('8.7: Lohn 100 % ohne Arbeitsmarkt, Serie ≤ 6, kein Streik, keine Forschung → Ziel 50', () => {
    const month = m(1962);
    assert.equal(labourMarketPremium(month), 0);
    assert.equal(moraleTarget({ salaryPct: 100, month, moralePoints: 0, profitStreak: 6 }), 50);
  });

  it('8.7: Arbeitsmarkt, Lohn, Serie, Streik und Forschung im Ziel; Schritt ein Fünftel', () => {
    const month = m(2015);
    assert.equal(labourMarketPremium(month), 9);
    near(moraleTarget({ salaryPct: 110, month, moralePoints: 5, profitStreak: 7, strike: { month: month - 6 } }), 50 + 5 + 1.5 + 5 - 10, 1e-12);
    assert.equal(moraleTarget({ salaryPct: 130, month: m(1962), moralePoints: 20, profitStreak: 10 }), 100);
    near(nextMorale(40, 60), 44, 1e-12);
  });

  it('8.7: Moral ≥ 35 → kein Streik', () => {
    assert.equal(strikeChance(STRIKE_MORALE_THRESHOLD), 0);
    for (let seed = 0; seed < 500; seed++) assert.equal(rollStaffStrike(seed, 100, 35, true), false);
    near(strikeChance(25), 0.06, 1e-12);
  });

  it('8.7: Antworten: „Raise pay“ halbiert, „Sit it out“ und keine Antwort streichen alles; Lohn-Untergrenze', () => {
    assert.equal(strikeCancelShare({ month: 10, answer: 'raisePay', agreedPct: 110 }, 10), 0.5);
    assert.equal(strikeCancelShare({ month: 10, answer: 'sitOut' }, 10), 1);
    assert.equal(strikeCancelShare({ month: 10 }, 10), 1);
    assert.equal(strikeCancelShare({ month: 10 }, 11), 0);
    assert.equal(settledSalary(100), 110);
    assert.equal(settledSalary(125), 130);
    const strike = { month: 10, answer: 'raisePay' as const, agreedPct: 110 };
    assert.equal(salaryFloor(strike, 16), 110);
    assert.equal(salaryFloor(strike, 17), SALARY_PCT_MIN);
    assert.equal(setSalary(90, strike, 12), 110);
    assert.equal(setSalary(200, undefined, 12), 130);
  });

  it('8.7: ein Streik ändert den Ruf nur über cancelledShare (kein eigener Abzug, E38)', () => {
    const share = strikeCancelShare({ month: 10 }, 10);
    const routes = [{ seats: 180, plannedDepartures: 60, cancelledShare: disruptionShares(routeCauses(
      { planeId: 'p', airportIds: ['A', 'B'], regions: ['EU', 'EU'] }, [], share)).cancelledShare }];
    const cs = companyCancelledShare(routes);
    assert.equal(cs, 1);
    const withStrike = reputationTargetParts({ airlineSatisfaction: 100, cancelledShare: cs });
    const without = reputationTargetParts({ airlineSatisfaction: 100 });
    assert.equal(withStrike.satisfactionReputation, without.satisfactionReputation);
    assert.equal(withStrike.advertisingReputation, without.advertisingReputation);
    assert.equal(withStrike.cancellationPenalty, cancellationPenalty(cs));
    assert.equal(without.cancellationPenalty, 0);
  });
});

describe('Abschnitt 8.8 Pech-Deckel', () => {
  const stress = (seed: number, month: number, previousBadLuck = false, randomEvents: readonly WorldEvent[] = []): TransitionRollInput => ({
    seed,
    month,
    randomEvents,
    previousBadLuck,
    planes: [
      ...Array.from({ length: 30 }, (_, i) => plane(`p${String(i).padStart(2, '0')}`, { airframeCondition: 20, builtMonth: 0, badLuckCap: true })),
      plane('r1', { defectFactor: 1e6 }),
    ],
    airports: Array.from({ length: 30 }, (_, i) => ({ id: `A${i}`, hasDepartures: true, badLuckCap: true })),
    capRegions: ['EU', 'NA', 'AS'],
    morale: 0,
  });

  it('8.8: in einem Übergang höchstens ein Pech aus Zufall für den Spieler', () => {
    let withBadLuck = 0;
    for (let seed = 0; seed < 1500; seed++) {
      const month = m(1990, (seed % 12) + 1);
      const r = rollTransition(stress(seed, month));
      const playerTargets = new Set([...Array.from({ length: 30 }, (_, i) => `p${String(i).padStart(2, '0')}`), ...Array.from({ length: 30 }, (_, i) => `A${i}`), 'EU', 'NA', 'AS']);
      const count =
        (r.randomEvent && isBadLuckEvent(r.randomEvent) ? 1 : 0) +
        r.disruptions.filter((d) => playerTargets.has(d.target)).length +
        (r.staffStrike ? 1 : 0);
      assert.ok(count <= 1, `seed ${seed}: ${count}`);
      if (count === 1) withBadLuck++;
      assert.ok(r.disruptions.some((d) => d.target === 'r1'), 'KI-Defekte werden immer gewürfelt');
    }
    assert.ok(withBadLuck > 500, 'der Test trifft Pech oft genug');
  });

  it('8.8: nach einem Monat mit Störung oder Streik folgt ein Monat ohne neues Zufalls-Pech', () => {
    for (let seed = 0; seed < 300; seed++) {
      const r = rollTransition(stress(seed, m(1990, 1), true));
      assert.equal(r.capOpen, false);
      assert.equal(r.badLuck, false);
      assert.equal(r.staffStrike, false);
      assert.ok(!r.randomEvent || !isBadLuckEvent(r.randomEvent));
      assert.deepEqual(r.disruptions.map((d) => d.target), ['r1']);
    }
  });

  it('8.8: ein Zufalls-Pech-Ereignis beansprucht Dauer × 2; Glück-Ereignisse nie', () => {
    const slump: WorldEvent = { title: 'Economic Slump', startMonth: 100, months: 3, demandMultiplier: 0.87 };
    assert.equal(claimedByRandomEvent([slump], 99), false);
    assert.equal(claimedByRandomEvent([slump], 100), true);
    assert.equal(claimedByRandomEvent([slump], 105), true);
    assert.equal(claimedByRandomEvent([slump], 106), false);
    assert.equal(claimedByRandomEvent([{ ...slump, demandMultiplier: 1.1 }], 101), false);
    assert.equal(badLuckCapOpen([slump], 104, false), false);
    assert.equal(badLuckCapOpen([slump], 106, false), true);
  });

  it('8.8: geschichtliche Ereignisse wirken auch bei geschlossenem Deckel', () => {
    const month = historicalEvent('Global Pandemic').startMonth;
    const slump: WorldEvent = { title: 'Economic Slump', startMonth: month, months: 3, demandMultiplier: 0.87 };
    assert.equal(badLuckCapOpen([slump], month, true), false);
    assert.ok(activeWorldEvents(month, [slump]).some((e) => e.title === 'Global Pandemic'));
  });
});

describe('Abschnitt 8.9 Gestrichene und gecharterte Flüge', () => {
  it('8.9: ohne Störung cancelledShare = 0 und alles fliegt', () => {
    const s = disruptionShares([]);
    assert.deepEqual(s, { affectedShare: 0, cancelledShare: 0, charteredShare: 0, flownShare: 1 });
    assert.equal(companyCancelledShare([]), 0);
  });

  it('8.9: Anteile mehrerer Ursachen; eine nicht gecharterte Ursache streicht auch gecharterte Flüge', () => {
    const s = disruptionShares([
      { share: 0.5, chartered: true },
      { share: 0.6, chartered: false },
    ]);
    near(s.affectedShare, 0.8, 1e-12);
    near(s.cancelledShare, 0.6, 1e-12);
    near(s.charteredShare, 0.2, 1e-12);
    near(s.flownShare, 0.2, 1e-12);
  });

  it('8.9: Charter für alle Ursachen → cancelledShare = 0, Ruf-Abzug 0, Sitze wie ohne Störung', () => {
    const s = disruptionShares([
      { share: 0.5, chartered: true },
      { share: 0.6, chartered: true },
    ]);
    assert.equal(s.cancelledShare, 0);
    assert.equal(cancellationPenalty(companyCancelledShare([{ seats: 180, plannedDepartures: 50, cancelledShare: s.cancelledShare }])), 0);
    assert.equal(offeredSeats(180, s.cancelledShare), 180);
  });

  it('8.9: Kosten mit Charter = ohne Störung − eigene Flugkosten der gecharterten Flüge + Gebühr', () => {
    const opsWeekly = 136_122;
    const legs = 14;
    const s = disruptionShares([{ share: 0.5, chartered: true }]);
    const ownOps = opsWeekly * (flownLegs(legs, s.flownShare) / legs) * WEEKS_PER_MONTH;
    const fee = charterCost([{ flightOpsWeekly: opsWeekly, plannedLegsPerWeek: legs, charteredShare: s.charteredShare }]);
    const undisturbed = opsWeekly * WEEKS_PER_MONTH;
    near(ownOps + fee, undisturbed - opsWeekly * s.charteredShare * WEEKS_PER_MONTH + CHARTER_MARKUP * opsWeekly * s.charteredShare * WEEKS_PER_MONTH, 1e-6);
  });

  it('8.9: ein halber Flugplan bringt höchstens die Hälfte weniger Sitze (heute −77 %, W5)', () => {
    assert.equal(offeredSeats(180, 0.5), 90);
  });

  it('8.9: cancelledShare der Gesellschaft nach Sitzen × Abflügen', () => {
    near(
      companyCancelledShare([
        { seats: 100, plannedDepartures: 10, cancelledShare: 0.5 },
        { seats: 300, plannedDepartures: 10, cancelledShare: 0 },
      ]),
      0.125,
      1e-12,
    );
  });

  it('8.17: Charter oder streichen, A320ceo FRA–MAD 1990: Gebühr 14 584 $, Vorteil +7 815 $ je Flug', () => {
    const fee = charterFee(9_723 * 14, 14);
    near(fee, 14_584.5, 1e-6);
    near(charterAdvantage(25_100, 2_701, 14_584), 7_815, 1e-9);
    assert.ok(charterAdvantage(25_100, 2_701, fee) > 0);
    assert.equal(charterFee(1000, 0), 0);
  });

  it('8.9: KI streicht immer (kein Charter): Störungen ohne Antwort zählen als gestrichen', () => {
    assert.equal(RIVAL_INPUTS.charter, false);
    const causes = routeCauses({ planeId: 'r', airportIds: ['A', 'B'], regions: ['EU', 'NA'] }, [
      { month: 0, kind: 'weather', target: 'EU', share: WINTER_CANCEL_SHARE },
    ]);
    assert.deepEqual(causes, [{ share: WINTER_CANCEL_SHARE, chartered: false }]);
  });
});

describe('Abschnitt 8.10 Verschleiß', () => {
  it('8.10: ein ganz bestreiktes Flugzeug verschleißt nur WEAR_BASE', () => {
    const hours = flownHours([{ blockMinutesPerWeek: 4140, flownShare: 0 }]);
    assert.equal(hours, 0);
    assert.deepEqual(monthlyWear(hours), { cabin: WEAR_BASE, airframe: WEAR_BASE });
  });

  it('8.10: mehr Stunden → nie weniger Verschleiß; Zustand nie unter 0', () => {
    let last = monthlyWear(0);
    for (let h = 10; h <= 2000; h += 10) {
      const w = monthlyWear(h);
      assert.ok(w.cabin >= last.cabin && w.airframe >= last.airframe);
      last = w;
    }
    assert.equal(wornCondition(0.3, 0.5, 'cabinCondition'), 0);
    assert.equal(wornCondition(50, 0.5, 'airframeCondition'), 49.5);
  });

  it('8.17: 69 Blockstunden je Woche (300 h je Monat): Kabine 5,5, Zelle 3,9 Punkte je Jahr', () => {
    const hours = flownHours([{ blockMinutesPerWeek: 69 * 60, flownShare: 1 }]);
    near(hours, 300, 0.1);
    const w = monthlyWear(hours);
    near(w.cabin * 12, 5.5, 0.05);
    near(w.airframe * 12, 3.9, 0.05);
  });

  it('8.10: Forschung senkt den Verschleiß über wearFactor; KI ohne Forschung 1', () => {
    assert.equal(researchEffects(RIVAL_INPUTS.completedResearch).wearFactor, 1);
    const w = monthlyWear(300, 0.5);
    near(w.cabin, monthlyWear(300).cabin / 2, 1e-12);
  });
});
