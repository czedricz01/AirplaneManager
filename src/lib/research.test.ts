import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CLASS_PROJECTS, EMPTY_RESEARCH, NEUTRAL_EFFECTS, PROJECTS, advanceResearch, boostedEfficiency, boostedPopularity,
  maxParallel, normalizeResearch, projectById, projectCost, projectProgress, projectsForClasses, projectsOfRank,
  researchEffects, startBlocker, startProject, startingResearch
} from './research';
import { MAX_RANK, RANKS } from './airlineRank';

test('the tree has unique ids, real prerequisites and sensible figures', () => {
  assert.ok(PROJECTS.length >= 40, 'a deep tree');
  assert.equal(new Set(PROJECTS.map(p => p.id)).size, PROJECTS.length);
  for (const p of PROJECTS) {
    assert.ok(p.baseCost > 0 && p.months >= 1, p.id);
    assert.ok(p.rank >= 0 && p.rank <= MAX_RANK, p.id);
    if (p.requires) {
      const need = projectById(p.requires);
      assert.ok(need, `${p.id} requires a project that exists`);
      assert.ok(need!.rank <= p.rank, `${p.id} does not appear before the project it needs`);
    }
  }
});

test('the five aircraft classes are the main points, a few ranks apart, each needing the one before', () => {
  assert.deepEqual(CLASS_PROJECTS.map(p => p.opens), ['regional', 'narrowbody', 'widebody', 'jumbo', 'supersonic']);
  for (let i = 1; i < CLASS_PROJECTS.length; i++) {
    assert.ok(CLASS_PROJECTS[i].rank > CLASS_PROJECTS[i - 1].rank);
    assert.equal(CLASS_PROJECTS[i].requires, CLASS_PROJECTS[i - 1].id);
    assert.ok(CLASS_PROJECTS[i].baseCost > CLASS_PROJECTS[i - 1].baseCost, 'each class costs more');
  }
  assert.equal(projectById('class-narrowbody')!.rank, RANKS.findIndex(r => r.id === 'domestic'));
});

test('between the classes sit small one-percent bonuses, opening rank by rank', () => {
  for (const id of ['eff-1', 'eff-2', 'eff-3', 'eff-4', 'eff-5', 'eff-6']) assert.equal(projectById(id)!.effect!.efficiency, 0.01, id);
  for (const id of ['sat-1', 'sat-2', 'sat-3', 'sat-4', 'sat-5', 'sat-6']) assert.equal(projectById(id)!.effect!.popularity, 0.01, id);
  assert.equal(projectById('eff-1')!.requires, undefined);
  assert.equal(projectById('eff-2')!.requires, 'eff-1', 'a chain');
  const ranks = ['eff-1', 'eff-2', 'eff-3', 'eff-4', 'eff-5', 'eff-6'].map(id => projectById(id)!.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), 'later links open at higher ranks');
  for (const r of RANKS) assert.ok(projectsOfRank(r.index).length >= 3, `${r.title} has something to develop`);
});

test('nothing done is neutral; each project does what it says', () => {
  assert.deepEqual(researchEffects([]), NEUTRAL_EFFECTS);
  assert.ok(Math.abs(researchEffects(['fuel-1', 'fuel-2']).fuelFactor - 0.94) < 1e-12);
  assert.ok(Math.abs(researchEffects(['yield-1', 'yield-2']).demandBonus - 0.04) < 1e-12);
  assert.equal(researchEffects(['maintenance']).defectFactor, 0.7);
  assert.equal(researchEffects(['academy']).moraleBonus, 5);
  assert.equal(researchEffects(['alliance']).transferBoost, 0.1);
  assert.equal(researchEffects(['slots']).slotFactor, 0.92);
  assert.equal(researchEffects(['cabin']).satBonus, 2);
  assert.equal(researchEffects(['planning']).rampStart, 0.75);
});

test('the new bonuses add up one percent at a time', () => {
  const fx = researchEffects(['eff-1', 'eff-2', 'eff-3', 'sat-1', 'sat-2', 'maint-1', 'maint-2', 'crew-1', 'fees-1', 'catering-1', 'wear-1', 'resale-1']);
  assert.ok(Math.abs(fx.efficiencyBonus - 0.03) < 1e-12);
  assert.ok(Math.abs(fx.popularityBonus - 0.02) < 1e-12);
  assert.ok(Math.abs(fx.maintenanceFactor - 0.98) < 1e-12);
  assert.ok(Math.abs(fx.crewFactor - 0.99) < 1e-12);
  assert.ok(Math.abs(fx.feeFactor - 0.99) < 1e-12);
  assert.ok(Math.abs(fx.cateringFactor - 0.98) < 1e-12);
  assert.ok(Math.abs(fx.wearFactor - 0.97) < 1e-12);
  assert.ok(Math.abs(fx.resaleBonus - 0.01) < 1e-12);
  const everything = researchEffects(PROJECTS.map(p => p.id));
  assert.ok(everything.fuelFactor >= 0.4 && everything.maintenanceFactor >= 0.4 && everything.wearFactor >= 0.4, 'savings are floored');
  assert.ok(everything.efficiencyBonus > 0.05 && everything.efficiencyBonus < 0.1);
});

test('an aircraft gets the bonus in points, never above 100 and never less than it had', () => {
  assert.equal(boostedEfficiency(60, { efficiencyBonus: 0.03 }), 63);
  assert.equal(boostedEfficiency(99, { efficiencyBonus: 0.03 }), 100);
  assert.equal(boostedEfficiency(60, { efficiencyBonus: 0 }), 60);
  assert.equal(boostedPopularity(70, { popularityBonus: 0.02 }), 72);
  assert.equal(boostedPopularity(99, { popularityBonus: 0.02 }), 100);
  assert.equal(boostedPopularity(70, { popularityBonus: 0 }), 70);
});

test('costs grow with the years', () => {
  const p = projectById('fuel-1')!;
  assert.equal(projectCost(p, 1960), p.baseCost);
  assert.ok(projectCost(p, 2000) > projectCost(p, 1980));
  assert.equal(projectCost(p, 1900), p.baseCost);
});

test('how many projects run at once grows with the rank', () => {
  assert.equal(maxParallel(0), 2);
  assert.ok(maxParallel(MAX_RANK) >= 4);
  for (let r = 1; r <= MAX_RANK; r++) assert.ok(maxParallel(r) >= maxParallel(r - 1));
});

test('a project cannot start without its rank, its prerequisite, cash or a free slot', () => {
  const narrow = projectById('class-narrowbody')!;
  assert.match(startBlocker(EMPTY_RESEARCH, narrow, 0, 1e12, 1980) ?? '', /Appears at the rank Domestic/);
  assert.match(startBlocker(EMPTY_RESEARCH, narrow, narrow.rank, 1e12, 1980) ?? '', /Needs "Regional aircraft class" first/);
  const afterRegional = { done: ['class-regional'], active: [] };
  assert.match(startBlocker(afterRegional, narrow, narrow.rank, 1, 1980) ?? '', /Costs/);
  assert.equal(startBlocker(afterRegional, narrow, narrow.rank, 1e12, 1980), null);
  assert.equal(startBlocker(afterRegional, narrow, MAX_RANK, 1e12, 1980), null, 'Free Mode is the top rank');
  const busy = { done: [], active: [{ id: 'eff-1', startedOffset: 0 }, { id: 'sat-1', startedOffset: 0 }] };
  assert.equal(busy.active.length, maxParallel(0));
  assert.match(startBlocker(busy, projectById('crew-1')!, 0, 1e9, 1980) ?? '', /at once/);
  assert.match(startBlocker({ done: ['crew-1'], active: [] }, projectById('crew-1')!, 0, 1e9, 1980) ?? '', /Already finished/);
});

test('a started project finishes after its months, and not before', () => {
  const p = projectById('slots')!;
  const state = startProject(EMPTY_RESEARCH, 'slots', 100);
  assert.equal(state.active.length, 1);
  assert.equal(startProject(state, 'slots', 101), state, 'starting twice changes nothing');
  assert.equal(advanceResearch(state, 100 + p.months - 1).completed.length, 0);
  const result = advanceResearch(state, 100 + p.months);
  assert.deepEqual(result.completed.map(c => c.id), ['slots']);
  assert.deepEqual(result.state, { done: ['slots'], active: [] });
  assert.equal(projectProgress(p, 100, 100 + p.months / 2).fraction, 0.5);
  assert.equal(projectProgress(p, 100, 400).fraction, 1);
});

test('a game starts with the classes its rank has opened', () => {
  assert.deepEqual(startingResearch(0), EMPTY_RESEARCH);
  assert.deepEqual(startingResearch(RANKS.findIndex(r => r.id === 'domestic')).done, ['class-regional', 'class-narrowbody']);
  assert.equal(startingResearch(MAX_RANK).done.length, CLASS_PROJECTS.length);
  assert.deepEqual(startingResearch(MAX_RANK).active, []);
});

test('the projects a fleet needs include the classes before the one it flies', () => {
  assert.deepEqual(projectsForClasses(new Set(['commuter'])), []);
  assert.deepEqual(projectsForClasses(new Set(['widebody'])).sort(), ['class-narrowbody', 'class-regional', 'class-widebody']);
});

test('the saved state is cleaned', () => {
  assert.deepEqual(normalizeResearch(null), EMPTY_RESEARCH);
  const raw = {
    done: ['fuel-1', 'fuel-1', 'ghost', 5],
    active: [{ id: 'fuel-1', startedOffset: 4 }, { id: 'slots', startedOffset: 9 }, { id: 'ghost', startedOffset: 1 }, { id: 'academy' }, { id: 'cabin', startedOffset: 2 }, { id: 'planning', startedOffset: 3 }]
  };
  const clean = normalizeResearch(raw);
  assert.deepEqual(clean.done, ['fuel-1']);
  assert.deepEqual(clean.active.map(a => a.id), ['slots', 'cabin', 'planning']);
});
