import { Target } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { GoalCard } from './CareerPanel';
import { goalOfferLines, type AnnualGoal, type GoalOffer } from '../lib/annualGoals';

interface Props {
  offer: GoalOffer | null;
  open: boolean;
  onChoose: (goal: AnnualGoal) => void;
  /** Closes the dialog; the offer stays open under Career. */
  onLater: () => void;
}

/** The board's goals for the coming year (two or three), put to the player after the December close. */
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
          <p className="text-xs text-muted leading-relaxed">
            {goalOfferLines(offer).intro} If you decide later, you find the offer under Career &rsaquo; Board goals.{' '}
            {goalOfferLines(offer).deadline}
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
