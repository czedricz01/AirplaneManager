/**
 * Whether a month had bad luck the player did not choose: an operational
 * disruption or a staff strike. The model's ceiling on bad luck (SPEZIFIKATION
 * 8.8) keeps its own state; this is only needed to build that state for a game
 * whose first month has not been closed yet (`modelWorld` in
 * `src/lib/modelBridgeWorld.ts`).
 */
import type { Disruption, Staff } from './gameState';
import { disruptionsIn } from './disruptions';
import { isStrikeActive } from './staff';

/** Whether the month at `offset` had a one-time malus event: a disruption or a staff strike. */
export function hadOneTimeMalus(
  disruptions: Disruption[] | undefined,
  staff: Pick<Staff, 'strike'>,
  offset: number
): boolean {
  return disruptionsIn(disruptions, offset).length > 0 || isStrikeActive(staff, offset);
}
