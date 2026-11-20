/**
 * Tests des Balance-Skripts (Pakete 3.9a–3.9c): Format, Bericht, Beispiel-Welten, Langläufe. Die Balance-Regeln selbst prüft das Skript
 * (`npm run balance`); hier nur, dass es richtig rechnet und gleich bleibt.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CABIN_CLASSES } from '../model/constants';
import { quantile, satisfactionSection, timeAndMoney } from './market';
import { num, pct, renderMarkdown, verdictCounts, type Section } from './report';
import { bestFareRatios, caseMarket, priceDuel, ROUTE_CASES, routeSections, runCase } from './routes';
import { marketState, routeOf, runMarket, sampleMonth, seatsTotal } from './world';
import { allModelAirports, founderHub, lengthBand, longRunStart, PERSONALITY_ORDER, runLong } from './longRun';
import { competitionSections, spreadFactor, yearsToLiquidation } from './competition';
import { careerSection, equipmentResults, goalCase, monthsToRecover, RANK_CASES, reputationAfter, runRankCase, satisfactionForReputation } from './career';
import { eventSection, hedgeCases, MAX_RESALE_BONUS, oilShockCases, recoveryCase, spreadCase } from './events';
import { satisfactionReputation } from '../model/progress';
import { DEALER_SPREAD_BUY, DEALER_SPREAD_SELL, GOAL_MISS_PENALTY_SHARE, HEDGE_PRICE_SHARE } from '../model/constants';

const A330 = ROUTE_CASES.find((c) => c.label === 'A330-300 FRA–JFK 1995');

describe('Balance-Skript: Format und Bericht', () => {
  it('num: Dezimalkomma, Tausender, Minuszeichen', () => {
    assert.equal(num(1234567.891, 2), '1 234 567,89');
    assert.equal(num(-0.5, 1), '−0,5');
    assert.equal(num(-0.0001, 1), '0,0');
    assert.equal(pct(0.256), '26 %');
  });

  it('quantile: Median und Ränder einer sortierten Liste', () => {
    assert.equal(quantile([1, 2, 3, 4, 5], 0.5), 3);
    assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
    assert.equal(quantile([1, 2, 3, 4], 0), 1);
    assert.equal(quantile([1, 2, 3, 4], 1), 4);
  });

  it('renderMarkdown: Übersicht mit allen Prüfregeln, Urteile gezählt', () => {
    const sections: Section[] = [
      {
        title: 'A',
        checks: [
          { id: 'X1', spec: '1', rule: 'r | mit Strich', value: '1', verdict: 'ok' },
          { id: 'X2', spec: '2', rule: 'r', value: '2', verdict: 'abweichung' },
        ],
        tables: [{ title: 'T', header: ['a', 'b'], rows: [['1', '2']] }],
      },
    ];
    const md = renderMarkdown('Titel', 'Text', sections);
    assert.deepEqual(verdictCounts(sections), { ok: 1, abweichung: 1, info: 0 });
    assert.match(md, /\| X1 \| 1 \| r \\\| mit Strich \| 1 \| ok \|/);
    assert.match(md, /\*\*Abweichung\*\*/);
    assert.match(md, /### T/);
  });

  it('Abschnitte 1 und 2: jede Prüfregel hat einen Wert, Kennungen eindeutig', () => {
    const sections = [timeAndMoney(), satisfactionSection()];
    const ids = sections.flatMap((s) => s.checks.map((c) => c.id));
    assert.equal(new Set(ids).size, ids.length);
    for (const s of sections) for (const c of s.checks) assert.ok(c.value.length > 0 && !c.value.includes('NaN'), `${c.id}: ${c.value}`);
  });
});

describe('Balance-Skript: Beispiel-Welten', () => {
  it('demandScale wirkt als weltweites Ereignis nur im Beispiel-Spielstand', () => {
    assert.ok(A330);
    const base = caseMarket(A330);
    assert.equal(marketState(base).randomEvents.length, 0);
    const half = { ...base, demandScale: 0.5 };
    assert.equal(marketState(half).randomEvents[0].demandMultiplier, 0.5);
    // Viele Abflüge, damit die Sitze nicht begrenzen: halbe Marktgröße → weniger Fluggäste.
    const many = { ...base, offers: base.offers.map((o) => ({ ...o, departures: 140 })) };
    const full = routeOf(runMarket(many), 'a');
    const small = routeOf(runMarket({ ...many, demandScale: 0.5 }), 'a');
    assert.ok(seatsTotal(small.passengers) < seatsTotal(full.passengers));
  });

  it('runCase: bester Preis ist mindestens so gewinnbringend wie der Marktpreis (R2: Rechnung = monthOperations)', () => {
    assert.ok(A330);
    const r = runCase(A330);
    const atMarket = routeOf(runMarket(caseMarket(A330)), 'a');
    assert.ok(r.route.result >= atMarket.result - 1e-6);
    assert.ok(r.load > 0 && r.load <= 1 + 1e-9);
    for (const c of CABIN_CLASSES) if (r.route.offeredSeats[c] > 0) assert.ok((r.best[c] ?? 0) > 0);
  });

  it('bestFareRatios: hängt nur vom Markt ab, nicht von der Reihenfolge der Aufrufe', () => {
    assert.ok(A330);
    const m = caseMarket(A330);
    assert.deepEqual(bestFareRatios(m, 'a'), bestFareRatios(m, 'a'));
  });

  it('priceDuel: zwei gleiche Gesellschaften mit knappen Sitzen enden in einem festen Punkt über der Gewinnschwelle', () => {
    const d = priceDuel({ from: 'FRA', to: 'MAD', month: sampleMonth(1990) }, { typeId: 'a320ceo', personality: 'flag', departures: 14 }, 6);
    assert.ok(d.converged);
    assert.ok((d.final.economy ?? 0) > d.breakEvenFull);
  });

  it('routeSections: Prüfregeln B4/B5 mit Werten, ohne NaN', () => {
    assert.ok(A330);
    const short = ROUTE_CASES.find((c) => c.short);
    assert.ok(short);
    const r = runCase(A330);
    const sections = routeSections([r, runCase(short)], [], [[r]]);
    assert.equal(sections.length, 2);
    for (const s of sections) for (const c of s.checks) assert.ok(!c.value.includes('NaN'), `${c.id}: ${c.value}`);
  });
});

describe('Balance-Skript: Langläufe (3.9b)', () => {
  // Kleine Welt: die Drehkreuze von Lauf 0 und einige große Flughäfen, 2 Jahre ab 1990.
  const ids = ['JFK', 'FRA', 'CDG', 'HND', 'ATL', 'LHR', 'ORD', 'MAD', 'FCO', 'AMS', 'MUC', 'BOS', 'MIA', 'LAX', 'ICN', 'HKG'];
  const all = allModelAirports();
  const airports = Object.fromEntries(ids.map((id) => [id, all[id]]));
  const settings = { run: 0, startYear: 1990, years: 2, strength: 'easy' as const, subsidy: true, transferEveryYears: 1 };
  const withSubsidy = runLong(settings, undefined, airports);
  const without = runLong({ ...settings, subsidy: false }, undefined, airports);

  it('jede Persönlichkeit gründet eine KI an ihrem Drehkreuz; jedes Drehkreuz einmal über 10 Läufe', () => {
    const start = longRunStart(settings, airports);
    assert.deepEqual(
      start.companies.map((c) => c.hubs?.[0]),
      PERSONALITY_ORDER.map((_, k) => founderHub(0, k)),
    );
    for (let k = 0; k < PERSONALITY_ORDER.length; k++) {
      assert.equal(new Set(Array.from({ length: 10 }, (_, run) => founderHub(run, k))).size, 10);
    }
  });

  it('runLong: Jahre mit Gründern, endlichen Werten und Umsteiger-Messung', () => {
    assert.equal(withSubsidy.years.length, 2);
    for (const y of withSubsidy.years) {
      assert.equal(y.companies.filter((c) => c.founder).length, 5);
      for (const c of y.companies) assert.ok(Number.isFinite(c.value1960) && Number.isFinite(c.result1960), c.id);
      assert.ok(y.transfers !== undefined);
    }
    assert.ok(withSubsidy.years[1].companies.some((c) => c.routes > 0));
  });

  it('runLong: Auslastung und Marge je Längen-Band zählen jede Strecke genau einmal (E67)', () => {
    for (const y of withSubsidy.years) {
      const bands = y.byLength;
      assert.ok(bands !== undefined);
      assert.equal(bands.short.load.n + bands.medium.load.n + bands.long.load.n, y.loadFactor.n);
    }
    assert.equal(lengthBand(999), 'short');
    assert.equal(lengthBand(1000), 'medium');
    assert.equal(lengthBand(3500), 'long');
  });

  it('ohne Zuschuss: kein Dollar Zuschuss; mit Zuschuss: Zuschuss im Ergebnis', () => {
    for (const y of without.years) for (const c of y.companies) assert.equal(c.subsidy1960, 0);
    assert.ok(withSubsidy.years[0].companies.every((c) => c.subsidy1960 > 0));
  });

  it('competitionSections: Prüfregeln ohne NaN, Kennungen eindeutig', () => {
    const sections = competitionSections([withSubsidy, without, runLong({ ...settings, strength: 'hard', years: 1 }, undefined, airports)]);
    const ids2 = sections.flatMap((s) => s.checks.map((c) => c.id));
    assert.equal(new Set(ids2).size, ids2.length);
    for (const s of sections) for (const c of s.checks) assert.ok(!c.value.includes('NaN'), `${c.id}: ${c.value}`);
  });

  it('spreadFactor und yearsToLiquidation', () => {
    const by = { flag: 2, lcc: 1, expansionist: 1, optimizer: 1, boutique: 0.5 };
    assert.equal(spreadFactor({ all: 1, by }), 2);
    assert.equal(spreadFactor({ all: 1, by: { ...by, boutique: 0 } }), Number.POSITIVE_INFINITY);
    assert.equal(yearsToLiquidation({ ...withSubsidy, founderLiquidated: { lcc: 2003.5 } }, 'lcc'), 13.5);
    assert.equal(yearsToLiquidation(withSubsidy, 'flag'), Number.POSITIVE_INFINITY);
  });
});

describe('Balance-Skript: Abschnitte 6 und 8 (3.9c)', () => {
  it('satisfactionForReputation kehrt satisfactionReputation um', () => {
    for (const s of [0, 40, 100, 118, 160]) assert.ok(Math.abs(satisfactionForReputation(satisfactionReputation(s)) - s) < 1e-9);
  });

  it('monthsToRecover und reputationAfter folgen REPUTATION_STEP', () => {
    assert.equal(monthsToRecover(0.5), 0);
    assert.equal(monthsToRecover(7.5), 13);
    // Gleiches Ziel: der Abstand schrumpft je Monat um 15 %.
    const after = reputationAfter(50, 2, { airlineSatisfaction: 120 });
    const target = satisfactionReputation(120);
    assert.ok(Math.abs(target - after - (target - 50) * 0.85 ** 2) < 1e-9);
  });

  it('goalCase: hohes Ziel lohnt ab (R_sicher / R_hoch + k) / (1 + k)', () => {
    const g = goalCase('x', 100e6, 500e6, sampleMonth(1990));
    const k = GOAL_MISS_PENALTY_SHARE;
    assert.ok(Math.abs(g.stretchBreakEven - (g.reward.steady / g.reward.stretch + k) / (1 + k)) < 1e-12);
    assert.ok(g.reward.stretch >= g.reward.steady);
    // Verlustjahr: Bezugsgröße aus dem Erlös.
    assert.equal(goalCase('y', -10e6, 500e6, sampleMonth(1990)).base, 25e6);
  });

  it('runRankCase: Monatsergebnis = Fluggäste der Schwelle × Ergebnis je Fluggast', () => {
    const r = runRankCase(RANK_CASES[0]);
    assert.ok(r.projects.length === 1 && r.projects[0].id === 'class-regional');
    assert.ok(Math.abs(r.monthlyResult - 8000 * r.resultPerPax) < 1e-6);
    assert.ok(r.monthsToPay > 0 && Number.isFinite(r.monthsToPay));
  });

  it('hedgeCases: drei Ölkrisen, Preis = Anteil × Dauer', () => {
    const h = hedgeCases();
    assert.equal(h.length, 3);
    for (const c of h) {
      assert.ok(Math.abs(c.price - HEDGE_PRICE_SHARE * c.months) < 1e-12);
      assert.ok(c.meanRatio > 1);
    }
  });

  it('spreadCase: Kauf und sofortiger Verkauf bringt höchstens (1 − Spanne) × (1 + Forschung) / (1 + Aufschlag) zurück', () => {
    const bound = ((1 - DEALER_SPREAD_SELL) * (1 + MAX_RESALE_BONUS)) / (1 + DEALER_SPREAD_BUY);
    for (const age of [0, 10]) assert.ok(spreadCase('a320ceo', sampleMonth(1990), age).roundTrip <= bound + 1e-12);
  });

  it('recoveryCase: Antwort bringt Fluggäste, Preis nach 8.5', () => {
    const c = recoveryCase('Aviation Downturn', 0.25);
    assert.ok(c.paxRatio >= 1);
    assert.ok(c.gainedResult > 0 && c.price > 0);
  });

  it('oilShockCases: 39 Monate, jede Ausstattung mit endlichem Ruf', () => {
    const o = oilShockCases();
    assert.equal(o.months, 39);
    for (const c of o.cases) assert.ok(Number.isFinite(c.reputationAtDeadline) && c.reputationAtDeadline > 0);
  });

  it('careerSection und eventSection: Prüfregeln mit Werten, ohne NaN, Kennungen eindeutig', () => {
    assert.ok(A330);
    const r = runCase(A330);
    const sections = [
      careerSection(equipmentResults().slice(0, 5), [runRankCase(RANK_CASES[0])]),
      eventSection({ results: [r], smallMarket: [] }, [recoveryCase('Aviation Downturn', 1)]),
    ];
    const ids = sections.flatMap((s) => s.checks.map((c) => c.id));
    assert.equal(new Set(ids).size, ids.length);
    for (const s of sections) for (const c of s.checks) assert.ok(c.value.length > 0 && !c.value.includes('NaN'), `${c.id}: ${c.value}`);
  });
});
