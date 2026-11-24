/**
 * Milestones on the screen (docs/neubau 6.10).
 *
 * The 31 milestones, what they measure, their thresholds, prizes, slot discounts and extra hubs are the model's
 * table `MILESTONES` with `MILESTONE_TIER_REWARD`; the month close awards them (`newMilestones`). This file adds
 * the names of the tracks, what the milestones earned so far give the airline, and the reward as a line of text
 * (generated from the table, E52; no reputation points, E38).
 */
import { MILESTONE_TIER_REWARD, type MilestoneDef, type MilestoneTrack } from '../model/constants';
import { milestoneHubs, milestonePrize, milestoneSlotFactor } from '../model/progress';

export type { MilestoneDef, MilestoneTier, MilestoneTrack } from '../model/constants';

export const TRACK_LABELS: Record<MilestoneTrack, string> = {
  network: 'Network',
  fleet: 'Fleet',
  passengers: 'Passengers',
  reach: 'Reach',
  finance: 'Finance',
  standing: 'Standing',
  hub: 'Hub',
  feats: 'Feats',
};

export interface MilestonePerks {
  /** Multiplies the price of an airport slot, 0.7-1 (`milestoneSlotFactor`). */
  slotPriceFactor: number;
  /** Hubs beyond the rank's allowance (`milestoneHubs`). */
  extraHubs: number;
}

/** What the milestones earned so far give the airline. */
export function milestonePerks(earnedIds: readonly string[]): MilestonePerks {
  return { slotPriceFactor: milestoneSlotFactor(earnedIds), extraHubs: milestoneHubs(earnedIds) };
}

/** One line describing what a milestone pays in the month `month`, for the catalogue. */
export function describeReward(def: MilestoneDef, month: number, formatMoney: (n: number) => string): string {
  const reward = MILESTONE_TIER_REWARD[def.tier];
  const parts = [`${formatMoney(milestonePrize(def, month))} prize`];
  if (reward.slotDiscount > 0) parts.push(`slots ${Math.round(reward.slotDiscount * 100)}% cheaper`);
  if (def.extraHubs > 0) parts.push(`room for ${def.extraHubs} more hub${def.extraHubs === 1 ? '' : 's'}`);
  return parts.join(', ');
}
