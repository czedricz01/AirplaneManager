/**
 * Tests für `src/lib/modelRivalProfile.ts` (Paket 4.7b): Steckbrief der KI-Persönlichkeiten und Frist bis zur
 * Auflösung aus dem Modell.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PERSONALITIES, PERSONALITY_IDS, PRICE_WAR_MIN_AGGRESSION, SALE_TO_LIQUIDATION_MONTHS } from '../model/constants';
import { RIVAL_HEALTHY, rivalDistressStep, type RivalDistressState } from '../model/rivalMonth';
import { closesToLiquidation, rivalProfile, rivalProfileLines } from './modelRivalProfile';

describe('Paket 4.7b: Steckbrief einer KI (7.4–7.10)', () => {
  it('Angriffslust und Preiskampf aus PERSONALITIES', () => {
    for (const id of PERSONALITY_IDS) {
      const p = rivalProfile(id);
      assert.equal(p.aggression, PERSONALITIES[id].aggression);
      assert.equal(p.priceWars, PERSONALITIES[id].aggression >= PRICE_WAR_MIN_AGGRESSION);
      assert.equal(p.fareFloor, PERSONALITIES[id].fareFloor);
    }
    assert.equal(rivalProfile('expansionist').aggression, 9);
    assert.equal(rivalProfile('optimizer').priceWars, false);
  });

  it('LCC: nur Economy mit 74 cm, keine Mahlzeiten, meidet Langstrecken; Boutique: alle Klassen, Lounge', () => {
    const lcc = rivalProfile('lcc');
    assert.deepEqual(lcc.classes, ['economy']);
    assert.equal(lcc.economyPitch, 74);
    assert.deepEqual(lcc.mealClasses, []);
    assert.equal(lcc.avoidsLongHaul, true);
    assert.equal(lcc.targets, 'leisure');
    const boutique = rivalProfile('boutique');
    assert.deepEqual(boutique.classes, ['economy', 'premium', 'business', 'first']);
    assert.equal(boutique.buildsLounge, true);
    assert.equal(boutique.targets, 'business');
    assert.deepEqual(rivalProfile('expansionist').mealClasses, ['premium', 'business']);
    assert.deepEqual(rivalProfile('expansionist').classes, ['economy', 'premium', 'business']);
  });

  it('Texte nennen die Werte des Modells (keine festen Aufschläge wie „+25 %“)', () => {
    const text = (id: Parameters<typeof rivalProfile>[0]) => Object.fromEntries(rivalProfileLines(rivalProfile(id)).map((l) => [l.label, l.value]));
    assert.equal(text('lcc')['Cabin plan'], 'Economy only, 74 cm pitch');
    assert.equal(text('lcc').Fares, '5% below what its passengers will pay for its service');
    assert.equal(text('lcc')['Price wars'], 'Cuts fares 12% on contested pairs, never below 60% of the market fare');
    assert.equal(text('lcc').Catering, 'No free meals');
    assert.equal(text('lcc').Network, 'Leisure destinations, mostly under 3,500 km, up to 3 hubs');
    assert.equal(text('optimizer').Fares, 'The most profitable fare for each cabin');
    assert.equal(text('optimizer')['Price wars'], 'Does not start price wars');
    assert.equal(text('boutique').Fares, 'What its passengers will pay for its service');
    assert.equal(text('flag').Catering, 'Meals in every cabin');
    assert.equal(text('expansionist').Catering, 'Meals in Premium, Business');
    assert.equal(text('optimizer')['New routes'], 'Judged after 3 months');
  });
});

describe('Paket 4.7b: Frist bis zur Auflösung (7.15)', () => {
  it('= Abschlüsse, nach denen rivalDistressStep auflöst, wenn die Kasse unter 0 bleibt', () => {
    let state: RivalDistressState = { ...RIVAL_HEALTHY, status: 'forSale' };
    for (let f = 0; f < SALE_TO_LIQUIDATION_MONTHS; f++) {
      assert.equal(state.forSaleMonths, f);
      const left = closesToLiquidation(state.forSaleMonths);
      let s: RivalDistressState = state;
      for (let i = 0; i < left; i++) {
        assert.notEqual(s.status, 'liquidated');
        s = rivalDistressStep(s, { cash: -1, creditLimit: 1e9, aircraftCount: 3 }).state;
      }
      assert.equal(s.status, 'liquidated', `nach ${left} Abschlüssen aufgelöst (forSaleMonths ${f})`);
      state = rivalDistressStep(state, { cash: -1, creditLimit: 1e9, aircraftCount: 3 }).state;
    }
  });
});
