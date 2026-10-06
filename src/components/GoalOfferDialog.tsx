import { Target } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { GoalCard } from './CareerPanel';
import type { AnnualGoal, GoalOffer } from '../lib/annualGoals';

interface Props {
  offer: GoalOffer | null;
  open: boolean;
  onChoose: (goal: AnnualGoal) => void;
  /** Closes the dialog; the offer stays open under My Company > Career. */
  onLater: () => void;
}

/** The board's three goals for the coming year, put to the player after the December close. */
export function GoalOfferDialog({ offer, open, onChoose, onLater }: Props) {
  return (
    <Modal
      open={open && !!offer}
      onClose={onLater}
      size="xl"
      layer="top"
      title={offer ? `The board's goals for ${offer.year}` : undefined}
      icon={<Target size={16} aria-hidden="true" />}
      footer={<Button variant="ghost" onClick={onLater}>Decide later</Button>}
    >
      {offer && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-mono text-white/60 leading-relaxed">
            Pick one goal for {offer.year}. A harder goal pays more and costs more to miss.
            If you decide later, you find the offer under My Company &rsaquo; Career; without a choice
            the first goal is taken when {offer.year} begins.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {offer.options.map((g, i) => (
              <GoalCard key={`${g.kind}-${i}`} goal={g} onChoose={() => onChoose(g)} />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
