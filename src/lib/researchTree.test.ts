import test from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH_PROJECTS } from '../model/constants';
import { researchTreeLayout } from './researchTree';

const layout = researchTreeLayout();
const at = new Map(layout.nodes.map(n => [n.project.id, n]));

test('every project is placed once, in the column of its rank', () => {
  assert.equal(layout.nodes.length, RESEARCH_PROJECTS.length);
  assert.equal(at.size, RESEARCH_PROJECTS.length);
  for (const n of layout.nodes) assert.equal(n.col, n.project.rank);
});

test('no two projects share a cell', () => {
  const cells = new Set(layout.nodes.map(n => `${n.col}:${n.row}`));
  assert.equal(cells.size, layout.nodes.length);
});

test('one edge per prerequisite, always pointing to a later column', () => {
  assert.equal(layout.edges.length, RESEARCH_PROJECTS.filter(p => p.requires).length);
  for (const e of layout.edges) assert.ok(at.get(e.from)!.col < at.get(e.to)!.col, `${e.from} -> ${e.to}`);
});

test('the aircraft classes form the top of the tree', () => {
  assert.equal(at.get('class-regional')!.row, 0);
  assert.equal(at.get('class-jumbo')!.row, 0);
  assert.equal(at.get('class-supersonic')!.row, 1);
});

test('a chain stays on one row', () => {
  const rows = ['eff-1', 'eff-2', 'eff-3', 'eff-4', 'eff-5', 'eff-6'].map(id => at.get(id)!.row);
  assert.equal(new Set(rows).size, 1);
});

test('a line never crosses a project of another chain', () => {
  // A line runs on the row of its predecessor up to the column after it, then on the row of the successor.
  const occupied = new Map(layout.nodes.map(n => [`${n.col}:${n.row}`, n.project.id]));
  for (const e of layout.edges) {
    const a = at.get(e.from)!;
    const b = at.get(e.to)!;
    for (let c = a.col + 1; c < b.col; c += 1) {
      const there = occupied.get(`${c}:${b.row}`);
      assert.equal(there, undefined, `${e.from} -> ${e.to} crosses ${there}`);
    }
  }
});
