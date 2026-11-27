import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeResearch, projectsForClasses, projectsOfRank, researchBlockerText } from './research';
import { MAX_RANK, RANKS, RESEARCH_PROJECTS } from '../model/constants';
import { researchPrice, researchSlots, researchStartBlocker, type ResearchState } from '../model/progress';

/** A development tree with nothing done or under way. */
const EMPTY_RESEARCH: ResearchState = { done: [], active: [] };

test('every project of the model table belongs to exactly one rank', () => {
  const shown = RANKS.flatMap(r => projectsOfRank(r.index).map(p => p.id));
  assert.equal(shown.length, RESEARCH_PROJECTS.length);
  assert.equal(new Set(shown).size, shown.length);
  for (const r of RANKS) assert.ok(projectsOfRank(r.index).length >= 3, `${r.title} has something to develop`);
});

test('the texts of a blocker follow the model check (6.9)', () => {
  const month = 240;
  const text = (state: ResearchState, id: string, rank: number, cash: number) =>
    researchBlockerText(researchStartBlocker(state, id, rank, cash, month), id, rank, researchPrice(id, month));
  assert.match(text(EMPTY_RESEARCH, 'class-narrowbody', 0, 1e12) ?? '', /Appears at the rank Regional Airline/);
  assert.match(text(EMPTY_RESEARCH, 'class-narrowbody', 2, 1e12) ?? '', /Needs "Regional aircraft class" first/);
  const afterRegional = { done: ['class-regional'], active: [] };
  assert.match(text(afterRegional, 'class-narrowbody', 2, 1) ?? '', /Costs \$[\d,]+; the airline has less/);
  assert.equal(text(afterRegional, 'class-narrowbody', 2, 1e12), null);
  const busy = { done: [], active: [{ id: 'eff-1', startMonth: 0 }, { id: 'sat-1', startMonth: 0 }] };
  assert.equal(busy.active.length, researchSlots(0));
  assert.match(text(busy, 'crew-1', 0, 1e12) ?? '', /Only 2 projects can run at once/);
  assert.match(text({ done: ['crew-1'], active: [] }, 'crew-1', 0, 1e12) ?? '', /Already finished/);
  assert.match(text({ done: [], active: [{ id: 'crew-1', startMonth: 0 }] }, 'crew-1', 0, 1e12) ?? '', /Already under way/);
});

test('the price is the model price with the cost index, not a yearly 4 %', () => {
  assert.notEqual(researchPrice('class-widebody', 0), 60_000_000);
  assert.equal(researchPrice('class-widebody', 0), 28_000_000);
});

test('the projects a fleet needs include the classes before the one it flies', () => {
  assert.deepEqual(projectsForClasses(new Set(['commuter'])), []);
  assert.deepEqual(projectsForClasses(new Set(['widebody'])).sort(), ['class-narrowbody', 'class-regional', 'class-widebody']);
  assert.deepEqual(projectsForClasses(new Set(['supersonic'])).sort(), ['class-narrowbody', 'class-regional', 'class-supersonic', 'class-widebody'], 'Supersonic needs Wide-body (E41)');
});

test('the saved state is cleaned', () => {
  assert.deepEqual(normalizeResearch(null), EMPTY_RESEARCH);
  const raw = {
    done: ['fuel-1', 'fuel-1', 'ghost', 5],
    active: [
      { id: 'fuel-1', startMonth: 4 }, { id: 'slots', startMonth: 9 }, { id: 'ghost', startMonth: 1 }, { id: 'academy' },
      { id: 'cabin', startMonth: 2.4 }, { id: 'planning', startMonth: 3 }, { id: 'eff-1', startMonth: 3 }, { id: 'sat-1', startMonth: 3 },
      { id: 'crew-1', startMonth: 3 }
    ]
  };
  const clean = normalizeResearch(raw);
  assert.deepEqual(clean.done, ['fuel-1']);
  assert.deepEqual(clean.active.map(a => a.id), ['slots', 'cabin', 'planning', 'eff-1', 'sat-1']);
  assert.equal(clean.active.length, researchSlots(MAX_RANK));
  assert.equal(clean.active[1].startMonth, 2);
});
