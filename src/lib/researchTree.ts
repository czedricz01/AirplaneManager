/**
 * Layout of the development tree as a classic tech tree (screen only, no game rule).
 *
 * Columns are the ranks (left to right), each project sits in the column of the rank it appears at. A project
 * and its successors (`requires`) form a chain; the first successor stays on the row of its predecessor, every
 * further successor starts a branch on a row below. Chains and branches are packed tightly: each takes the first
 * row where it keeps one empty column to everything else on that row, so that a line never runs through a project
 * of another chain. The aircraft classes come first, then the long chains, then single projects.
 */
import { RESEARCH_PROJECTS, type ResearchProjectDef } from '../model/constants';

export interface TreeNode {
  readonly project: ResearchProjectDef;
  /** Column = rank. */
  readonly col: number;
  readonly row: number;
}

export interface TreeEdge {
  readonly from: string;
  readonly to: string;
}

export interface TreeLayout {
  readonly nodes: readonly TreeNode[];
  readonly edges: readonly TreeEdge[];
  readonly cols: number;
  readonly rows: number;
}

/** A straight run of projects on one row: a chain, or a branch of a chain (it starts at the gap after its parent). */
interface Segment {
  readonly ids: string[];
  /** First column the run takes; for a branch the column right after its parent, where its line comes in. */
  readonly from: number;
  readonly to: number;
  /** The segment this one branches off; `null` for the start of a chain. */
  readonly parent: Segment | null;
  readonly isClass: boolean;
  readonly chainSize: number;
  readonly order: number;
}

export function researchTreeLayout(projects: readonly ResearchProjectDef[] = RESEARCH_PROJECTS): TreeLayout {
  const byId = new Map(projects.map(p => [p.id, p]));
  const children = new Map<string, ResearchProjectDef[]>();
  for (const p of projects) {
    if (p.requires && byId.has(p.requires)) {
      const list = children.get(p.requires) ?? [];
      list.push(p);
      children.set(p.requires, list);
    }
  }
  // The successor reaching furthest stays on the row (keeps the long chain straight).
  const depth = (p: ResearchProjectDef): number => Math.max(p.rank, ...(children.get(p.id) ?? []).map(depth));
  for (const list of children.values()) list.sort((a, b) => depth(b) - depth(a) || a.rank - b.rank);
  const size = (p: ResearchProjectDef): number => 1 + (children.get(p.id) ?? []).reduce((n, c) => n + size(c), 0);

  // Cut every chain into segments: follow the first successor, every further one starts a new segment.
  const segments: Segment[] = [];
  const roots = projects.filter(p => !p.requires || !byId.has(p.requires));
  roots.forEach((root, order) => {
    const isClass = root.kind === 'class';
    const chainSize = size(root);
    const walk = (start: ResearchProjectDef, parent: Segment | null, from: number) => {
      const ids: string[] = [];
      const branches: ResearchProjectDef[] = [];
      let p: ResearchProjectDef | undefined = start;
      while (p) {
        ids.push(p.id);
        const next: ResearchProjectDef[] = children.get(p.id) ?? [];
        branches.push(...next.slice(1));
        p = next[0];
      }
      const seg: Segment = { ids, from, to: byId.get(ids[ids.length - 1])!.rank, parent, isClass, chainSize, order };
      segments.push(seg);
      for (const b of branches) walk(b, seg, byId.get(b.requires!)!.rank + 1);
    };
    walk(root, null, root.rank);
  });

  // The aircraft classes first, then the big chains; a branch right after the segment it leaves.
  const chainOrder = (s: Segment) => [Number(!s.isClass), -s.chainSize, s.order];
  const cmp = (a: Segment, b: Segment) => {
    const x = chainOrder(a);
    const y = chainOrder(b);
    for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  const queue = segments.filter(s => s.parent === null).sort(cmp);
  const ordered: Segment[] = [];
  const addWithBranches = (s: Segment) => {
    ordered.push(s);
    segments.filter(b => b.parent === s).forEach(addWithBranches);
  };
  queue.forEach(addWithBranches);

  // First fit: the first row where the segment keeps one empty column to every other; a branch below its parent.
  const taken: [number, number][][] = [];
  const rowOf = new Map<Segment, number>();
  const fits = (row: number, s: Segment) => (taken[row] ?? []).every(([lo, hi]) => s.to < lo - 1 || s.from > hi + 1);
  for (const s of ordered) {
    let row = s.parent ? rowOf.get(s.parent)! + 1 : 0;
    while (!fits(row, s)) row += 1;
    (taken[row] ??= []).push([s.from, s.to]);
    rowOf.set(s, row);
  }

  const nodes: TreeNode[] = [];
  for (const s of ordered) {
    for (const id of s.ids) {
      const project = byId.get(id)!;
      nodes.push({ project, col: project.rank, row: rowOf.get(s)! });
    }
  }

  const edges = projects
    .filter(p => p.requires && byId.has(p.requires))
    .map(p => ({ from: p.requires!, to: p.id }));
  return {
    nodes,
    edges,
    cols: Math.max(0, ...projects.map(p => p.rank)) + 1,
    rows: taken.length,
  };
}
