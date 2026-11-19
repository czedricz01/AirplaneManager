/**
 * Tests des Balance-Skripts (Paket 3.9a): Format, Bericht, Beispiel-Welten. Die Balance-Regeln selbst prüft das Skript
 * (`npm run balance`); hier nur, dass es richtig rechnet und gleich bleibt.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CABIN_CLASSES } from '../model/constants';
import { quantile, satisfactionSection, timeAndMoney } from './market';
import { num, pct, renderMarkdown, verdictCounts, type Section } from './report';
import { bestFareRatios, caseMarket, priceDuel, ROUTE_CASES, routeSections, runCase } from './routes';
import { marketState, routeOf, runMarket, sampleMonth, seatsTotal } from './world';

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
