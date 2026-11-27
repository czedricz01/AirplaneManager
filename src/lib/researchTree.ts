/**
 * Layout of the development tree as a classic tech tree (screen only, no game rule).
 *
 * Columns are the ranks (left to right), each project sits in the column of the rank it appears at. A project
 * and its successors (`requires`) form a subtree; the first successor stays on the row of its predecessor, every
 * further successor opens a new row below. Whole subtrees are then packed into rows: a subtree takes the first
 * free rows where it does not touch another subtree (one empty column between them), so that a line never runs
 * through a project of another chain. The aircraft classes come first, then the long chains, then single projects.
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

interface Block {
  /** Row inside the block, per project id. */
  readonly rowOf: Map<string, number>;
  readonly height: number;
  readonly minCol: number;
  readonly maxCol: number;
  readonly isClass: boolean;
  readonly size: number;
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

  const roots = projects.filter(p => !p.requires || !byId.has(p.requires));
  const blocks: Block[] = roots.map((root, order) => {
    const rowOf = new Map<string, number>();
    let height = 0;
    let minCol = root.rank;
    let maxCol = root.rank;
    let size = 0;
    const place = (p: ResearchProjectDef, row: number) => {
      rowOf.set(p.id, row);
      size += 1;
      minCol = Math.min(minCol, p.rank);
      maxCol = Math.max(maxCol, p.rank);
      height = Math.max(height, row + 1);
      (children.get(p.id) ?? []).forEach((c, i) => place(c, i === 0 ? row : height));
    };
    place(root, 0);
    return { rowOf, height, minCol, maxCol, isClass: root.kind === 'class', size, order };
  });
  blocks.sort((a, b) => Number(b.isClass) - Number(a.isClass) || b.size - a.size || a.minCol - b.minCol || a.order - b.order);

  // Columns taken per row, as intervals [min, max].
  const taken: [number, number][][] = [];
  const fits = (row: number, b: Block) =>
    (taken[row] ?? []).every(([lo, hi]) => b.maxCol < lo - 1 || b.minCol > hi + 1);
  const nodes: TreeNode[] = [];
  for (const b of blocks) {
    let top = 0;
    while (![...Array(b.height).keys()].every(i => fits(top + i, b))) top += 1;
    for (let i = 0; i < b.height; i += 1) (taken[top + i] ??= []).push([b.minCol, b.maxCol]);
    for (const [id, row] of b.rowOf) {
      const project = byId.get(id)!;
      nodes.push({ project, col: project.rank, row: top + row });
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
