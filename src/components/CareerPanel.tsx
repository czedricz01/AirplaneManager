import React from 'react';
import { Check, ChevronLeft, ChevronRight, Lock, Plane, X } from 'lucide-react';
import { Panel } from './ui/Panel';
import { Badge, type BadgeTone } from './ui/Badge';
import { Button } from './ui/Button';
import { Details } from './ui/Details';
import { RANKS, rankDef, rankUnlockLines } from '../lib/airlineRank';
import { AIRCRAFT_CLASSES, openClasses } from '../lib/aircraftClasses';
import {
  TRACK_LABELS,
  describeReward,
  type MilestoneDef,
  type MilestonePerks,
  type MilestoneTier,
  type MilestoneTrack
} from '../lib/milestones';
import { describeGoal, goalOfferLines, type AnnualGoal, type GoalOffer } from '../lib/annualGoals';
import { researchBlockerText, type ResearchState } from '../lib/research';
import { researchTreeLayout, type TreeLayout, type TreeNode } from '../lib/researchTree';
import {
  COST_RESEARCH_KINDS,
  MILESTONES,
  RAMP_START,
  RANK_AVERAGE_MONTHS,
  RESEARCH_PROJECTS,
  type CostResearchKind,
  type RankRequirement,
  type ResearchProjectDef
} from '../model/constants';
import {
  effectiveRank,
  goalFraction,
  goalValue,
  milestoneRequirementText,
  rankProgress,
  researchEffectLines,
  researchEffects,
  researchPrice,
  researchProgress,
  researchProject,
  researchSlots,
  researchStartBlocker,
  type RankStats,
  type ResearchEffects,
  type YearSnapshot
} from '../model/progress';
import type { HallOfFameEntry, ScoreBreakdown } from '../lib/careerScore';
import { formatCurrency, formatNumber, formatMoneyCompact as compact } from '../lib/format';

export interface CareerPanelProps {
  /** Free Mode: a Global Player from the start, no rank to earn. */
  free: boolean;
  rank: number;
  /** Rank figures of the last closed months (model 6.7), oldest first; the next close averages the same. */
  rankHistory: readonly RankStats[];
  /** Closed months behind `rankHistory`, at most `RANK_AVERAGE_MONTHS`; 0 before the first month-end. */
  closedMonths: number;
  perks: MilestonePerks;
  milestones: string[];
  annualGoal: AnnualGoal | null;
  goalOffer: GoalOffer | null;
  /** The current year as it stands, for the progress of the chosen goal. */
  goalSnapshot: YearSnapshot | null;
  onChooseGoal: (goal: AnnualGoal) => void;
  research: ResearchState;
  capital: number;
  currentDateOffset: number;
  onStartResearch: (projectId: string) => void;
  score: ScoreBreakdown;
  /** The hall of this game's mode (E43: Normal and Free Mode apart). */
  hall: readonly HallOfFameEntry[];
  /** Files the career in the hall of fame and shows the final report. */
  onRetire: () => void;
}

const TIER_TONE: Record<MilestoneTier, BadgeTone> = { bronze: 'warn', silver: 'neutral', gold: 'yellow', feat: 'good' };
const TIER_LABEL: Record<MilestoneTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', feat: 'Feat' };

const TRACK_ORDER: MilestoneTrack[] = ['network', 'fleet', 'passengers', 'reach', 'finance', 'standing', 'hub', 'feats'];

const countLabel = (n: number) => formatNumber(Math.round(n));

/** 8,000 -> "8k", 1,200,000 -> "1.2M". */
const paxLabel = (n: number) =>
  n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n);

/** A bar with a label, for requirements and goal progress. */
function Bar({ fraction, good }: { fraction: number; good?: boolean }) {
  return (
    <div className="w-full h-1.5 bg-raised overflow-hidden" role="presentation">
      <div className={`h-full ${good ? 'bg-good' : 'bg-accent'}`} style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }} />
    </div>
  );
}

const RANK_LINE_LABELS: Record<keyof RankRequirement, string> = {
  routes: 'Routes',
  monthlyPax: 'Passengers per month',
  reputation: 'Reputation',
  regions: 'Regions served'
};

function RankSection({ rank, history, closedMonths, perks, free }: { rank: number; history: readonly RankStats[]; closedMonths: number; perks: MilestonePerks; free: boolean }) {
  const def = rankDef(rank);
  // The same 3-month means the month close checks (model 6.7, E40); missing months count as 0.
  const progress = free || history.length === 0 ? null : rankProgress(rank, history);
  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <span className="text-2xs uppercase tracking-label text-muted font-semibold">Airline rank</span>
        <span className="text-2xs font-mono text-muted">
          {free ? 'hubs unlimited' : `hubs ${def.maxHubs + perks.extraHubs}`} · slots {Math.round((1 - perks.slotPriceFactor) * 100)}% cheaper
        </span>
      </div>

      {free ? (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-xl font-semibold text-accent">Free Mode</span>
            <Badge tone="yellow">Global Player</Badge>
          </div>
          <p className="text-2xs text-muted leading-relaxed max-w-2xl">
            There is no rank to earn in Free Mode: every airport, every aircraft class and every development project is
            open from the first month, and the number of hubs is not limited. Start a game in Normal Mode to climb
            the ten ranks instead.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-xl font-semibold text-accent">{def.title}</span>
            <Badge tone="yellow">Rank {def.index + 1} of {RANKS.length}</Badge>
            <Badge>Airports up to level {def.maxAirportLevel}</Badge>
          </div>

          {progress ? (
            <div className="mb-4">
              <div className="flex justify-between text-2xs font-label uppercase tracking-label text-muted mb-1">
                <span>Next: {progress.next.title}</span>
                <span>{Math.round(progress.fraction * 100)}%</span>
              </div>
              <Bar fraction={progress.fraction} />
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-3">
                {progress.lines.map(line => (
                  <li key={line.key} className="flex items-center justify-between text-2xs">
                    <span className={line.met ? 'text-good' : 'text-muted'}>
                      {line.met ? '✓ ' : '○ '}{RANK_LINE_LABELS[line.key]}
                    </span>
                    <span className={line.met ? 'text-good' : 'text-muted'}>
                      {countLabel(line.current)} / {countLabel(line.target)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-2xs text-muted mt-2">
                Averages of the last {RANK_AVERAGE_MONTHS} closed months, missing months counting as nothing. Every figure
                has to be met at once. A rank once reached is never lost.
              </p>
              {closedMonths < RANK_AVERAGE_MONTHS && (
                <p className="text-2xs text-muted mt-1">
                  {closedMonths === 0
                    ? `No month has been closed yet, so every figure still reads 0; the first month-end counts as one of ${RANK_AVERAGE_MONTHS}.`
                    : `${closedMonths} of ${RANK_AVERAGE_MONTHS} months closed so far: the figures are still diluted by the months before the start.`}
                </p>
              )}
            </div>
          ) : (
            <p className="text-2xs text-muted mb-4">The highest rank there is. Nothing is left to unlock.</p>
          )}

          <Details summary={`All ranks (${RANKS.length})`}>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {RANKS.map(r => {
              const reached = r.index <= rank;
              return (
                <li
                  key={r.index}
                  className={`p-2 border rounded-sm text-2xs font-mono leading-relaxed ${
                    reached ? 'border-good/40 bg-good/5 text-ink' : 'border-line bg-surface text-muted'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold uppercase tracking-label">
                    {reached ? <Check size={12} className="text-good" aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
                    {r.title}
                  </div>
                  {r.index > 0 && (
                    <div className="pl-5 text-2xs text-muted">
                      {countLabel(r.requires.routes)} routes · {paxLabel(r.requires.monthlyPax)} pax/month · reputation {r.requires.reputation}
                      {r.requires.regions > 1 ? ` · ${r.requires.regions} regions` : ''}
                    </div>
                  )}
                  <ul className="pl-5 mt-1 list-disc">
                    {rankUnlockLines(r.index).map(u => <li key={u}>{u}</li>)}
                  </ul>
                </li>
              );
            })}
          </ol>
          </Details>
        </>
      )}
    </Panel>
  );
}

export function GoalCard({ goal, onChoose }: { goal: AnnualGoal; onChoose?: () => void }) {
  const tone: BadgeTone = goal.tag === 'stretch' ? 'warn' : goal.tag === 'steady' ? 'good' : 'yellow';
  const tagLabel = goal.tag === 'stretch' ? 'Stretch' : goal.tag === 'steady' ? 'Steady' : 'Focus';
  return (
    <div className="flex flex-col gap-2 p-3 border border-line bg-surface rounded-sm">
      <Badge tone={tone} className="self-start">{tagLabel}</Badge>
      <div className="text-sm font-semibold leading-snug">{describeGoal(goal, formatCurrency, countLabel)}</div>
      <div className="text-2xs text-muted leading-relaxed">
        {/* Money only, from and to cash, not the profit (docs/neubau 6.11, E58). */}
        Met: bonus {compact(goal.reward)}.
        <br />
        Missed: penalty {compact(goal.penalty)}.
      </div>
      {onChoose && (
        <Button variant="primary" onClick={onChoose} className="mt-auto">Choose this goal</Button>
      )}
    </div>
  );
}

function GoalSection({ annualGoal, goalOffer, goalSnapshot, onChooseGoal }: Pick<CareerPanelProps, 'annualGoal' | 'goalOffer' | 'goalSnapshot' | 'onChooseGoal'>) {
  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-2xs uppercase tracking-label text-muted font-semibold">The board&apos;s goal</span>
        {annualGoal && <span className="text-2xs font-mono text-muted">{annualGoal.year}</span>}
      </div>

      {goalOffer ? (
        <>
          <p className="text-2xs text-muted leading-relaxed mb-3 max-w-2xl">
            {goalOfferLines(goalOffer).intro} {goalOfferLines(goalOffer).deadline}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {goalOffer.options.map((g, i) => <GoalCard key={`${g.kind}-${i}`} goal={g} onChoose={() => onChooseGoal(g)} />)}
          </div>
        </>
      ) : annualGoal ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <GoalCard goal={annualGoal} />
          {goalSnapshot && (() => {
            const fraction = goalFraction(annualGoal, goalSnapshot);
            const value = goalValue(annualGoal, goalSnapshot);
            const shown = annualGoal.kind === 'profit' ? compact(value)
              : annualGoal.kind === 'noLoss' ? `${value} loss month${value === 1 ? '' : 's'}`
              : countLabel(value);
            return (
              <div>
                <div className="flex justify-between text-2xs font-label uppercase tracking-label text-muted mb-1">
                  <span>So far this year</span>
                  <span>{shown}{annualGoal.kind === 'noLoss' ? '' : ` of ${annualGoal.kind === 'profit' ? compact(annualGoal.target) : countLabel(annualGoal.target)}`}</span>
                </div>
                <Bar fraction={fraction} good={fraction >= 1} />
              </div>
            );
          })()}
        </div>
      ) : (
        <p className="text-2xs text-muted">
          No goal yet. The board sets its first once a full year has been closed in December.
        </p>
      )}
    </Panel>
  );
}

const COST_SHORT: Record<CostResearchKind, string> = {
  fuel: 'fuel',
  crew: 'crews',
  fees: 'airport charges',
  catering: 'catering',
  maintenance: 'maintenance',
  slots: 'slots'
};

/** What the finished projects add up to (model `researchEffects`), one short phrase each, only those that do something. */
function effectLines(fx: ResearchEffects): string[] {
  const pct = (share: number) => `${Math.round(share * 1000) / 10}%`;
  const lines: string[] = [];
  if (fx.efficiencyPoints > 0) lines.push(`aircraft efficiency +${fx.efficiencyPoints}`);
  if (fx.satisfactionPoints > 0) lines.push(`satisfaction +${fx.satisfactionPoints}`);
  for (const kind of COST_RESEARCH_KINDS) if (fx.costFactor[kind] < 1) lines.push(`${COST_SHORT[kind]} −${pct(1 - fx.costFactor[kind])}`);
  if (fx.demandFactor > 1) lines.push(`demand +${pct(fx.demandFactor - 1)}`);
  if (fx.hubQualityFactor > 1) lines.push(`hub quality +${pct(fx.hubQualityFactor - 1)}`);
  if (fx.rampBonus > 0) lines.push(`new routes start at ${pct(RAMP_START + fx.rampBonus)}`);
  if (fx.defectFactor < 1) lines.push(`defects −${pct(1 - fx.defectFactor)}`);
  if (fx.wearFactor < 1) lines.push(`wear −${pct(1 - fx.wearFactor)}`);
  if (fx.resaleBonus > 0) lines.push(`resale +${pct(fx.resaleBonus)}`);
  if (fx.moralePoints > 0) lines.push(`morale +${fx.moralePoints}`);
  return lines;
}

function ProjectCard({
  project, research, rank, capital, month, onStart
}: {
  project: ResearchProjectDef; research: ResearchState; rank: number; capital: number; month: number;
  onStart: (id: string) => void;
}) {
  const done = research.done.includes(project.id);
  const running = research.active.find(a => a.id === project.id);
  const price = researchPrice(project.id, month);
  const blocker = !done && !running
    ? researchBlockerText(researchStartBlocker(research, project.id, rank, capital, month), project.id, rank, price)
    : null;
  const progress = running ? researchProgress(running, month) : null;
  const isClass = project.kind === 'class';
  return (
    <div
      className={`flex flex-col gap-2 p-3 border rounded-sm ${
        done ? 'border-good/40 bg-good/5'
          : running ? 'border-accent/40 bg-accent/5'
          : isClass ? 'border-accent/30 bg-surface'
          : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{project.title}</span>
        {done ? <Badge tone="good">Done</Badge> : running ? <Badge tone="yellow">Running</Badge> : <Badge>{project.months} months</Badge>}
      </div>
      {isClass && <Badge tone="yellow" className="self-start">Aircraft class</Badge>}
      <p className="text-2xs text-muted leading-relaxed">{researchEffectLines(project.id).join('. ')}.</p>
      {progress && (
        <div>
          <div className="flex justify-between text-2xs font-label uppercase tracking-label text-muted mb-1">
            <span>{progress.monthsDone} of {project.months} months</span>
            <span>{Math.round(progress.fraction * 100)}%</span>
          </div>
          <Bar fraction={progress.fraction} />
        </div>
      )}
      {!done && !running && (
        <div className="flex items-center justify-between gap-2 mt-auto">
          <span className="text-2xs font-mono text-muted">
            {blocker ?? `Cost ${formatCurrency(price)}`}
          </span>
          <Button variant="primary" disabled={!!blocker} onClick={() => onStart(project.id)}>
            {formatCurrency(price)}
          </Button>
        </div>
      )}
      {project.requires && !done && (
        <span className="text-2xs font-mono text-muted">after {researchProject(project.requires).title}</span>
      )}
    </div>
  );
}

/** Size of the tree in pixels: a project box, the gap between columns and rows, the rank header. */
const NODE_W = 172;
const NODE_H = 56;
const GAP_X = 44;
const GAP_Y = 14;
const HEAD_H = 40;
const PITCH_X = NODE_W + GAP_X;
const PITCH_Y = NODE_H + GAP_Y;

type NodeState = 'done' | 'running' | 'open' | 'waiting' | 'locked';

/** The state of a project in the tree: finished, running, can start, could start but for slots or money, closed. */
function nodeState(project: ResearchProjectDef, research: ResearchState, rank: number, capital: number, month: number): NodeState {
  if (research.done.includes(project.id)) return 'done';
  if (research.active.some(a => a.id === project.id)) return 'running';
  const blocker = researchStartBlocker(research, project.id, rank, capital, month);
  if (blocker === null) return 'open';
  return blocker === 'rank' || blocker === 'requires' ? 'locked' : 'waiting';
}

const NODE_CLASS: Record<NodeState, string> = {
  done: 'border-good bg-good/10 text-ink',
  running: 'border-accent bg-accent/10 text-ink',
  open: 'border-accent/70 bg-surface text-ink hover:bg-raised',
  waiting: 'border-rule bg-surface text-ink hover:bg-raised',
  locked: 'border-line bg-ground text-muted opacity-60 hover:opacity-90'
};

function TreeNodeBox({
  node, state, selected, research, month, onSelect
}: {
  node: TreeNode; state: NodeState; selected: boolean; research: ResearchState; month: number;
  onSelect: (id: string) => void;
}) {
  const p = node.project;
  const running = research.active.find(a => a.id === p.id);
  const progress = running ? researchProgress(running, month) : null;
  const isClass = p.kind === 'class';
  return (
    <button
      type="button"
      onClick={() => onSelect(p.id)}
      aria-pressed={selected}
      aria-label={`${p.title}, ${state === 'open' ? 'can start' : state}`}
      className={`absolute flex flex-col justify-between text-left px-2 py-1.5 border rounded-sm transition-colors ${
        isClass ? 'border-2' : ''
      } ${NODE_CLASS[state]} ${selected ? 'ring-2 ring-accent ring-offset-1 ring-offset-ground' : ''}`}
      style={{ left: node.col * PITCH_X, top: HEAD_H + node.row * PITCH_Y, width: NODE_W, height: NODE_H }}
    >
      <span className="flex items-start gap-1.5 text-2xs font-semibold leading-tight">
        {isClass && <Plane size={12} className="shrink-0 mt-px text-accent" aria-hidden="true" />}
        <span className="line-clamp-2">{p.title}</span>
      </span>
      {progress ? (
        <span className="flex items-center gap-2 text-2xs font-mono text-accent">
          <span className="shrink-0">{progress.monthsDone}/{p.months} mo</span>
          <Bar fraction={progress.fraction} />
        </span>
      ) : (
        <span className="flex items-center gap-1 text-2xs font-mono text-muted">
          {state === 'done' ? <Check size={11} className="text-good" aria-hidden="true" />
            : state === 'locked' ? <Lock size={11} aria-hidden="true" /> : null}
          {state === 'done' ? 'Done' : `${p.months} mo · ${compact(researchPrice(p.id, month))}`}
        </span>
      )}
    </button>
  );
}

/** The lines from each project to its successors: right out of the box, down or up in the gap, into the next box. */
function TreeEdges({ layout, done }: { layout: TreeLayout; done: ReadonlySet<string> }) {
  const at = new Map(layout.nodes.map(n => [n.project.id, n]));
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={layout.cols * PITCH_X}
      height={HEAD_H + layout.rows * PITCH_Y}
      aria-hidden="true"
    >
      <defs>
        {(['line', 'good'] as const).map(c => (
          <marker key={c} id={`tree-arrow-${c}`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill={`var(--color-${c === 'line' ? 'rule' : 'good'})`} />
          </marker>
        ))}
      </defs>
      {layout.edges.map(e => {
        const a = at.get(e.from)!;
        const b = at.get(e.to)!;
        const x1 = a.col * PITCH_X + NODE_W;
        const y1 = HEAD_H + a.row * PITCH_Y + NODE_H / 2;
        const x2 = b.col * PITCH_X - 1;
        const y2 = HEAD_H + b.row * PITCH_Y + NODE_H / 2;
        const xm = x1 + GAP_X / 2;
        const lit = done.has(e.from);
        return (
          <path
            key={`${e.from}-${e.to}`}
            d={y1 === y2 ? `M${x1},${y1} H${x2}` : `M${x1},${y1} H${xm} V${y2} H${x2}`}
            fill="none"
            stroke={lit ? 'var(--color-good)' : 'var(--color-rule)'}
            strokeWidth={lit ? 2 : 1.5}
            markerEnd={`url(#tree-arrow-${lit ? 'good' : 'line'})`}
          />
        );
      })}
    </svg>
  );
}

function ResearchSection({ research, rank, free, capital, currentDateOffset, onStartResearch }: Pick<CareerPanelProps, 'research' | 'rank' | 'free' | 'capital' | 'currentDateOffset' | 'onStartResearch'>) {
  const rankNow = effectiveRank(free ? 'free' : 'normal', rank);
  const fx = React.useMemo(() => researchEffects(research.done), [research.done]);
  const lines = effectLines(fx);
  const open = openClasses(research.done, [], free ? 'free' : 'normal');
  const limit = researchSlots(rankNow);
  const layout = React.useMemo(() => researchTreeLayout(), []);
  const done = React.useMemo(() => new Set(research.done), [research.done]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const scroller = React.useRef<HTMLDivElement>(null);
  // Open the tree at the current rank, with the rank before it still in view.
  React.useEffect(() => {
    if (scroller.current && !free) scroller.current.scrollLeft = Math.max(0, rank - 1) * PITCH_X;
  }, [free, rank]);
  // Drag with the mouse to move the tree (touch screens scroll on their own). A drag is not a click on a project.
  const drag = React.useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !scroller.current) return;
    drag.current = { x: e.clientX, y: e.clientY, left: scroller.current.scrollLeft, top: scroller.current.scrollTop, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !scroller.current) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dx) + Math.abs(dy) < 5) return;
      d.moved = true;
      // Keep the drag going when the mouse leaves the tree's frame.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    scroller.current.scrollLeft = d.left - dx;
    scroller.current.scrollTop = d.top - dy;
  };
  const endDrag = () => {
    // Keep the flag until the click that follows the release has been swallowed.
    if (drag.current?.moved) window.setTimeout(() => { drag.current = null; }, 0);
    else drag.current = null;
  };
  const swallowClickAfterDrag = (e: React.MouseEvent) => {
    if (drag.current?.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  const scrollBy = (cols: number) => scroller.current?.scrollBy({ left: cols * PITCH_X, behavior: 'smooth' });
  const selectedProject = selected ? RESEARCH_PROJECTS.find(p => p.id === selected) ?? null : null;
  const width = layout.cols * PITCH_X - GAP_X;
  const height = HEAD_H + layout.rows * PITCH_Y - GAP_Y;
  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-2xs uppercase tracking-label text-muted font-semibold">Development</span>
        <span className="text-2xs font-mono text-muted">
          {research.done.length} / {RESEARCH_PROJECTS.length} done · {research.active.length} / {limit} running
        </span>
      </div>
      <Details summary="How development works" className="mb-3">
      <p className="text-2xs text-muted leading-relaxed max-w-3xl">
        One column per rank. Top row: the aircraft classes, needed before their aircraft can be bought. Below: chains
        of small bonuses; an arrow means the project needs the one before it. A project costs money at once and takes
        months. {free ? 'Every project is open in Free Mode.' : 'Higher ranks allow more to run at once.'} Click a
        project to see it and start it.
      </p>
      </Details>

      <div className="flex flex-wrap gap-1.5 mb-3" aria-label="Aircraft classes">
        {AIRCRAFT_CLASSES.map(c => (
          <Badge key={c.id} tone={open.has(c.id) ? 'good' : 'neutral'} title={c.detail}>
            {open.has(c.id) ? '✓ ' : '🔒 '}{c.title.replace(' aircraft', '')}
          </Badge>
        ))}
      </div>

      {lines.length > 0 && (
        <Details summary={`Bonuses in effect (${lines.length})`} className="mb-3">
          <p className="text-2xs text-good leading-relaxed">{lines.join(' · ')}</p>
        </Details>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-2 text-2xs text-muted" aria-label="Legend">
        <span className="flex items-center gap-1"><span className="w-3 h-3 border border-good bg-good/10" />Done</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 border border-accent bg-accent/10" />Running</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 border border-accent/70" />Can start</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 border border-rule" />No slot or money</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 border border-line opacity-60" />Closed</span>
        <span className="ml-auto flex items-center gap-1">
          <span className="hidden sm:inline">Drag or scroll sideways</span>
          <Button variant="secondary" onClick={() => scrollBy(-2)} aria-label="Earlier ranks"><ChevronLeft size={14} /></Button>
          <Button variant="secondary" onClick={() => scrollBy(2)} aria-label="Later ranks"><ChevronRight size={14} /></Button>
        </span>
      </div>

      <div className="relative">
      <div
        ref={scroller}
        className="overflow-auto max-h-[75vh] border border-line bg-ground rounded-sm select-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={swallowClickAfterDrag}
      >
        <div className="relative m-3" style={{ width, height }}>
          {/* Rank columns: header and a band per column, the ranks reached a little lighter. */}
          {RANKS.slice(0, layout.cols).map(r => {
            const reached = free || r.index <= rank;
            const current = !free && r.index === rank;
            return (
              <div
                key={r.index}
                className={`absolute top-0 rounded-sm ${reached ? 'bg-surface/60' : ''} ${current ? 'outline outline-1 outline-accent/40' : ''}`}
                style={{ left: r.index * PITCH_X - GAP_X / 4, width: NODE_W + GAP_X / 2, height }}
              >
                <div className={`flex items-center gap-1 px-2 pt-1.5 text-2xs font-label uppercase tracking-label ${current ? 'text-accent' : 'text-muted'}`}>
                  {reached ? <Check size={11} className="text-good shrink-0" aria-hidden="true" /> : <Lock size={11} className="shrink-0" aria-hidden="true" />}
                  <span className="truncate">{r.title.replace(' Airline', '')}</span>
                </div>
              </div>
            );
          })}
          <TreeEdges layout={layout} done={done} />
          {layout.nodes.map(n => (
            <TreeNodeBox
              key={n.project.id}
              node={n}
              state={nodeState(n.project, research, rankNow, capital, currentDateOffset)}
              selected={selected === n.project.id}
              research={research}
              month={currentDateOffset}
              onSelect={id => setSelected(s => (s === id ? null : id))}
            />
          ))}
        </div>
      </div>

      {/* The selected project floats in the screen's corner, so the tree keeps the full width. */}
      {selectedProject && (
        <div className="fixed right-4 bottom-20 lg:bottom-4 z-30 w-[min(20rem,calc(100vw-2rem))] shadow-lg shadow-black/50">
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Close"
            className="absolute -top-2 -right-2 z-10 p-1 rounded-full border border-line bg-surface text-muted hover:text-ink"
          >
            <X size={12} />
          </button>
          <div className="bg-surface rounded-sm">
            <ProjectCard
              project={selectedProject}
              research={research}
              rank={rankNow}
              capital={capital}
              month={currentDateOffset}
              onStart={onStartResearch}
            />
          </div>
        </div>
      )}
      </div>
    </Panel>
  );
}

const SCORE_LINES: { key: keyof Omit<ScoreBreakdown, 'total'>; label: string }[] = [
  { key: 'wealth', label: 'Company value' },
  { key: 'rank', label: 'Rank' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'reputation', label: 'Reputation' },
  { key: 'takeovers', label: 'Takeovers' },
  { key: 'development', label: 'Bonus research' },
  { key: 'longevity', label: 'Years played' }
];

function ScoreSection({ score, hall, free, onRetire }: Pick<CareerPanelProps, 'score' | 'hall' | 'free' | 'onRetire'>) {
  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <span className="text-2xs uppercase tracking-label text-muted font-semibold">Career score</span>
        <span className="text-xl font-mono font-semibold text-accent tabular-nums">{formatNumber(score.total)}</span>
      </div>
      <Details summary="Score by part" className="mb-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SCORE_LINES.map(l => (
          <div key={l.key} className="border border-line bg-surface px-2 py-1.5">
            <div className="text-2xs font-label uppercase tracking-label text-muted">{l.label}</div>
            <div className="text-sm font-mono font-semibold tabular-nums">{formatNumber(score[l.key])}</div>
          </div>
        ))}
      </div>
      </Details>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-2xs text-muted leading-relaxed max-w-xl">
          The game has no end. Retire whenever you like: the career is filed in the hall of fame and you can play on.
        </p>
        <Button variant="secondary" onClick={onRetire}>Retire and file the career</Button>
      </div>
      {hall.length > 0 && (
        <div className="mt-4">
          <div className="text-2xs uppercase tracking-label text-muted font-semibold mb-1">Hall of fame · {free ? 'Free Mode' : 'Normal Mode'}</div>
          <ol className="flex flex-col gap-1">
            {hall.map((e, i) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-2xs border-b border-line py-1">
                <span className="truncate"><span className="text-muted">{i + 1}.</span> {e.airline}{e.code ? ` (${e.code})` : ''}</span>
                <span className="text-muted shrink-0">{e.years} yrs · {e.mode === 'free' ? 'Free Mode' : rankDef(e.rank).title.replace(' Airline', '')}</span>
                <span className="text-accent tabular-nums shrink-0">{formatNumber(e.score)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}

function MilestoneSection({ milestones, month }: { milestones: string[]; month: number }) {
  const earned = new Set(milestones);
  const byTrack = TRACK_ORDER.map(track => ({ track, list: MILESTONES.filter(m => m.track === track) }));
  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-2xs uppercase tracking-label text-muted font-semibold">Milestones</span>
        <span className="text-2xs font-mono text-muted">{milestones.filter(id => MILESTONES.some(m => m.id === id)).length} / {MILESTONES.length}</span>
      </div>
      <div className="flex flex-col gap-4">
        {byTrack.map(({ track, list }) => (
          <div key={track}>
            <div className="text-2xs uppercase tracking-label text-muted font-semibold mb-1">{TRACK_LABELS[track]}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {list.map((m: MilestoneDef) => {
                const done = earned.has(m.id);
                return (
                  <div
                    key={m.id}
                    className={`p-2 border rounded-sm text-2xs font-mono leading-relaxed ${
                      done ? 'border-good/40 bg-good/5 text-ink' : 'border-line bg-surface text-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 justify-between">
                      <span className="font-semibold uppercase tracking-label">
                        <span className={done ? 'text-good' : 'text-muted'}>{done ? '✓ ' : '○ '}</span>
                        {m.title}
                      </span>
                      <Badge tone={TIER_TONE[m.tier]}>{TIER_LABEL[m.tier]}</Badge>
                    </div>
                    <p className="mt-0.5">{milestoneRequirementText(m, month, compact)}</p>
                    <p className="mt-1 text-muted">{describeReward(m, month, compact)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** The three tabs of the Career screen. */
export type CareerPart = 'rank' | 'development' | 'goals';

/** One tab of the Career screen: rank (with score and milestones), development, or the board's goal. */
export function CareerPanel({ part, ...props }: CareerPanelProps & { part: CareerPart }) {
  return (
    <div className="flex flex-col gap-3">
      {part === 'rank' && (
        <>
          <RankSection rank={props.rank} history={props.rankHistory} closedMonths={props.closedMonths} perks={props.perks} free={props.free} />
          <ScoreSection score={props.score} hall={props.hall} free={props.free} onRetire={props.onRetire} />
          <MilestoneSection milestones={props.milestones} month={props.currentDateOffset} />
        </>
      )}
      {part === 'development' && (
        <ResearchSection
          research={props.research}
          rank={props.rank}
          free={props.free}
          capital={props.capital}
          currentDateOffset={props.currentDateOffset}
          onStartResearch={props.onStartResearch}
        />
      )}
      {part === 'goals' && (
        <GoalSection
          annualGoal={props.annualGoal}
          goalOffer={props.goalOffer}
          goalSnapshot={props.goalSnapshot}
          onChooseGoal={props.onChooseGoal}
        />
      )}
    </div>
  );
}
