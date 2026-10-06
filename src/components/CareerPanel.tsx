import React from 'react';
import { Check, Lock } from 'lucide-react';
import { Panel } from './ui/Panel';
import { Badge, type BadgeTone } from './ui/Badge';
import { Button } from './ui/Button';
import { RANKS, rankDef, rankProgress, type RankStats } from '../lib/airlineRank';
import {
  MILESTONES,
  TRACK_LABELS,
  describeReward,
  type Milestone,
  type MilestonePerks,
  type MilestoneTier,
  type MilestoneTrack
} from '../lib/milestones';
import {
  describeGoal,
  goalFraction,
  goalValue,
  type AnnualGoal,
  type GoalOffer,
  type YearSnapshot
} from '../lib/annualGoals';
import { formatCurrency, formatNumber, formatMoneyCompact as compact } from '../lib/format';

export interface CareerPanelProps {
  rank: number;
  rankStats: RankStats;
  perks: MilestonePerks;
  milestones: string[];
  annualGoal: AnnualGoal | null;
  goalOffer: GoalOffer | null;
  /** The current year as it stands, for the progress of the chosen goal. */
  goalSnapshot: YearSnapshot | null;
  onChooseGoal: (goal: AnnualGoal) => void;
}

const TIER_TONE: Record<MilestoneTier, BadgeTone> = { bronze: 'warn', silver: 'neutral', gold: 'yellow', feat: 'good' };
const TIER_LABEL: Record<MilestoneTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', feat: 'Feat' };

const TRACK_ORDER: MilestoneTrack[] = ['network', 'fleet', 'passengers', 'reach', 'finance', 'standing', 'hub', 'feats'];

const countLabel = (n: number) => formatNumber(Math.round(n));

/** A bar with a label, for requirements and goal progress. */
function Bar({ fraction, good }: { fraction: number; good?: boolean }) {
  return (
    <div className="w-full h-1.5 bg-white/10 overflow-hidden" role="presentation">
      <div className={`h-full ${good ? 'bg-aero-good' : 'bg-aero-yellow'}`} style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }} />
    </div>
  );
}

function RankSection({ rank, stats, perks }: { rank: number; stats: RankStats; perks: MilestonePerks }) {
  const def = rankDef(rank);
  const progress = rankProgress(rank, stats);
  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <span className="text-2xs uppercase tracking-widest text-white/40 font-black">Airline rank</span>
        <span className="text-2xs font-mono text-white/40">
          hubs {def.maxHubs + perks.extraHubs} · slots {Math.round((1 - perks.slotPriceFactor) * 100)}% cheaper
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-xl font-black uppercase italic tracking-tight text-aero-yellow">{def.title}</span>
        <Badge tone="yellow">Rank {def.index + 1} of {RANKS.length}</Badge>
      </div>

      {progress ? (
        <div className="mb-4">
          <div className="flex justify-between text-2xs font-mono uppercase tracking-wider text-white/50 mb-1">
            <span>Next: {progress.next.title}</span>
            <span>{Math.round(progress.fraction * 100)}%</span>
          </div>
          <Bar fraction={progress.fraction} />
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-3">
            {progress.lines.map(line => (
              <li key={line.label} className="flex items-center justify-between text-2xs font-mono">
                <span className={line.met ? 'text-aero-good' : 'text-white/60'}>
                  {line.met ? '✓ ' : '○ '}{line.label}
                </span>
                <span className={line.met ? 'text-aero-good' : 'text-white/40'}>
                  {countLabel(line.current)} / {countLabel(line.target)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-2xs font-mono text-white/50 mb-4">The highest rank there is. Nothing is left to unlock.</p>
      )}

      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {RANKS.map(r => {
          const reached = r.index <= rank;
          return (
            <li
              key={r.id}
              className={`p-2 border rounded-sm text-2xs font-mono leading-relaxed ${
                reached ? 'border-aero-good/40 bg-aero-good/5 text-white/80' : 'border-white/5 bg-white/[0.02] text-white/40'
              }`}
            >
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                {reached ? <Check size={12} className="text-aero-good" aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
                {r.title}
              </div>
              <ul className="pl-5 mt-1 list-disc">
                {r.unlocks.map(u => <li key={u}>{u}</li>)}
              </ul>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

export function GoalCard({ goal, onChoose }: { goal: AnnualGoal; onChoose?: () => void }) {
  const tone: BadgeTone = goal.tag === 'stretch' ? 'warn' : goal.tag === 'steady' ? 'good' : 'yellow';
  const tagLabel = goal.tag === 'stretch' ? 'Stretch' : goal.tag === 'steady' ? 'Steady' : 'Focus';
  return (
    <div className="flex flex-col gap-2 p-3 border border-white/10 bg-white/[0.03] rounded-sm">
      <Badge tone={tone} className="self-start">{tagLabel}</Badge>
      <div className="text-sm font-bold leading-snug">{describeGoal(goal, formatCurrency, countLabel)}</div>
      <div className="text-2xs font-mono text-white/50 leading-relaxed">
        Met: reputation +{goal.reward.reputation}{goal.reward.cash > 0 ? `, bonus ${compact(goal.reward.cash)}` : ''}.
        <br />
        Missed: reputation {goal.penalty > 0 ? `−${goal.penalty}` : 'unchanged'}.
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
        <span className="text-2xs uppercase tracking-widest text-white/40 font-black">The board&apos;s goal</span>
        {annualGoal && <span className="text-2xs font-mono text-white/40">{annualGoal.year}</span>}
      </div>

      {goalOffer ? (
        <>
          <p className="text-2xs font-mono text-white/50 leading-relaxed mb-3 max-w-2xl">
            The board offers three goals for {goalOffer.year}. A harder goal pays more and costs more to miss.
            Without a choice, the first is taken when {goalOffer.year} begins.
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
                <div className="flex justify-between text-2xs font-mono uppercase tracking-wider text-white/50 mb-1">
                  <span>So far this year</span>
                  <span>{shown}{annualGoal.kind === 'noLoss' ? '' : ` of ${annualGoal.kind === 'profit' ? compact(annualGoal.target) : countLabel(annualGoal.target)}`}</span>
                </div>
                <Bar fraction={fraction} good={fraction >= 1} />
              </div>
            );
          })()}
        </div>
      ) : (
        <p className="text-2xs font-mono text-white/40">
          No goal yet. The board sets its first once a full year has been closed in December.
        </p>
      )}
    </Panel>
  );
}

function MilestoneSection({ milestones }: { milestones: string[] }) {
  const earned = new Set(milestones);
  const byTrack = TRACK_ORDER.map(track => ({ track, list: MILESTONES.filter(m => m.track === track) }));
  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-2xs uppercase tracking-widest text-white/40 font-black">Milestones</span>
        <span className="text-2xs font-mono text-white/40">{milestones.filter(id => MILESTONES.some(m => m.id === id)).length} / {MILESTONES.length}</span>
      </div>
      <div className="flex flex-col gap-4">
        {byTrack.map(({ track, list }) => (
          <div key={track}>
            <div className="text-3xs uppercase tracking-[0.25em] text-white/30 font-black mb-1">{TRACK_LABELS[track]}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {list.map((m: Milestone) => {
                const done = earned.has(m.id);
                return (
                  <div
                    key={m.id}
                    className={`p-2 border rounded-sm text-2xs font-mono leading-relaxed ${
                      done ? 'border-aero-good/40 bg-aero-good/5 text-white/80' : 'border-white/5 bg-white/[0.02] text-white/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 justify-between">
                      <span className="font-bold uppercase tracking-wider">
                        <span className={done ? 'text-aero-good' : 'text-white/20'}>{done ? '✓ ' : '○ '}</span>
                        {m.title}
                      </span>
                      <Badge tone={TIER_TONE[m.tier]}>{TIER_LABEL[m.tier]}</Badge>
                    </div>
                    <p className="mt-0.5">{m.detail}</p>
                    <p className="mt-1 text-white/30">{describeReward(m.reward, compact)}</p>
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

/** The Career tab of My Company: rank, the board's goal, and the milestones. */
export function CareerPanel(props: CareerPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <RankSection rank={props.rank} stats={props.rankStats} perks={props.perks} />
      <GoalSection
        annualGoal={props.annualGoal}
        goalOffer={props.goalOffer}
        goalSnapshot={props.goalSnapshot}
        onChooseGoal={props.onChooseGoal}
      />
      <MilestoneSection milestones={props.milestones} />
    </div>
  );
}
