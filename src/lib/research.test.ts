import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_RESEARCH, MAX_PARALLEL, NEUTRAL_EFFECTS, PROJECTS, advanceResearch, normalizeResearch, projectById, projectCost,
  projectProgress, researchEffects, startBlocker, startProject
} from './research';

test('ten projects with unique ids, real prerequisites and sensible figures', () => {
  assert.equal(PROJECTS.length, 10);
  assert.equal(new Set(PROJECTS.map(p => p.id)).size, 10);
  for (const p of PROJECTS) {
    assert.ok(p.baseCost > 0 && p.months >= 1, p.id);
    if (p.requires) assert.ok(projectById(p.requires), `${p.id} requires a project that exists`);
  }
});

test('nothing done is neutral; each project does what it says', () => {
  assert.deepEqual(researchEffects([]), NEUTRAL_EFFECTS);
  assert.ok(Math.abs(researchEffects(['fuel-1', 'fuel-2']).fuelFactor - 0.97 * 0.97) < 1e-12);
  assert.equal(researchEffects(['yield-1', 'yield-2']).demandBonus, 0.04);
  assert.equal(researchEffects(['maintenance']).defectFactor, 0.7);
  assert.equal(researchEffects(['academy']).moraleBonus, 5);
  assert.equal(researchEffects(['alliance']).transferBoost, 0.1);
  assert.equal(researchEffects(['slots']).slotFactor, 0.92);
  assert.equal(researchEffects(['cabin']).satBonus, 2);
  assert.equal(researchEffects(['planning']).rampStart, 0.75);
});

test('costs grow with the years', () => {
  const p = projectById('fuel-1')!;
  assert.equal(projectCost(p, 1960), 4_000_000);
  assert.ok(projectCost(p, 2000) > projectCost(p, 1980));
  assert.equal(projectCost(p, 1900), 4_000_000);
});

test('a project cannot start without cash, rank, its prerequisite or a free slot', () => {
  const fuel2 = projectById('fuel-2')!;
  assert.match(startBlocker(EMPTY_RESEARCH, fuel2, 5, 1e12, 1980) ?? '', /Fleet fuel|Fuel management/);
  const afterFuel1 = { done: ['fuel-1'], active: [] };
  assert.match(startBlocker(afterFuel1, fuel2, 0, 1e12, 1980) ?? '', /rank National/);
  assert.match(startBlocker(afterFuel1, fuel2, 2, 1, 1980) ?? '', /Costs/);
  assert.equal(startBlocker(afterFuel1, fuel2, 2, 1e9, 1980), null);
  const busy = { done: [], active: [{ id: 'slots', startedOffset: 0 }, { id: 'academy', startedOffset: 0 }] };
  assert.equal(busy.active.length, MAX_PARALLEL);
  assert.match(startBlocker(busy, projectById('cabin')!, 5, 1e9, 1980) ?? '', /at once/);
  assert.match(startBlocker({ done: ['cabin'], active: [] }, projectById('cabin')!, 5, 1e9, 1980) ?? '', /Already finished/);
});

test('a started project finishes after its months, and not before', () => {
  const p = projectById('slots')!;
  let state = startProject(EMPTY_RESEARCH, 'slots', 100);
  assert.equal(state.active.length, 1);
  assert.equal(startProject(state, 'slots', 101), state, 'starting twice changes nothing');
  assert.equal(advanceResearch(state, 100 + p.months - 1).completed.length, 0);
  const result = advanceResearch(state, 100 + p.months);
  assert.deepEqual(result.completed.map(c => c.id), ['slots']);
  assert.deepEqual(result.state, { done: ['slots'], active: [] });
  assert.equal(projectProgress(p, 100, 103).fraction, 0.5);
  assert.equal(projectProgress(p, 100, 400).fraction, 1);
});

test('the saved state is cleaned', () => {
  assert.deepEqual(normalizeResearch(null), EMPTY_RESEARCH);
  const raw = {
    done: ['fuel-1', 'fuel-1', 'ghost', 5],
    active: [{ id: 'fuel-1', startedOffset: 4 }, { id: 'slots', startedOffset: 9 }, { id: 'ghost', startedOffset: 1 }, { id: 'academy' }, { id: 'cabin', startedOffset: 2 }, { id: 'planning', startedOffset: 3 }]
  };
  const clean = normalizeResearch(raw);
  assert.deepEqual(clean.done, ['fuel-1']);
  assert.deepEqual(clean.active.map(a => a.id), ['slots', 'cabin']);
});
