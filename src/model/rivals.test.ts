/**
 * Regeltests zu SPEZIFIKATION 7.1–7.7 (gleiche Wirtschaft, fehlende Teile, KI-Stärke, Persönlichkeiten, Kabine,
 * Preise mit Preiskampf, Gründung) und den Kabinen- und Preis-Teilen des Beispiels 7.18. Paket 3.7a.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { aircraftList as AIRCRAFT } from '../data/aircraft';
import { EXTRAS_OPTIONS, MEAL_DATA, SERVICE_OPTIONS } from '../data/catering';
import { REAL_AIRLINES } from '../data/rivalAirlines';
import { costIndex, difficultyFactor } from './basics';
import { cabinRating, cabinSpace, economySeatsLeft, interiorScore, seatSpace } from './cabin';
import { aircraftEfficiency, cabinCrew, payFactor, researchCostFactor } from './costs';
import { routeFare } from './fare';
import { advertisingRegionFactor, frequentFlyerFactor, rampFactor } from './marketSplit';
import { advertisingReputation, researchEffects, sizeClassOf } from './progress';
import { researchPart, satisfactionFactor, servicePoints, serviceCapability, staffPart } from './satisfaction';
import {
  CABIN_CLASSES,
  COST_RESEARCH_KINDS,
  FARE_STEP,
  PERSONALITIES,
  PERSONALITY_IDS,
  PRICE_WAR_COOLDOWN,
  PRICE_WAR_CUT,
  PRICE_WAR_MAX_MONTHS,
  PRICE_WAR_WINDOW,
  RIVAL_STRENGTH,
  RIVAL_STRENGTHS,
  START_HUB_SETUP,
  SUPERSONIC_MIN_KMH,
  YIELD_MAX,
  type CabinClass,
  type RivalPersonality,
} from './constants';
import {
  RIVAL_INPUTS,
  RIVAL_OMITTED,
  fictionalHubWeights,
  fictionalRivalCount,
  inPriceWar,
  isOnMarket,
  longHaulFactor,
  mayFoundAt,
  nextYieldPosition,
  pickStartAircraft,
  priceWarStep,
  realRivalWeight,
  rivalBuyChance,
  rivalCabin,
  rivalCashReserve,
  rivalDeskType,
  rivalFareRatio,
  rivalPatience,
  rivalPriceFloor,
  rivalService,
  rivalStartCash,
  rivalStartSetup,
  rivalStrengthOf,
  rivalTargetFareRatio,
  seatTypeAtLevel,
  shouldRefill,
  startFleetKinds,
  targetWeight,
  weightedPick,
  type HubCandidate,
  type PriceWarInput,
  type PriceWarState,
} from './rivals';

const HERE = dirname(fileURLToPath(import.meta.url));
const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const M1990 = (1990 - 1960) * 12;
const M2015 = (2015 - 1960) * 12;
const A320 = AIRCRAFT.find((a) => a.id === 'a320ceo')!;

/** Dateien mit den Entscheidungen der KI (7.3–7.17); nur sie dürfen nach der KI fragen. */
const RIVAL_DECISION_FILES = ['rivals.ts', 'rivalMonth.ts'];

/** Code-Dateien des Modells ohne Tests. */
function modelSources(): { name: string; text: string }[] {
  return readdirSync(HERE)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((name) => ({ name, text: readFileSync(join(HERE, name), 'utf8') }));
}

describe('Abschnitt 7.1 Gleiche Wirtschaft', () => {
  it('7.1: kein Modell-Pfad außer den KI-Entscheidungen fragt „ist das eine KI?“ oder hängt von ihnen ab', () => {
    for (const { name, text } of modelSources()) {
      if (RIVAL_DECISION_FILES.includes(name) || name === 'index.ts') continue;
      assert.doesNotMatch(text, /\b(isRival|isAi|isAI|isPlayer)\b/, name);
      assert.doesNotMatch(text, /from '\.\/(rivals|rivalMonth)'/, name);
    }
  });

  it('7.1/7.3: die KI-Stärke kommt nur in den Entscheidungen vor (rivals.ts, rivalMonth.ts), in keiner Funktion aus 7.1', () => {
    for (const { name, text } of modelSources()) {
      if (RIVAL_DECISION_FILES.includes(name) || name === 'constants.ts' || name === 'index.ts') continue;
      assert.doesNotMatch(text, /RivalStrength|RIVAL_STRENGTH/, name);
    }
  });

  it('7.1: KI und Spieler mit gleichen (neutralen) Eingaben bekommen dieselben Faktoren', () => {
    // Der Spieler mit Lohn 100 %, Moral 50, ohne Forschung, Werbung und FFP, auf Normal.
    assert.equal(payFactor(RIVAL_INPUTS.salaryPct), payFactor(100));
    assert.equal(staffPart(RIVAL_INPUTS.morale), staffPart(50));
    assert.equal(difficultyFactor(RIVAL_INPUTS.difficulty), difficultyFactor('Normal'));
    assert.deepEqual(researchEffects(RIVAL_INPUTS.completedResearch), researchEffects([]));
  });
});

describe('Abschnitt 7.2 Bewusst fehlende Teile', () => {
  it('7.2: Forschung neutral (Kosten-Faktoren 1, Satisfaction 0, Effizienz ohne Forschung, alle Felder neutral)', () => {
    for (const kind of COST_RESEARCH_KINDS) assert.equal(researchCostFactor(kind, RIVAL_INPUTS.completedResearch), 1);
    assert.equal(researchPart(RIVAL_INPUTS.completedResearch), 0);
    assert.equal(aircraftEfficiency(72, RIVAL_INPUTS.completedResearch), 72);
    const e = researchEffects(RIVAL_INPUTS.completedResearch);
    assert.equal(e.demandFactor, 1);
    assert.equal(e.hubQualityFactor, 1);
    assert.equal(e.rampBonus, 0);
    assert.equal(e.defectFactor, 1);
    assert.equal(e.wearFactor, 1);
    assert.equal(e.resaleBonus, 0);
    assert.equal(e.moralePoints, 0);
  });

  it('7.2: Personal, Werbung, Frequent flyer, Schwierigkeit, Anlauf neutral', () => {
    assert.equal(payFactor(RIVAL_INPUTS.salaryPct), 1);
    assert.equal(staffPart(RIVAL_INPUTS.morale), 0);
    assert.equal(advertisingRegionFactor(RIVAL_INPUTS.campaigns), 1);
    assert.equal(advertisingReputation(RIVAL_INPUTS.campaigns), 0);
    assert.equal(frequentFlyerFactor(RIVAL_INPUTS.ffpMonthsRunning), 1);
    assert.equal(difficultyFactor(RIVAL_INPUTS.difficulty), 1);
    for (const age of [0, 3, 12]) assert.equal(rampFactor(age, RIVAL_INPUTS.rampBonus), rampFactor(age));
    assert.equal(RIVAL_INPUTS.crisisResponseFactor, 1);
    assert.equal(RIVAL_INPUTS.charter, false);
    assert.equal(RIVAL_INPUTS.launchCustomer, false);
    assert.equal(RIVAL_INPUTS.badLuckCap, false);
  });

  it('7.2: die Liste als Text hat die 12 Einträge der Spezifikation, jeder vollständig', () => {
    assert.equal(RIVAL_OMITTED.length, 12);
    for (const row of RIVAL_OMITTED) {
      assert.ok(row.part && row.valueForRivals && row.reason);
    }
  });
});

describe('Abschnitt 7.3 KI-Stärke', () => {
  it('7.3: Hard ist in jeder Zeile mindestens so geschickt wie Normal, Normal wie Easy', () => {
    for (let i = 1; i < RIVAL_STRENGTHS.length; i++) {
      const weak = RIVAL_STRENGTH[RIVAL_STRENGTHS[i - 1]];
      const strong = RIVAL_STRENGTH[RIVAL_STRENGTHS[i]];
      assert.ok(strong.startCash1960 >= weak.startCash1960);
      assert.ok(strong.startFleet >= weak.startFleet);
      assert.ok(strong.searchWidth >= weak.searchWidth);
      assert.ok(strong.forecastNoise <= weak.forecastNoise);
      assert.ok(strong.buyChance >= weak.buyChance);
      assert.ok(strong.fineTuneChance >= weak.fineTuneChance);
      assert.ok(strong.actionsPerMonth >= weak.actionsPerMonth);
      assert.ok(strong.openWithoutProfitChance <= weak.openWithoutProfitChance);
    }
  });

  it('7.3: Werte der Tabelle', () => {
    assert.deepEqual(
      RIVAL_STRENGTHS.map((s) => [RIVAL_STRENGTH[s].startCash1960, RIVAL_STRENGTH[s].startFleet, RIVAL_STRENGTH[s].searchWidth]),
      [
        [50e6, 2, 4],
        [80e6, 3, 8],
        [120e6, 4, 12],
      ],
    );
  });

  it('7.3: alte Schreibweise wird gelesen, Unbekanntes ist ein Fehler', () => {
    assert.equal(rivalStrengthOf('Hard'), 'hard');
    assert.equal(rivalStrengthOf('normal'), 'normal');
    assert.throws(() => rivalStrengthOf('Brutal'));
  });
});

describe('Abschnitt 7.4 Persönlichkeiten', () => {
  it('7.4: jede Persönlichkeit hat in jeder Zeile einen Wert; die Liste gibt es einmal', () => {
    assert.equal(new Set(PERSONALITY_IDS).size, 5);
    assert.deepEqual([...PERSONALITY_IDS].sort(), Object.keys(PERSONALITIES).sort());
    for (const p of PERSONALITY_IDS) {
      for (const [key, value] of Object.entries(PERSONALITIES[p])) {
        assert.notEqual(value, undefined, `${p}.${key}`);
      }
    }
    for (const a of REAL_AIRLINES) assert.ok(PERSONALITY_IDS.includes(a.personality), a.name);
  });

  it('7.4: Angriffslust und Geduld (Grundwert + Angriffslust − 6, wenn positiv)', () => {
    assert.deepEqual(
      PERSONALITY_IDS.map((p) => [p, PERSONALITIES[p].aggression, rivalPatience(p)]),
      [
        ['lcc', 8, 6],
        ['expansionist', 9, 8],
        ['optimizer', 4, 3],
        ['flag', 6, 6],
        ['boutique', 5, 6],
      ],
    );
  });

  it('7.4: Kaufneigung = Stärke × Faktor, höchstens der Höchstwert', () => {
    near(rivalBuyChance('normal', 'lcc'), 0.45 * 1.25);
    near(rivalBuyChance('hard', 'lcc'), 0.85);
    near(rivalBuyChance('hard', 'expansionist'), 0.9);
    near(rivalBuyChance('hard', 'flag'), 0.85);
    near(rivalBuyChance('easy', 'boutique'), 0.12 * 0.9);
  });

  it('7.4: Reserve mit atCost', () => {
    near(rivalCashReserve('lcc', 0), 5e6, 1e-6);
    near(rivalCashReserve('flag', M1990), 10e6 * costIndex(M1990), 1e-3);
  });

  it('7.4: Schalter-Art: LCC Selbstbedienung, wo lieferbar; sonst bedient', () => {
    assert.equal(rivalDeskType('lcc', M1990), 'normal');
    assert.equal(rivalDeskType('lcc', M2015), 'self');
    assert.equal(rivalDeskType('flag', M2015), 'normal');
  });

  it('7.4/7.9: Zielgewicht und Langstrecken-Abzug der LCC', () => {
    near(targetWeight('lcc', 10, 10), 20);
    near(targetWeight('flag', 10, 0), 15);
    assert.equal(longHaulFactor('lcc', 3000), 1);
    assert.equal(longHaulFactor('lcc', 4000), 0.4);
    assert.equal(longHaulFactor('flag', 9000), 1);
  });
});

describe('Abschnitt 7.5 Kabine und Service der KI', () => {
  const ROWS: [RivalPersonality, number[], number, number, number[], number, number][] = [
    // Persönlichkeit, Sitze 1990, Interior / Cabin rating Economy 1990, Sitze 2015, Interior / Cabin rating 2015
    ['lcc', [202, 0, 0, 0], 40, 49.9, [202, 0, 0, 0], 40, 49.9],
    ['expansionist', [159, 14, 8, 0], 60.5, 63.6, [159, 14, 8, 0], 65.5, 67.0],
    ['optimizer', [120, 17, 10, 4], 81, 77.4, [120, 17, 10, 4], 86, 80.7],
    ['flag', [92, 18, 16, 8], 88.5, 82.4, [92, 18, 16, 8], 112.5, 98.5],
    ['boutique', [59, 25, 20, 8], 96.5, 87.8, [63, 21, 17, 8], 140.5, 100],
  ];

  for (const [p, seats90, int90, cr90, seats15, int15, cr15] of ROWS) {
    it(`7.18: ${p} im A320ceo, 1990 und 2015`, () => {
      for (const [month, seats, interior, rating] of [
        [M1990, seats90, int90, cr90],
        [M2015, seats15, int15, cr15],
      ] as const) {
        const cabin = rivalCabin(p, A320, month);
        assert.deepEqual(
          CABIN_CLASSES.map((c) => cabin.seats[c]),
          seats,
        );
        const score = interiorScore('economy', cabin.interiors.economy, cabin.fit);
        near(score, interior);
        near(cabinRating(70, score, 100), rating, 0.05);
      }
    });
  }

  it('7.18: LCC-Kosten je Sitz: Treibstoff und Landung −34 %, Flugbegleiter −32 % gegen Flag', () => {
    const lcc = rivalCabin('lcc', A320, M1990).seats;
    const flag = rivalCabin('flag', A320, M1990).seats;
    const total = (s: Record<CabinClass, number>) => CABIN_CLASSES.reduce((sum, c) => sum + s[c], 0);
    assert.equal(total(lcc), 202);
    assert.equal(total(flag), 134);
    near(1 - total(flag) / total(lcc), 0.34, 0.005);
    near(cabinCrew(lcc), 4.04, 1e-9);
    near(cabinCrew(flag), 3.95, 0.005);
    near(1 - cabinCrew(lcc) / total(lcc) / (cabinCrew(flag) / total(flag)), 0.32, 0.005);
  });

  it('7.5: Sitze aller Klassen passen in den Platz; die LCC hat die meisten Sitze; Boutique die beste Economy', () => {
    for (const type of AIRCRAFT.filter((a) => a.firstDeliveryOffset <= M2015)) {
      const month = Math.max(type.firstDeliveryOffset, 0);
      const byP = PERSONALITY_IDS.map((p) => ({ p, cabin: rivalCabin(p, type, month) }));
      for (const { p, cabin } of byP) {
        const used = CABIN_CLASSES.reduce((sum, c) => sum + cabin.seats[c] * seatSpace(c, cabin.interiors[c]), 0);
        assert.ok(used <= cabinSpace(cabin.fit) + 1e-9, `${type.id} ${p}`);
      }
      const total = (s: Record<CabinClass, number>) => CABIN_CLASSES.reduce((sum, c) => sum + s[c], 0);
      const lcc = total(byP[0].cabin.seats);
      for (const { cabin } of byP) assert.ok(lcc >= total(cabin.seats), type.id);
      const eco = byP.map(({ cabin }) => interiorScore('economy', cabin.interiors.economy, cabin.fit));
      assert.equal(Math.max(...eco), eco[PERSONALITY_IDS.indexOf('boutique')], type.id);
    }
  });

  it('7.5: Commuter- und Regional-Flugzeuge bekommen nur Economy', () => {
    const small = AIRCRAFT.filter((a) => ['commuter', 'regional'].includes(sizeClassOf(a)));
    assert.ok(small.length > 0);
    for (const type of small) {
      const cabin = rivalCabin('boutique', type, Math.max(type.firstDeliveryOffset, 0));
      assert.equal(cabin.seats.premium + cabin.seats.business + cabin.seats.first, 0, type.id);
      assert.ok(cabin.seats.economy > 0, type.id);
    }
  });

  it('7.5: Sitz-Stufe nimmt die höchste lieferbare darunter', () => {
    const fit = { installedMonth: M1990, capacity: 186 };
    assert.equal(seatTypeAtLevel('economy', 2, fit), 'Comfort');
    assert.equal(seatTypeAtLevel('economy', 2, { ...fit, installedMonth: M2015 }), 'Ergonomic');
    assert.equal(seatTypeAtLevel('first', 2, fit), 'Flat Bed');
    assert.equal(seatTypeAtLevel('business', 0, fit), 'Standard');
  });

  it('7.5: Extras zählen nur lieferbar und passend; Bar braucht Platz', () => {
    const bar = rivalCabin('boutique', { class: 'Widebody', capacity: 300, cruiseSpeed: 900 }, M2015);
    assert.ok(bar.fit.extras.includes('bar'));
    near(cabinSpace(bar.fit), 300 * 74 - 400);
    assert.ok(!rivalCabin('boutique', A320, M2015).fit.extras.includes('bar'));
    near(economySeatsLeft(740, {}, { seatType: 'Standard', pitch: 74, features: [] }), 10);
  });

  it('7.5: Service-Ids sind bekannt; LCC ohne Service', () => {
    const meals = new Set(Object.values(MEAL_DATA).flat().map((m) => m.id));
    for (const p of PERSONALITY_IDS) {
      for (const c of CABIN_CLASSES) {
        const s = PERSONALITIES[p].service[c];
        for (const id of s.menu) assert.ok(meals.has(id), `${p} ${c} ${id}`);
        for (const id of s.extras) assert.ok(id in EXTRAS_OPTIONS, `${p} ${c} ${id}`);
        for (const id of s.onboardService) assert.ok(id in SERVICE_OPTIONS, `${p} ${c} ${id}`);
      }
    }
    for (const c of CABIN_CLASSES) assert.equal(servicePoints(rivalService('lcc', c, 600), 600, capability()), 0);
  });

  it('7.5: jede Mahlzeit mit Gewicht > 0 bekommt das Menü; Satisfaction-Teil = Spieler mit gleicher Auswahl', () => {
    const short = rivalService('flag', 'business', 60);
    const long = rivalService('flag', 'business', 720);
    assert.deepEqual(short.meals.filter((m) => m.length > 0).length, 1);
    assert.deepEqual(long.meals, [['p6', 's1'], ['p6', 's1'], ['p6', 's1']]);
    const player = { meals: long.meals, extras: ['alcohol', 'amenities', 'headphones'], onboardService: ['drinks', 'seat_coord'] };
    assert.equal(servicePoints(long, 720, capability()), servicePoints(player, 720, capability()));
    assert.ok(servicePoints(long, 720, capability()) > servicePoints(rivalService('flag', 'business', 60), 720, capability()));
  });
});

function capability() {
  return serviceCapability({ aircraftClass: 'Widebody', hasWifi: false, hasPremiumGalley: true, cateringFacility: true });
}

describe('Abschnitt 7.6 KI-Preise', () => {
  it('7.18: Beispiel KI-Preise bei Marktpreis 100 $', () => {
    const lcc = rivalTargetFareRatio('lcc', satisfactionFactor(85));
    near(satisfactionFactor(85), 0.925, 1e-9);
    near(lcc * 100, 87.875, 1e-9);
    near(rivalTargetFareRatio('flag', satisfactionFactor(115)) * 100, 111.2, 0.1);
    const war = rivalFareRatio({ personality: 'lcc', target: lcc, yieldPosition: 0, priceWar: true, breakEvenFull: 0.5 });
    near(war * 100, 77.33, 1e-6);
    const deep = rivalFareRatio({ personality: 'lcc', target: lcc, yieldPosition: -0.15, priceWar: true, breakEvenFull: 0.5 });
    near(deep * 100, 65.73, 0.01);
    assert.ok(deep >= 0.6);
  });

  it('7.6: Optimizer nimmt den besten Preis; ohne ihn ist es ein Fehler', () => {
    assert.equal(rivalTargetFareRatio('optimizer', 1.3, 0.82), 0.82);
    assert.throws(() => rivalTargetFareRatio('optimizer', 1.3));
  });

  it('7.6: höhere Satisfaction → nie niedrigeres Zielniveau', () => {
    for (const p of PERSONALITY_IDS.filter((x) => x !== 'optimizer')) {
      let last = -Infinity;
      for (let sat = 0; sat <= 160; sat += 1) {
        const t = rivalTargetFareRatio(p, satisfactionFactor(sat));
        assert.ok(t >= last - 1e-12, `${p} ${sat}`);
        last = t;
      }
    }
  });

  it('7.6: Lage nach Auslastung, Richtung 0, höchstens ± YIELD_MAX', () => {
    near(nextYieldPosition(0, 0.97), FARE_STEP);
    near(nextYieldPosition(0, 0.5), -FARE_STEP);
    near(nextYieldPosition(0.1, 0.8), 0.07);
    assert.equal(nextYieldPosition(0.02, 0.8), 0);
    assert.equal(nextYieldPosition(-0.03, 0.8), 0);
    let y = 0;
    for (let i = 0; i < 20; i++) y = nextYieldPosition(y, 1);
    near(y, YIELD_MAX);
    for (let i = 0; i < 40; i++) y = nextYieldPosition(y, 0);
    near(y, -YIELD_MAX);
  });

  it('7.6: Boden nur im Preiskampf über FARE_RATIO_MIN, mindestens FARE_FLOOR und Gewinnschwelle', () => {
    assert.equal(rivalPriceFloor('lcc', false, 2), 0.25);
    assert.equal(rivalPriceFloor('lcc', true, 0.3), 0.6);
    assert.equal(rivalPriceFloor('lcc', true, 0.7), 0.7);
    assert.equal(rivalPriceFloor('flag', true, 0.1), 0.75);
    const capped = rivalFareRatio({ personality: 'flag', target: 5, yieldPosition: 0.15, priceWar: false, breakEvenFull: 0 });
    assert.equal(capped, 4);
    const hopeless = rivalFareRatio({ personality: 'flag', target: 1, yieldPosition: 0, priceWar: true, breakEvenFull: 6 });
    assert.equal(hopeless, 4);
  });

  it('7.6: KI und Spieler mit gleichem fareRatio zahlen denselben Preis', () => {
    const ratio = rivalFareRatio({ personality: 'flag', target: 1.1, yieldPosition: 0.03, priceWar: false, breakEvenFull: 0 });
    assert.equal(routeFare(ratio, 250), ratio * 250);
  });

  const warInput = (over: Partial<PriceWarInput>): PriceWarInput => ({
    personality: 'lcc',
    month: 100,
    routeAgeMonths: 10,
    avgProfit: 1000,
    undercutInEconomy: false,
    competitorPresent: true,
    lastRivalOpeningMonth: 98,
    ...over,
  });

  it('7.6: Beginn nur mit Angriffslust ≥ 7, Alter ≥ 2, Gewinn > 0 und Anlass (Eröffnung im Fenster oder billiger)', () => {
    assert.equal(priceWarStep({}, warInput({})).event, 'started');
    assert.equal(priceWarStep({}, warInput({ personality: 'flag' })).event, null);
    assert.equal(priceWarStep({}, warInput({ routeAgeMonths: 1 })).event, null);
    assert.equal(priceWarStep({}, warInput({ avgProfit: 0 })).event, null);
    assert.equal(priceWarStep({}, warInput({ lastRivalOpeningMonth: 100 - PRICE_WAR_WINDOW })).event, null);
    assert.equal(priceWarStep({}, warInput({ lastRivalOpeningMonth: 100 - PRICE_WAR_WINDOW + 1 })).event, 'started');
    assert.equal(priceWarStep({}, warInput({ lastRivalOpeningMonth: undefined, undercutInEconomy: true })).event, 'started');
    assert.equal(priceWarStep({}, warInput({ lastRivalOpeningMonth: undefined })).event, null);
  });

  it('7.6: Ende nach 12 Monaten, bei Verlust oder ohne Mitbewerber; danach Abstand', () => {
    const running: PriceWarState = { startedMonth: 100 };
    assert.equal(priceWarStep(running, warInput({ month: 100 + PRICE_WAR_MAX_MONTHS - 1 })).event, null);
    const end = priceWarStep(running, warInput({ month: 100 + PRICE_WAR_MAX_MONTHS }));
    assert.equal(end.event, 'ended');
    assert.equal(end.state.cooldownUntil, 112 + PRICE_WAR_COOLDOWN);
    assert.equal(priceWarStep(running, warInput({ month: 103, avgProfit: -1 })).event, 'ended');
    assert.equal(priceWarStep(running, warInput({ month: 103, competitorPresent: false })).event, 'ended');
    const cool = end.state;
    assert.equal(priceWarStep(cool, warInput({ month: 120, lastRivalOpeningMonth: 119 })).event, null);
    assert.equal(priceWarStep(cool, warInput({ month: 124, lastRivalOpeningMonth: 123 })).event, 'started');
  });

  it('7.6: zwei KI mit Angriffslust 8, 36 Monate: nie unter dem Boden, Nachlass einmal, Rückkehr in ≤ YIELD_MAX / FARE_STEP Monaten', () => {
    const target = rivalTargetFareRatio('lcc', satisfactionFactor(90));
    const breakEvenFull = 0.55;
    const ai = [0, 1].map(() => ({ war: {} as PriceWarState, yieldPosition: 0, ratio: target, endedAt: -1 }));
    for (let month = 0; month < 36; month++) {
      for (const [i, me] of ai.entries()) {
        const other = ai[1 - i];
        const step = priceWarStep(me.war, {
          personality: 'lcc',
          month,
          routeAgeMonths: month,
          avgProfit: 500,
          lastRivalOpeningMonth: 0,
          undercutInEconomy: other.ratio < me.ratio,
          competitorPresent: true,
        });
        me.war = step.state;
        if (step.event === 'ended') me.endedAt = month;
        const war = inPriceWar(me.war);
        // Im Preiskampf leere Maschinen (Auslastung 50 %), danach üblich (80 %).
        me.yieldPosition = nextYieldPosition(me.yieldPosition, war ? 0.5 : 0.8);
        me.ratio = rivalFareRatio({ personality: 'lcc', target, yieldPosition: me.yieldPosition, priceWar: war, breakEvenFull });
        assert.ok(me.ratio >= rivalPriceFloor('lcc', war, breakEvenFull) - 1e-12);
        assert.ok(me.ratio >= target * (1 - YIELD_MAX) * (1 - PRICE_WAR_CUT) - 1e-12);
        if (me.endedAt >= 0 && month - me.endedAt >= Math.round(YIELD_MAX / FARE_STEP)) near(me.ratio, target, 1e-12);
      }
    }
    assert.ok(ai.every((a) => a.endedAt >= 0));
  });
});

describe('Abschnitt 7.7 Gründung und Startwerte', () => {
  it('7.7: gleiche Startkasse in Preisen von 1960 für eine KI von 1960 und von 2010', () => {
    const m2010 = 50 * 12;
    for (const s of RIVAL_STRENGTHS) {
      for (const noise of [-1, 0, 0.4, 1]) {
        near(rivalStartCash(s, 0, noise), rivalStartCash(s, m2010, noise) / costIndex(m2010), 1e-3);
      }
    }
    near(rivalStartCash('normal', 0, 1), 83e6, 1e-6);
  });

  it('7.7: Startausstattung am Drehkreuz wie der Spieler, Ruf 50', () => {
    const setup = rivalStartSetup();
    assert.equal(setup.managementTier, START_HUB_SETUP.managementTier);
    assert.equal(setup.slots, 0);
    assert.deepEqual(setup.desks, { normal: 1, self: 0 });
    assert.equal(setup.reputation, 50);
  });

  it('7.7: Startflotte: erstes Narrowbody, dann Regional; Easy nicht schwächer', () => {
    assert.deepEqual(startFleetKinds('easy'), ['narrowbody', 'regional']);
    assert.deepEqual(startFleetKinds('hard'), ['narrowbody', 'regional', 'regional', 'regional']);
  });

  it('7.7: Startflugzeug ist im Monat lieferbar, von der Bauart, wo es sie gibt', () => {
    for (const month of [0, M1990, M2015]) {
      for (const p of PERSONALITY_IDS) {
        for (const kind of ['narrowbody', 'regional'] as const) {
          const i = pickStartAircraft(p, kind, AIRCRAFT, month, () => 0.5);
          assert.ok(i >= 0);
          assert.ok(isOnMarket(AIRCRAFT[i], month));
          if (AIRCRAFT.some((a) => isOnMarket(a, month) && a.class.toLowerCase() === kind)) {
            assert.equal(AIRCRAFT[i].class.toLowerCase(), kind);
          }
        }
      }
    }
    assert.equal(pickStartAircraft('lcc', 'regional', [], 0, () => 0), -1);
  });

  it('7.7 (F50): nie Überschall als Startflugzeug, auch nicht in den Jahren der Concorde', () => {
    for (let month = 0; month < 12 * 60; month += 6) {
      for (const p of PERSONALITY_IDS) {
        for (const u of [0, 0.5, 0.99]) {
          const i = pickStartAircraft(p, 'narrowbody', AIRCRAFT, month, () => u);
          if (i >= 0) assert.ok(AIRCRAFT[i].cruiseSpeed <= SUPERSONIC_MIN_KMH, `${p} ${month}: ${AIRCRAFT[i].id}`);
        }
      }
    }
  });

  it('7.7: nie am Spieler-Drehkreuz, an KI-Drehkreuzen oder mit Spieler-Stufe 3; Größe 4, sonst 2', () => {
    const base: HubCandidate = { id: 'X', level: 5, demand: 100, playerHub: false, rivalHub: false, playerTier3: false };
    const list: HubCandidate[] = [
      { ...base, id: 'P', playerHub: true },
      { ...base, id: 'R', rivalHub: true },
      { ...base, id: 'T', playerTier3: true },
      { ...base, id: 'S', level: 3 },
      { ...base, id: 'B', level: 4, demand: 50 },
    ];
    assert.deepEqual(fictionalHubWeights(list), [0, 0, 0, 0, 50]);
    assert.deepEqual(fictionalHubWeights(list.slice(0, 4)), [0, 0, 0, 100]);
    assert.equal(mayFoundAt(list[2]), false);
    assert.equal(realRivalWeight(list[0]), 0);
    assert.equal(realRivalWeight({ ...base, demand: 400 }), 20);
  });

  it('7.7: Anteil erfundener wie heute; Nachrücken nur, wenn KI fehlen', () => {
    assert.equal(fictionalRivalCount(1, 0.3), 1);
    assert.equal(fictionalRivalCount(1, 0.5), 0);
    assert.equal(fictionalRivalCount(5, 0), 2);
    assert.equal(fictionalRivalCount(5, 0.99), 2);
    assert.equal(fictionalRivalCount(2, 0), 1);
    assert.equal(fictionalRivalCount(0, 0), 0);
    assert.equal(shouldRefill(3, 4, 0.1), true);
    assert.equal(shouldRefill(3, 4, 0.2), false);
    assert.equal(shouldRefill(4, 4, 0), false);
  });

  it('7.7: Wahl nach Gewichten', () => {
    assert.equal(weightedPick([0, 0], 0.5), -1);
    assert.equal(weightedPick([1, 3], 0.2), 0);
    assert.equal(weightedPick([1, 3], 0.3), 1);
    assert.equal(weightedPick([0, 2, 0], 0.999), 1);
  });
});
