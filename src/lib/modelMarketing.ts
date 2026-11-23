/**
 * Werbung und Frequent flyer nach dem Modell (Paket 4.8, SPEZIFIKATION 3.9.4, 3.9.5, 5.14, 6.3): Preis einer Kampagne
 * mit dem Kostenindex, Werbe-Faktor je Region, Ruf-Beitrag der Werbung und Treue-Zuschlag des Programms. Ersetzt in
 * der Werbe-Ansicht und in `App.tsx` die alten Zahlen aus `src/lib/marketing.ts` (eigene Teuerung 3 %/Jahr, Ruf je
 * Monat aufaddiert, Ruf aus dem Programm, Treue nur gegen Rivalen). Namen, Laufzeiten, Rang-Sperren und Regeln zum
 * Buchen (eine Kampagne je Region) bleiben dort.
 *
 * Rein: liest nur seine Eingabe (R12).
 */
import { campaignCost } from '../model/costTotals';
import { frequentFlyerFactor, advertisingRegionFactor } from '../model/marketSplit';
import { advertisingReputation } from '../model/progress';
import { WORLD_REGIONS, type CampaignTier } from '../model/constants';
import type { Campaign, Marketing, RegionId } from './gameState';
import { ffpMonthsRunning } from './modelBridgeCompany';

/** Läuft die Kampagne im Monat `month` (`startOffset ≤ month < startOffset + duration`, wie die Brücke zum Modell)? */
export function campaignRuns(c: Campaign, month: number): boolean {
  return c.startOffset <= month && month < c.startOffset + c.duration;
}

/** Laufende Kampagnen im Monat `month`. */
export function runningCampaigns(marketing: Pick<Marketing, 'campaigns'>, month: number): Campaign[] {
  return marketing.campaigns.filter((c) => campaignRuns(c, month));
}

/** Monate, die eine Kampagne noch läuft, der Monat `month` mitgezählt. */
export function campaignMonthsLeft(c: Campaign, month: number): number {
  return Math.max(0, c.startOffset + c.duration - Math.max(month, c.startOffset));
}

/** Preis einer Kampagne im Monat `month`, wie der Abschluss ihn bucht (`campaignCost`, 5.14). */
export function campaignMonthCost(tier: CampaignTier, month: number): number {
  return campaignCost(tier, month);
}

/** Preis über die ganze Laufzeit: jeder Monat zum Kostenindex seines Monats (5.14). */
export function campaignRunCost(tier: CampaignTier, startMonth: number, months: number): number {
  let total = 0;
  for (let i = 0; i < months; i++) total += campaignCost(tier, startMonth + i);
  return total;
}

/** Was die laufenden Kampagnen im Monat `month` kosten (Summe `campaignCost`). */
export function campaignsMonthCost(marketing: Pick<Marketing, 'campaigns'>, month: number): number {
  return runningCampaigns(marketing, month).reduce((sum, c) => sum + campaignCost(c.tier, month), 0);
}

/** Deckt die Kampagne die Region ab? Eine weltweite deckt jede ab. */
function covers(c: Campaign, region: RegionId): boolean {
  return c.tier === 'global' || c.region === region;
}

/**
 * Werbe-Faktor jeder Region im Monat `month` (`advertisingRegionFactor`, 3.9.5): `1 + Σ Zuschläge` der laufenden
 * Kampagnen, die sie abdecken, höchstens `ADVERTISING_MAX`. Eine Strecke nimmt das Mittel ihrer beiden Enden.
 */
export function regionAdvertising(marketing: Pick<Marketing, 'campaigns'>, month: number): Record<RegionId, number> {
  const running = runningCampaigns(marketing, month);
  const out = {} as Record<RegionId, number>;
  for (const region of WORLD_REGIONS) {
    out[region] = advertisingRegionFactor(running.filter((c) => covers(c, region)).map((c) => c.tier));
  }
  return out;
}

/** Ruf-Beitrag der Werbung im Monat `month` (`advertisingReputation`, 6.3): Punkte im Ruf-Ziel, höchstens 3. */
export function marketingReputation(marketing: Pick<Marketing, 'campaigns'>, month: number): number {
  return advertisingReputation(runningCampaigns(marketing, month).map((c) => c.tier));
}

/**
 * Treue-Zuschlag des Frequent-flyer-Programms im Monat `month` (`frequentFlyerFactor − 1`, 3.9.4): 0,05 im ersten
 * Laufmonat, je weiterem Monat 0,01 mehr, höchstens 0,20; 0, wenn es nicht läuft. Gilt für alle Angebote des Spielers.
 */
export function loyaltyBonus(marketing: Pick<Marketing, 'ffpActive' | 'ffpSinceOffset'>, month: number): number {
  return frequentFlyerFactor(ffpMonthsRunning(marketing, month)) - 1;
}
