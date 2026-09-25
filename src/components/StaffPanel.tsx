import { Users, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Panel } from './ui/Panel';
import { StatTile } from './ui/StatTile';
import { Badge } from './ui/Badge';
import type { Staff } from '../lib/gameState';
import {
  MORALE_INERTIA,
  MORALE_PER_PAY_POINT,
  NEUTRAL_MORALE,
  PROFIT_STREAK_MONTHS,
  PROFIT_STREAK_MORALE,
  SALARY_PCT_MAX,
  SALARY_PCT_MIN,
  SALARY_PCT_STEP,
  STRIKE_CHANCE_PER_POINT,
  STRIKE_MEMORY_MONTHS,
  STRIKE_MORALE_PENALTY,
  STRIKE_MORALE_THRESHOLD,
  isStrikeActive,
  moraleSatDelta,
  staffOutlook,
  strikeCancelShare,
  strikeIsRecent
} from '../lib/staff';
import { formatCurrency, formatNumber } from '../lib/format';

export interface StaffPanelProps {
  staff: Staff;
  /** Profitable months in a row, for the morale target. */
  profitStreak: number;
  currentDateOffset: number;
  /** Crew and ground staff this month at the current forecast and pay. */
  monthlyCrewCost: number;
  /** A strike question is waiting for an answer. */
  strikePending: boolean;
  onSetSalary: (pct: number) => void;
}

const signed = (v: number, digits = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${formatNumber(Math.abs(v), digits)}`;

/** The morale scale with the strike zone, the neutral line, where morale is and where it is heading. */
function MoraleBar({ morale, target }: { morale: number; target: number }) {
  const tone = morale < STRIKE_MORALE_THRESHOLD ? 'bg-aero-warn' : morale < NEUTRAL_MORALE ? 'bg-aero-yellow' : 'bg-aero-good';
  return (
    <div>
      <div className="relative h-3 bg-white/10 overflow-hidden">
        {/* Where strikes become possible. */}
        <div className="absolute inset-y-0 left-0 bg-aero-warn/15" style={{ width: `${STRIKE_MORALE_THRESHOLD}%` }} />
        <div className={`absolute inset-y-0 left-0 ${tone}`} style={{ width: `${Math.max(0, Math.min(100, morale))}%` }} />
        <div className="absolute inset-y-0 w-px bg-white/40" style={{ left: `${NEUTRAL_MORALE}%` }} title="Neutral: no effect on satisfaction" />
        <div
          className="absolute inset-y-0 w-0.5 bg-white"
          style={{ left: `calc(${Math.max(0, Math.min(100, target))}% - 1px)` }}
          title={`Target ${Math.round(target)}`}
        />
      </div>
      <div className="relative h-4 mt-1 text-3xs font-mono text-white/40">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2 text-aero-warn/70" style={{ left: `${STRIKE_MORALE_THRESHOLD}%` }}>{STRIKE_MORALE_THRESHOLD} strike</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${NEUTRAL_MORALE}%` }}>{NEUTRAL_MORALE} neutral</span>
        <span className="absolute right-0">100</span>
      </div>
    </div>
  );
}

/**
 * The Staff tab of My Company: pay, the morale it buys, and the strike risk
 * it carries. Pay takes effect at once in every forecast; morale only moves
 * at month end.
 */
export function StaffPanel({ staff, profitStreak, currentDateOffset: offset, monthlyCrewCost, strikePending, onSetSalary }: StaffPanelProps) {
  const outlook = staffOutlook(staff, profitStreak, offset, strikePending);
  const satNow = moraleSatDelta(staff.morale);
  const striking = isStrikeActive(staff, offset);
  const strikeShare = strikeCancelShare(staff, offset);
  const recentStrike = strikeIsRecent(staff.strike, offset + 1);
  const trend = outlook.nextMorale - staff.morale;
  const TrendIcon = Math.abs(trend) < 0.05 ? Minus : trend > 0 ? TrendingUp : TrendingDown;

  // What pay changes on this month's bill: the forecast already carries the
  // current pay, so the market-wage figure is backed out of it.
  const payFactor = staff.salaryPct / 100;
  const atMarketPay = payFactor > 0 ? monthlyCrewCost / payFactor : monthlyCrewCost;
  const vsMarket = monthlyCrewCost - atMarketPay;

  return (
    <div className="grid grid-cols-1 gap-3">
      {striking && (
        <div className="flex items-start gap-3 border border-aero-warn/40 bg-aero-warn/10 px-4 py-3 rounded-sm">
          <AlertTriangle size={18} className="text-aero-warn shrink-0 mt-0.5" />
          <div className="text-2xs font-mono leading-relaxed">
            <span className="block text-aero-warn font-black uppercase tracking-widest mb-0.5">
              Strike this month · {Math.round(strikeShare * 100)}% of flights grounded
            </span>
            <span className="text-white/60">
              {strikePending
                ? 'Waiting for your answer: until then every flight stays on the ground.'
                : strikeShare >= 1
                  ? 'You are sitting it out. Nothing flies until the month ends.'
                  : 'Pay was raised; half the flights operate while the deal is worked out.'}
              {' '}The strike ends with the month, but weighs on morale for {STRIKE_MEMORY_MONTHS} more.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile
          size="md"
          label="Morale"
          value={Math.round(staff.morale)}
          valueClassName={staff.morale < STRIKE_MORALE_THRESHOLD ? 'text-aero-warn' : staff.morale >= NEUTRAL_MORALE ? 'text-aero-good' : ''}
        >
          <span className="flex items-center gap-1 text-3xs font-mono text-white/40 mt-1">
            <TrendIcon size={10} className={trend > 0.05 ? 'text-aero-good' : trend < -0.05 ? 'text-aero-warn' : ''} />
            {Math.round(outlook.nextMorale)} next month · target {Math.round(outlook.target)}
          </span>
        </StatTile>
        <StatTile
          size="md"
          label="Strike risk"
          value={`${formatNumber(outlook.strikeChance * 100, 1)}%`}
          valueClassName={outlook.strikeChance > 0 ? 'text-aero-warn' : 'text-aero-good'}
        >
          <span className="block text-3xs font-mono text-white/40 mt-1">
            {strikePending
              ? 'none while a strike awaits your answer'
              : striking
                ? 'no new strike straight after this one'
                : outlook.strikeChance > 0
                  ? 'chance of a strike at this month end'
                  : `none while morale stays at ${STRIKE_MORALE_THRESHOLD} or above`}
          </span>
        </StatTile>
        <StatTile size="md" label="Satisfaction effect" value={signed(satNow)} valueClassName={satNow > 0 ? 'text-aero-good' : satNow < 0 ? 'text-aero-warn' : ''}>
          <span className="block text-3xs font-mono text-white/40 mt-1">points in every cabin, from morale</span>
        </StatTile>
      </div>

      {/* Pay */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <Users size={18} className="text-aero-yellow shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-2xs uppercase tracking-widest text-white/60 font-black block mb-1">Pay</span>
              <p className="text-2xs font-mono text-white/50 leading-relaxed max-w-xl">
                Crew and ground staff are paid a share of the market wage. The bill changes at once;
                morale follows over the coming months.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-mono font-black text-white">{Math.round(staff.salaryPct)}%</span>
            <span className="text-3xs font-mono text-white/40 uppercase tracking-widest">of market wage</span>
          </div>
        </div>

        <label className="block">
          <span className="sr-only">Pay as a percentage of the market wage</span>
          <input
            type="range"
            min={SALARY_PCT_MIN}
            max={SALARY_PCT_MAX}
            step={SALARY_PCT_STEP}
            value={staff.salaryPct}
            onChange={e => onSetSalary(Number(e.target.value))}
            className="w-full accent-aero-yellow cursor-pointer"
          />
        </label>
        <div className="flex justify-between text-3xs font-mono text-white/30 mt-0.5">
          <span>{SALARY_PCT_MIN}%</span>
          <span>100% market</span>
          <span>{SALARY_PCT_MAX}%</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10 text-2xs font-mono">
          <div>
            <span className="block text-white/40 uppercase tracking-wider">Crew &amp; ground staff this month</span>
            <span className="text-base font-bold text-white">{formatCurrency(monthlyCrewCost)}</span>
            <span className={`block ${vsMarket > 0 ? 'text-aero-warn' : vsMarket < 0 ? 'text-aero-good' : 'text-white/40'}`}>
              {Math.abs(vsMarket) < 1 ? 'the market rate' : `${vsMarket > 0 ? '+' : '−'}${formatCurrency(Math.abs(vsMarket))} against market pay`}
            </span>
          </div>
          <div>
            <span className="block text-white/40 uppercase tracking-wider">Morale this pay buys</span>
            <span className="text-base font-bold text-white">{Math.round(outlook.target)}</span>
            <span className="block text-white/40">
              {outlook.target < STRIKE_MORALE_THRESHOLD
                ? <span className="text-aero-warn">below the strike line</span>
                : `satisfaction ${signed(moraleSatDelta(outlook.target))} once reached`}
            </span>
          </div>
        </div>
      </Panel>

      {/* Morale */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-2xs uppercase tracking-widest text-white/60 font-black">Morale</span>
          <div className="flex flex-wrap gap-2">
            {profitStreak > PROFIT_STREAK_MONTHS && <Badge tone="good">Profit streak +{PROFIT_STREAK_MORALE}</Badge>}
            {recentStrike && <Badge tone="warn">Recent strike −{STRIKE_MORALE_PENALTY}</Badge>}
          </div>
        </div>
        <MoraleBar morale={staff.morale} target={outlook.target} />
        <p className="text-2xs font-mono text-white/40 leading-relaxed mt-3">
          Morale moves {Math.round(MORALE_INERTIA * 100)}% of the way to its target each month. The target is 50 at market pay,
          {' '}{MORALE_PER_PAY_POINT} points for every percent of pay above or below it, +{PROFIT_STREAK_MORALE} after more
          than {PROFIT_STREAK_MONTHS} profitable months in a row and −{STRIKE_MORALE_PENALTY} for {STRIKE_MEMORY_MONTHS} months
          after a strike. Every point above or below {NEUTRAL_MORALE} adds or takes a tenth of a satisfaction point in every cabin.
          Below {STRIKE_MORALE_THRESHOLD} the staff may strike: {formatNumber(STRIKE_CHANCE_PER_POINT * 100, 1)}% a month for every
          point under the line.
        </p>
      </Panel>
    </div>
  );
}
