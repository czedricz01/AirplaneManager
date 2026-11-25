import React from 'react';
import { Check, Lock } from 'lucide-react';
import { Panel } from './ui/Panel';
import { Badge, type BadgeTone } from './ui/Badge';
import { Button } from './ui/Button';
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
import { projectsOfRank, researchBlockerText, type ResearchState } from '../lib/research';
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
  regions: 'Regions served',
  years: 'Years in business'
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
                has to be met at once; the years in business cannot be bought. A rank once reached is never lost.
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
                      {r.requires.regions > 1 ? ` · ${r.requires.regions} regions` : ''}{r.requires.years > 0 ? ` · ${r.requires.years} yrs` : ''}
                    </div>
                  )}
                  <ul className="pl-5 mt-1 list-disc">
                    {rankUnlockLines(r.index).map(u => <li key={u}>{u}</li>)}
                  </ul>
                </li>
              );
            })}
          </ol>
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

function ResearchSection({ research, rank, free, capital, currentDateOffset, onStartResearch }: Pick<CareerPanelProps, 'research' | 'rank' | 'free' | 'capital' | 'currentDateOffset' | 'onStartResearch'>) {
  const rankNow = effectiveRank(free ? 'free' : 'normal', rank);
  const fx = React.useMemo(() => researchEffects(research.done), [research.done]);
  const lines = effectLines(fx);
  const open = openClasses(research.done, [], free ? 'free' : 'normal');
  const limit = researchSlots(rankNow);
  const [showAll, setShowAll] = React.useState(false);
  // The ranks reached are shown in full, and the next one as a preview; the rest are folded into a line each.
  const shownRanks = RANKS.filter(r => showAll || r.index <= rank + 1);
  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-2xs uppercase tracking-label text-muted font-semibold">Development</span>
        <span className="text-2xs font-mono text-muted">
          {research.done.length} / {RESEARCH_PROJECTS.length} done · {research.active.length} / {limit} running
        </span>
      </div>
      <p className="text-2xs text-muted leading-relaxed mb-3 max-w-2xl">
        A tree that opens with the rank. Its main points are the aircraft classes: a class has to be developed before its
        aircraft can be bought. In between sit small bonuses, a percent at a time. Each project costs money at once and
        takes months; the price follows the cost index of the month it starts in.{' '}
        {free ? 'Every project is open in Free Mode.' : 'Higher ranks allow more to run at once.'}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3" aria-label="Aircraft classes">
        {AIRCRAFT_CLASSES.map(c => (
          <Badge key={c.id} tone={open.has(c.id) ? 'good' : 'neutral'} title={c.detail}>
            {open.has(c.id) ? '✓ ' : '🔒 '}{c.title.replace(' aircraft', '')}
          </Badge>
        ))}
      </div>

      {lines.length > 0 && (
        <p className="text-2xs text-good leading-relaxed mb-4">
          In effect: {lines.join(' · ')}
        </p>
      )}

      <div className="flex flex-col gap-5">
        {shownRanks.map(r => {
          const projects = projectsOfRank(r.index);
          if (projects.length === 0) return null;
          const reached = free || r.index <= rank;
          return (
            <section key={r.index} aria-label={r.title} className={reached ? '' : 'opacity-60'}>
              <div className="flex items-center gap-2 text-2xs font-label uppercase tracking-label text-muted mb-2">
                {reached ? <Check size={12} className="text-good" aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
                {r.title}{reached ? '' : ' · opens with this rank'}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {projects.map(p => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    research={research}
                    rank={rankNow}
                    capital={capital}
                    month={currentDateOffset}
                    onStart={onStartResearch}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {!free && rank + 1 < RANKS.length - 1 && (
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Hide the later ranks' : 'Show the whole tree'}
          </Button>
        </div>
      )}
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {SCORE_LINES.map(l => (
          <div key={l.key} className="border border-line bg-surface px-2 py-1.5">
            <div className="text-2xs font-label uppercase tracking-label text-muted">{l.label}</div>
            <div className="text-sm font-mono font-semibold tabular-nums">{formatNumber(score[l.key])}</div>
          </div>
        ))}
      </div>
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
