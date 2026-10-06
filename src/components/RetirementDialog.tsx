import { Trophy } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { rankDef } from '../lib/airlineRank';
import { formatMoneyCompact, formatNumber } from '../lib/format';
import type { HallOfFameEntry, ScoreBreakdown } from '../lib/careerScore';

interface Props {
  open: boolean;
  airline: string;
  score: ScoreBreakdown;
  entry: HallOfFameEntry | null;
  /** Where the career stands in the hall, 1-based; null when it did not make it. */
  position: number | null;
  hall: HallOfFameEntry[];
  onKeepPlaying: () => void;
  onMainMenu: () => void;
}

/** The final report of a career the player has chosen to file. */
export function RetirementDialog({ open, airline, score, entry, position, hall, onKeepPlaying, onMainMenu }: Props) {
  return (
    <Modal
      open={open && !!entry}
      size="lg"
      layer="top"
      onClose={onKeepPlaying}
      title={`${airline || 'Your airline'}: final report`}
      icon={<Trophy size={16} aria-hidden="true" />}
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onKeepPlaying}>Keep playing</Button>
          <Button variant="primary" onClick={onMainMenu}>Main menu</Button>
        </div>
      }
    >
      {entry && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-3xl font-mono font-black text-aero-yellow tabular-nums">{formatNumber(score.total)} points</div>
            <div className="text-2xs font-mono text-white/50">
              {rankDef(entry.rank).title} · {entry.years} year{entry.years === 1 ? '' : 's'} · net worth {formatMoneyCompact(entry.netWorth)}
            </div>
          </div>
          <p className="text-xs font-mono text-white/70 leading-relaxed">
            {position !== null
              ? `Filed in the hall of fame at position ${position}.`
              : 'Not enough for the hall of fame this time: the ten best careers are kept.'}
          </p>
          <ol className="flex flex-col gap-1">
            {hall.map((e, i) => (
              <li key={e.id} className={`flex items-center justify-between gap-3 text-2xs font-mono border-b border-white/5 py-1 ${e.id === entry.id ? 'text-aero-yellow' : ''}`}>
                <span className="truncate"><span className="text-white/30">{i + 1}.</span> {e.airline}{e.code ? ` (${e.code})` : ''}{e.mode === 'free' ? ' · Free Mode' : ''}</span>
                <span className="tabular-nums">{formatNumber(e.score)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  );
}
