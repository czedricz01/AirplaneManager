/**
 * Development: the screen's side of the research tree (docs/neubau 6.8, 6.9).
 *
 * The tree itself (projects, ranks, prices, durations, chains, effects) is the model's table
 * `RESEARCH_PROJECTS` (`src/model/constants.ts`), and every rule (price with the cost index, start blocker,
 * research slots of the rank, progress) is a model function in `src/model/progress.ts`. This file only adds
 * what the screen needs on top: the texts of a blocker, the projects of a rank, a checked saved state and the
 * class projects a starting fleet needs.
 */
import { CLASS_RESEARCH, MAX_RANK, RESEARCH_PROJECTS, type ClassResearch, type ResearchProjectDef, type SizeClass } from '../model/constants';
import { rankDef, researchProject, researchSlots, type ResearchBlocker, type ResearchState } from '../model/progress';
import { formatCurrency } from './format';

export type { ResearchState } from '../model/progress';

const KNOWN = new Set(RESEARCH_PROJECTS.map((p) => p.id));

/** The projects that appear at a rank, in the order of the table (class project first). */
export function projectsOfRank(rank: number): ResearchProjectDef[] {
  return RESEARCH_PROJECTS.filter((p) => p.rank === rank);
}

/**
 * Why a project cannot start, as a sentence for the screen; `null` when it can (`blocker` from
 * `researchStartBlocker`). `price` is the project's price this month (`researchPrice`).
 */
export function researchBlockerText(blocker: ResearchBlocker | null, id: string, rank: number, price: number): string | null {
  if (blocker === null) return null;
  const project = researchProject(id);
  switch (blocker) {
    case 'done':
      return 'Already finished.';
    case 'running':
      return 'Already under way.';
    case 'rank':
      return `Appears at the rank ${rankDef(project.rank).title}.`;
    case 'requires':
      return `Needs "${project.requires ? researchProject(project.requires).title : ''}" first.`;
    case 'slots': {
      const limit = researchSlots(rank);
      return `Only ${limit} project${limit === 1 ? '' : 's'} can run at once at this rank.`;
    }
    case 'cash':
      return `Costs ${formatCurrency(price)}; the airline has less.`;
  }
}

/**
 * The saved state, checked: unknown projects dropped, a project never both done and under way, a start month
 * that is a whole month, at most as many running as the top rank allows.
 */
export function normalizeResearch(raw: unknown): ResearchState {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const done = Array.isArray(src.done) ? [...new Set(src.done.filter((id): id is string => typeof id === 'string' && KNOWN.has(id)))] : [];
  const active = (Array.isArray(src.active) ? src.active : [])
    .filter((a): a is { id: string; startMonth: number } => {
      const r = a as Record<string, unknown> | null;
      return !!r && typeof r.id === 'string' && KNOWN.has(r.id) && Number.isFinite(r.startMonth) && !done.includes(r.id);
    })
    .slice(0, researchSlots(MAX_RANK))
    .map((a) => ({ id: a.id, startMonth: Math.round(a.startMonth) }));
  return { done, active };
}

/** The class projects a fleet needs: those of the classes it flies and every class before them in the chain. */
export function projectsForClasses(classes: ReadonlySet<SizeClass>): string[] {
  const out = new Set<string>();
  for (const sizeClass of classes) {
    let current: SizeClass | null = sizeClass;
    while (current !== null && current !== 'commuter') {
      const project: ClassResearch = CLASS_RESEARCH[current];
      out.add(project.id);
      current = project.requires;
    }
  }
  return [...out];
}
