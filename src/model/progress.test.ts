/**
 * Regeltests zu SPEZIFIKATION 6.1–6.8 (Ruf, Rang, Flugzeugklassen) und den Ruf-Teilen des Beispiels 6.14.
 * Paket 3.6a.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList } from '../data/aircraft';
import {
  ADVERTISING_REPUTATION_MAX,
  CLASS_RESEARCH,
  MAX_RANK,
  RANK_UNLOCKS,
  RANKS,
  REPUTATION_STEP,
  SIZE_CLASSES,
  START_REPUTATION,
  WEEKS_PER_MONTH,
  type RankRequirement,
  type SizeClass,
} from './constants';
import { reputationFactor } from './marketSplit';
import {
  advertisingReputation,
  averageRankStats,
  cancellationPenalty,
  cancelledShare,
  classResearchChainMonths,
  effectiveRank,
  hasUnlock,
  hubAllowance,
  isAirportOpen,
  nextRank,
  openSizeClasses,
  qualifyingRank,
  rankDef,
  rankProgress,
  rankStats,
  reputationBand,
  reputationChange,
  reputationTarget,
  researchSlots,
  satisfactionReputation,
  sizeClassOf,
  startingClassResearch,
  type RankStats,
  type ReputationInput,
} from './progress';

const close = (actual: number, expected: number, tolerance: number, what = '') =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what} ${actual} ≠ ${expected} ± ${tolerance}`);

/** Ruf nach `months` Monaten mit gleichbleibenden Eingaben. */
function reputationAfter(start: number, input: ReputationInput, months: number): number {
  let reputation = start;
  for (let m = 0; m < months; m++) reputation = reputationChange(reputation, input).reputation;
  return reputation;
}

const satisfactions = [0, 20, 50, 80, 99, 100, 101, 120, 145, 159, 160];

describe('Abschnitt 6.1 Ruf aus Satisfaction', () => {
  it('6.1: Satisfaction 100 → 50, 160 → 100, 0 → 0', () => {
    assert.equal(satisfactionReputation(100), 50);
    assert.equal(satisfactionReputation(160), 100);
    assert.equal(satisfactionReputation(0), 0);
  });

  it('6.1: steigt mit der Satisfaction, Wert in 0 … 100', () => {
    for (let i = 1; i < satisfactions.length; i++) {
      assert.ok(satisfactionReputation(satisfactions[i]) > satisfactionReputation(satisfactions[i - 1]));
    }
    for (const s of satisfactions) {
      const r = satisfactionReputation(s);
      assert.ok(r >= 0 && r <= 100);
    }
  });

  it('6.1: stetig bei 100', () => {
    close(satisfactionReputation(100 - 1e-9), 50, 1e-6);
    close(satisfactionReputation(100 + 1e-9), 50, 1e-6);
  });
});

describe('Abschnitt 6.2 Gestrichene Flüge', () => {
  it('6.2: keine gestrichenen Sitze → kein Abzug; ohne geplante Sitze 0', () => {
    assert.equal(cancellationPenalty(cancelledShare(0, 10_000)), 0);
    assert.equal(cancelledShare(0, 0), 0);
  });

  it('6.2: 1 % gestrichene Sitze → −1 Punkt; mehr gestrichen → nie kleinerer Abzug', () => {
    close(cancellationPenalty(cancelledShare(100, 10_000)), 1, 1e-12);
    let last = -1;
    for (const cancelled of [0, 10, 100, 1_000, 10_000]) {
      const penalty = cancellationPenalty(cancelledShare(cancelled, 10_000));
      assert.ok(penalty >= last);
      last = penalty;
    }
  });

  it('6.2: mehr gestrichene als geplante Sitze ist ein Fehler', () => {
    assert.throws(() => cancelledShare(11, 10));
    assert.throws(() => cancelledShare(-1, 10));
  });

  it('6.2: Charter (vom Aufrufer nicht als gestrichen gezählt) senkt das Ziel nicht', () => {
    assert.equal(reputationTarget({ airlineSatisfaction: 100, cancelledShare: cancelledShare(0, 5_000) }), 50);
  });
});

describe('Abschnitt 6.3 Werbe-Beitrag', () => {
  it('6.3: ohne Kampagne 0; Stufen 0,5 / 1 / 2', () => {
    assert.equal(advertisingReputation([]), 0);
    assert.equal(advertisingReputation(['local']), 0.5);
    assert.equal(advertisingReputation(['national']), 1);
    assert.equal(advertisingReputation(['global']), 2);
  });

  it('6.3: nie über ADVERTISING_REPUTATION_MAX', () => {
    assert.equal(advertisingReputation(['global', 'global', 'national']), ADVERTISING_REPUTATION_MAX);
  });

  it('6.3: eine Kampagne hebt den Ruf im Gleichgewicht um höchstens ihren Beitrag', () => {
    const settled = reputationAfter(50, { airlineSatisfaction: 100, campaigns: ['global'] }, 600);
    assert.ok(settled <= 52 + 1e-9);
    close(settled, 52, 1e-6);
  });
});

describe('Abschnitt 6.4 Ruf-Ziel', () => {
  it('6.4: Satisfaction 100, nichts gestrichen, keine Werbung → genau 50', () => {
    assert.equal(reputationTarget({ airlineSatisfaction: 100 }), 50);
  });

  it('6.4: mehr Satisfaction → nie niedrigeres Ziel; mehr gestrichen → nie höheres Ziel', () => {
    for (let i = 1; i < satisfactions.length; i++) {
      assert.ok(
        reputationTarget({ airlineSatisfaction: satisfactions[i], cancelledShare: 0.05 }) >=
          reputationTarget({ airlineSatisfaction: satisfactions[i - 1], cancelledShare: 0.05 }),
      );
    }
    let last = Number.POSITIVE_INFINITY;
    for (const share of [0, 0.01, 0.1, 0.5, 1]) {
      const target = reputationTarget({ airlineSatisfaction: 120, cancelledShare: share });
      assert.ok(target <= last);
      last = target;
    }
  });

  it('6.4: Ziel bleibt in 0 … 100', () => {
    assert.equal(reputationTarget({ airlineSatisfaction: 0, cancelledShare: 1 }), 0);
    assert.equal(reputationTarget({ airlineSatisfaction: 160, campaigns: ['global'] }), 100);
  });
});

describe('Abschnitt 6.5 Ruf-Änderung', () => {
  const inputs: ReputationInput[] = [
    { airlineSatisfaction: 120 },
    { airlineSatisfaction: 90, cancelledShare: 0.03, campaigns: ['national'] },
    { airlineSatisfaction: 160, campaigns: ['global', 'global'] },
    { airlineSatisfaction: 5, cancelledShare: 0.4 },
  ];

  it('6.5: Summe der Ursachen = Änderung (auch mit Kappung)', () => {
    for (const start of [0, 30, 50, 85, 100]) {
      for (const input of inputs) {
        const change = reputationChange(start, input);
        const sum = change.causes.reduce((total, c) => total + c.amount, 0);
        close(sum, change.reputation - start, 1e-12);
      }
    }
  });

  it('6.5: Ursache „limit“ nur, wenn das Ziel gekappt wurde', () => {
    assert.ok(!reputationChange(50, { airlineSatisfaction: 120 }).causes.some((c) => c.cause === 'limit'));
    assert.ok(reputationChange(50, { airlineSatisfaction: 160, campaigns: ['global'] }).causes.some((c) => c.cause === 'limit'));
  });

  it('6.5: nie über das Ziel hinaus; gleiches Ziel → Abstand schrumpft je Monat um genau 15 %', () => {
    for (const start of [0, 40, 70, 100]) {
      for (const input of inputs) {
        const { reputation, target } = reputationChange(start, input);
        assert.ok(Math.abs(target - reputation) <= Math.abs(target - start) + 1e-12);
        assert.ok((reputation - start) * (target - start) >= 0);
        close(Math.abs(target - reputation), (1 - REPUTATION_STEP) * Math.abs(target - start), 1e-12);
        assert.ok(reputation >= 0 && reputation <= 100);
      }
    }
  });

  it('6.5: Spieler und KI rechnen mit derselben Funktion und starten bei 50 (6.13)', () => {
    assert.equal(START_REPUTATION, 50);
    const rival = reputationChange(START_REPUTATION, { airlineSatisfaction: 110, campaigns: [] });
    const player = reputationChange(START_REPUTATION, { airlineSatisfaction: 110 });
    assert.deepEqual(rival, player);
  });
});

describe('Abschnitt 6.6 Anzeige des Rufs', () => {
  it('6.6: Farbstufen aus 50 ± 10', () => {
    assert.equal(reputationBand(60), 'high');
    assert.equal(reputationBand(59.9), 'neutral');
    assert.equal(reputationBand(50), 'neutral');
    assert.equal(reputationBand(40.1), 'neutral');
    assert.equal(reputationBand(40), 'low');
  });

  it('6.6: Ruf 50 = Nachfrage-Faktor 1 (3.9.4)', () => {
    assert.equal(reputationFactor(50), 1);
  });
});

describe('Abschnitt 6.14 Beispiel (Ruf)', () => {
  it('6.14: Tabelle Ruf-Ziel und reputationFactor', () => {
    const table: [number, number, number][] = [
      [50, 25, 0.95],
      [80, 40, 0.98],
      [90, 45, 0.99],
      [100, 50, 1],
      [110, 58.3, 1.017],
      [120, 66.7, 1.033],
      [130, 75, 1.05],
      [145, 87.5, 1.075],
      [160, 100, 1.1],
    ];
    for (const [s, target, factor] of table) {
      const t = reputationTarget({ airlineSatisfaction: s });
      close(t, target, 0.05, `Ziel bei ${s}`);
      close(reputationFactor(t), factor, 0.0005, `Faktor bei ${s}`);
    }
  });

  it('6.14: Weg zum Ziel 66,7 von 50 aus', () => {
    const input = { airlineSatisfaction: 120 };
    const path: [number, number][] = [[1, 52.5], [3, 56.4], [6, 60.4], [12, 64.3], [24, 66.3]];
    for (const [months, expected] of path) close(reputationAfter(50, input, months), expected, 0.05, `${months} Monate`);
  });

  it('6.14: globale Kampagne klingt nach dem Ende ab', () => {
    const during = reputationAfter(50, { airlineSatisfaction: 100, campaigns: ['global'] }, 12);
    close(during, 51.7, 0.05);
    close(reputationAfter(during, { airlineSatisfaction: 100 }, 6), 50.6, 0.05);
    close(reputationAfter(during, { airlineSatisfaction: 100 }, 12), 50.2, 0.05);
  });

  it('6.14: ein Monat mit 10 % gestrichenen Sitzen bei Ruf 60 im Gleichgewicht', () => {
    const steady = { airlineSatisfaction: 112 };
    close(reputationTarget(steady), 60, 1e-9);
    const hit = reputationChange(60, { ...steady, cancelledShare: 0.1 });
    close(hit.target, 50, 1e-9);
    close(hit.reputation, 58.5, 1e-9);
    const after: [number, number][] = [[1, 58.7], [3, 59.1], [6, 59.4]];
    for (const [months, expected] of after) close(reputationAfter(hit.reputation, steady, months), expected, 0.05);
  });
});

const stats = (routes: number, monthlyPax: number, reputation: number, regions: number, years: number): RankStats => ({
  routes,
  monthlyPax,
  reputation,
  regions,
  years,
});

/** Genau die Bedingungen einer Stufe. */
const exactly = (rank: number): RankStats => ({ ...RANKS[rank].requires });

describe('Abschnitt 6.7 Rang', () => {
  it('6.7: rankStats zählt Fluggäste × WEEKS_PER_MONTH, Regionen einmal, volle Jahre', () => {
    const s = rankStats({
      routes: 7,
      weeklyPassengers: 1_000,
      reputation: 52,
      routeEndRegions: ['EU', 'EU', 'NA', 'EU'],
      monthsPlayed: 35,
    });
    assert.deepEqual(s, { routes: 7, monthlyPax: 1_000 * WEEKS_PER_MONTH, reputation: 52, regions: 2, years: 2 });
  });

  it('6.7: Mittel der letzten 3 Monate, fehlende Monate zählen 0, Jahre aus dem letzten Monat', () => {
    const avg = averageRankStats([stats(6, 30_000, 60, 1, 1)]);
    assert.deepEqual(avg, stats(2, 10_000, 20, 1 / 3, 1));
    const longer = averageRankStats([stats(100, 0, 0, 0, 0), stats(3, 3, 3, 3, 0), stats(6, 6, 6, 6, 0), stats(9, 9, 9, 9, 1)]);
    assert.deepEqual(longer, stats(6, 6, 6, 6, 1));
  });

  it('6.7: ein starker Monat zwischen zwei schwachen hebt den Rang nicht (W6)', () => {
    const weak = stats(0, 0, 50, 1, 0);
    const strong = { ...exactly(1), reputation: 50 };
    assert.equal(nextRank(0, [weak, strong, weak]), 0);
    assert.equal(nextRank(0, [strong, strong, strong]), 1);
  });

  it('6.7: Rang sinkt nie, auch wenn die Werte fallen', () => {
    const nothing = stats(0, 0, 0, 0, 0);
    for (let rank = 0; rank <= MAX_RANK; rank++) assert.equal(nextRank(rank, [nothing, nothing, nothing]), rank);
  });

  it('6.7: Prüfung der Reihe nach; genau die Bedingungen einer Stufe reichen', () => {
    for (let rank = 0; rank <= MAX_RANK; rank++) assert.equal(qualifyingRank(exactly(rank)), rank);
    const gap = { ...exactly(MAX_RANK), regions: 0 };
    assert.equal(qualifyingRank(gap), 0);
  });

  it('6.7: jede Stufe verlangt in jeder Spalte mindestens so viel wie die Stufe davor', () => {
    const keys: (keyof RankRequirement)[] = ['routes', 'monthlyPax', 'reputation', 'regions', 'years'];
    for (let rank = 1; rank <= MAX_RANK; rank++) {
      for (const key of keys) assert.ok(RANKS[rank].requires[key] >= RANKS[rank - 1].requires[key], `${key} Rang ${rank}`);
      assert.ok(RANKS[rank].maxHubs >= RANKS[rank - 1].maxHubs);
      assert.ok(RANKS[rank].maxAirportLevel >= RANKS[rank - 1].maxAirportLevel);
      assert.ok(RANKS[rank].researchSlots >= RANKS[rank - 1].researchSlots);
      assert.equal(RANKS[rank].index, rank);
    }
  });

  it('6.7: Forschungsplätze 3 / 4 / 5 ab Rang 4 / 6 / 8 aus demselben Datensatz (E42, W7)', () => {
    assert.deepEqual(
      RANKS.map((_, rank) => researchSlots(rank)),
      [2, 2, 2, 2, 3, 3, 4, 4, 5, 5],
    );
    for (let rank = 0; rank <= MAX_RANK; rank++) assert.equal(researchSlots(rank), rankDef(rank).researchSlots);
  });

  it('6.7: Ruf-Schwellen neu (30 … 65), Ruf 65 heißt Satisfaction ≈ 118', () => {
    assert.deepEqual(RANKS.map((r) => r.requires.reputation), [0, 30, 35, 40, 45, 50, 53, 56, 60, 65]);
    close(satisfactionReputation(118), 65, 0.01);
  });

  it('6.7: Free Mode: Rang 9 vom ersten Monat an; Drehkreuze unbegrenzt', () => {
    assert.equal(effectiveRank('free', 0), MAX_RANK);
    assert.equal(effectiveRank('normal', 3), 3);
    assert.equal(hubAllowance(0, 0, 'free'), Number.POSITIVE_INFINITY);
    assert.equal(hubAllowance(4, 1), 4);
  });

  it('6.7: Freischaltungen nach Rang', () => {
    assert.ok(hasUnlock(0, 'localCampaign'));
    assert.ok(!hasUnlock(7, 'managementTier3'));
    assert.ok(hasUnlock(8, 'managementTier3'));
    assert.equal(RANK_UNLOCKS.vipLounge, 4);
    assert.ok(hasUnlock(MAX_RANK, 'takeoverHealthy'));
  });

  it('6.7: Flughafen-Zugang nach Größe, mit Ausnahmen Heimat, Verwaltungsstufe ≥ 1, Strecken-Ende', () => {
    assert.ok(isAirportOpen(0, 4));
    assert.ok(!isAirportOpen(0, 5));
    assert.ok(isAirportOpen(0, 7, { isHome: true }));
    assert.ok(isAirportOpen(0, 7, { managementTier: 1 }));
    assert.ok(!isAirportOpen(0, 7, { managementTier: 0 }));
    assert.ok(isAirportOpen(0, 7, { isRouteEnd: true }));
    assert.ok(isAirportOpen(4, 7));
  });

  it('6.7: Fortschritt aus denselben 3-Monats-Mitteln; null auf dem höchsten Rang', () => {
    assert.equal(rankProgress(MAX_RANK, [exactly(MAX_RANK)]), null);
    const target = RANKS[1].requires;
    const half = stats(target.routes / 2, target.monthlyPax / 2, target.reputation / 2, target.regions / 2, 0);
    const progress = rankProgress(0, [half, half, half]);
    assert.ok(progress);
    assert.equal(progress.next.index, 1);
    assert.equal(progress.lines.length, 4); // Jahre-Schwelle 0 zählt nicht
    close(progress.fraction, 0.5, 1e-12);
    const oneMonth = rankProgress(0, [exactly(1)]);
    assert.ok(oneMonth);
    close(oneMonth.fraction, 1 / 3, 1e-12);
  });

  it('6.7: ein unbekannter Rang ist ein Fehler', () => {
    assert.throws(() => rankDef(10));
    assert.throws(() => rankDef(-1));
  });
});

describe('Abschnitt 6.8 Flugzeugklassen', () => {
  it('6.8: Klassen wie im Alt-Code (Grenzen 60 / 130 / 500 Sitze, 1 000 km/h)', () => {
    assert.equal(sizeClassOf({ class: 'Regional', capacity: 60, cruiseSpeed: 500 }), 'commuter');
    assert.equal(sizeClassOf({ class: 'Regional', capacity: 61, cruiseSpeed: 500 }), 'regional');
    assert.equal(sizeClassOf({ class: 'Narrowbody', capacity: 130, cruiseSpeed: 850 }), 'regional');
    assert.equal(sizeClassOf({ class: 'Narrowbody', capacity: 131, cruiseSpeed: 850 }), 'narrowbody');
    assert.equal(sizeClassOf({ class: 'Widebody', capacity: 500, cruiseSpeed: 900 }), 'widebody');
    assert.equal(sizeClassOf({ class: 'Widebody', capacity: 501, cruiseSpeed: 900 }), 'jumbo');
    assert.equal(sizeClassOf({ class: 'Narrowbody', capacity: 128, cruiseSpeed: 2158 }), 'supersonic');
  });

  it('6.8: offen sind Commuter, erforschte Klassen und Klassen der eigenen Flotte; Free Mode alle', () => {
    assert.deepEqual([...openSizeClasses([])], ['commuter']);
    assert.deepEqual([...openSizeClasses(['class-regional'])].sort(), ['commuter', 'regional']);
    assert.ok(openSizeClasses([], ['widebody']).has('widebody'));
    assert.equal(openSizeClasses([], [], 'free').size, SIZE_CLASSES.length);
  });

  it('6.8: Projekte wie in der Tabelle; Überschall braucht Widebody (E41)', () => {
    assert.deepEqual(
      Object.entries(CLASS_RESEARCH).map(([c, p]) => [c, p.rank, p.requires, p.months, p.price1960]),
      [
        ['regional', 1, null, 6, 2_100_000],
        ['narrowbody', 2, 'regional', 9, 8_400_000],
        ['widebody', 4, 'narrowbody', 12, 28_000_000],
        ['jumbo', 5, 'widebody', 18, 56_000_000],
        ['supersonic', 5, 'widebody', 24, 42_000_000],
      ],
    );
    assert.equal(classResearchChainMonths('supersonic'), 6 + 9 + 12 + 24);
    assert.equal(classResearchChainMonths('commuter'), 0);
  });

  it('6.8: jedes Projekt erscheint nicht früher als sein Vorgänger', () => {
    for (const project of Object.values(CLASS_RESEARCH)) {
      if (project.requires !== null) {
        const before = CLASS_RESEARCH[project.requires as Exclude<SizeClass, 'commuter'>];
        assert.ok(before.rank <= project.rank);
      }
    }
  });

  it('6.8: Spielstart mit höherem Rang: Klassen-Projekte bis zum Startrang fertig', () => {
    assert.deepEqual(startingClassResearch(0), []);
    assert.deepEqual(startingClassResearch(2), ['class-regional', 'class-narrowbody']);
    assert.equal(startingClassResearch(MAX_RANK).length, 5);
  });

  it('6.8: Erreichbarkeit: Jahre des Rangs + Dauer aller nötigen Projekte < letzter Liefermonat der Klasse (Start 1960)', () => {
    for (const sizeClass of SIZE_CLASSES) {
      if (sizeClass === 'commuter') continue;
      const project = CLASS_RESEARCH[sizeClass];
      const ready = RANKS[project.rank].requires.years * 12 + classResearchChainMonths(sizeClass);
      const types = aircraftList.filter((a) => sizeClassOf(a) === sizeClass);
      assert.ok(types.length > 0, `keine Typen der Klasse ${sizeClass}`);
      const lastDelivery = Math.max(...types.map((a) => a.lastDeliveryOffset ?? Number.POSITIVE_INFINITY));
      assert.ok(ready < lastDelivery, `${sizeClass}: fertig ${ready}, letzte Lieferung ${lastDelivery}`);
    }
  });

  it('6.8: Concorde: Forschung muss bis Monat 221 starten (letzte Lieferung 245)', () => {
    const concorde = aircraftList.filter((a) => sizeClassOf(a) === 'supersonic');
    const last = Math.max(...concorde.map((a) => a.lastDeliveryOffset ?? Number.POSITIVE_INFINITY));
    assert.equal(last - CLASS_RESEARCH.supersonic.months, 221);
  });
});
