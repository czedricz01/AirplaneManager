/**
 * Steckbrief einer KI-Persönlichkeit für die Konkurrenz-Ansicht (Paket 4.7b): alle Angaben aus `PERSONALITIES` des
 * Modells (7.4–7.6, 7.8–7.10, 7.13, 7.15) statt fester Texte in `CompetitorsView.tsx`.
 *
 * Rein: liest nur Konstanten (R12).
 */
import {
  CABIN_CLASSES,
  LONG_HAUL_KM,
  PERSONALITIES,
  PRICE_WAR_CUT,
  PRICE_WAR_MIN_AGGRESSION,
  SALE_TO_LIQUIDATION_MONTHS,
  type CabinClass,
  type RivalPersonality,
} from '../model/constants';
import { CLASS_LABEL } from '../model/glossary';
import { rivalPatience } from '../model/rivals';

/** Was die Konkurrenz-Ansicht über das Geschäftsmodell einer KI zeigt. */
export interface RivalProfile {
  /** Angriffslust 1 … 10 (7.4). */
  readonly aggression: number;
  /** Beginnt Preiskämpfe (Angriffslust ≥ `PRICE_WAR_MIN_AGGRESSION`, 7.6). */
  readonly priceWars: boolean;
  /** Nachlass im Preiskampf (`PRICE_WAR_CUT`). */
  readonly priceWarCut: number;
  /** Preis-Boden im Preiskampf als Preisniveau (`FARE_FLOOR`, 7.6). */
  readonly fareFloor: number;
  /** Preis-Lage (`FARE_POSITION`, 7.6): Faktor auf das, was die Fluggäste für die Satisfaction zahlen, oder `best`. */
  readonly farePosition: number | 'best';
  /** Monate bis zum Urteil über eine neue Strecke (`rivalPatience`, 7.8). */
  readonly patienceMonths: number;
  /** Klassen der Kabine (Economy immer; die übrigen mit Platz-Anteil > 0, 7.5). */
  readonly classes: readonly CabinClass[];
  /** Sitzabstand Economy in cm (7.5). */
  readonly economyPitch: number;
  /** Klassen mit Mahlzeiten (7.5). */
  readonly mealClasses: readonly CabinClass[];
  /** Ziel-Vorlieben (7.9): mehr Geschäfts- oder Urlaubsziele, oder beide gleich. */
  readonly targets: 'business' | 'leisure' | 'both';
  /** Meidet Langstrecken (`longHaulFactor` < 1, 7.9). */
  readonly avoidsLongHaul: boolean;
  /** Höchstzahl der Drehkreuze (`MAX_HUBS`, 7.13). */
  readonly maxHubs: number;
  /** Baut VIP-Lounges an den eigenen Drehkreuzen (7.10). */
  readonly buildsLounge: boolean;
}

/** Steckbrief der Persönlichkeit `personality` nach dem Modell. */
export function rivalProfile(personality: RivalPersonality): RivalProfile {
  const def = PERSONALITIES[personality];
  const classes = CABIN_CLASSES.filter((c) => c === 'economy' || (def.cabin.spaceShare[c as Exclude<CabinClass, 'economy'>] ?? 0) > 0);
  const { business, tourism } = def.targetWeight;
  return {
    aggression: def.aggression,
    priceWars: def.aggression >= PRICE_WAR_MIN_AGGRESSION,
    priceWarCut: PRICE_WAR_CUT,
    fareFloor: def.fareFloor,
    farePosition: def.farePosition,
    patienceMonths: rivalPatience(personality),
    classes,
    economyPitch: def.cabin.pitch.economy,
    mealClasses: classes.filter((c) => def.service[c].menu.length > 0),
    targets: business > tourism ? 'business' : business < tourism ? 'leisure' : 'both',
    avoidsLongHaul: def.longHaulFactor < 1,
    maxHubs: def.maxHubs,
    buildsLounge: def.buildsLounge,
  };
}

/**
 * Monatsabschlüsse bis zur Auflösung einer KI, die zum Verkauf steht (7.15): Sie wird im Abschluss aufgelöst, in dem
 * ihre Monate zum Verkauf `SALE_TO_LIQUIDATION_MONTHS` erreichen, wenn ihre Kasse bis dahin unter 0 bleibt und
 * niemand sie kauft. Mindestens 1.
 */
export function closesToLiquidation(forSaleMonths: number): number {
  return Math.max(1, SALE_TO_LIQUIDATION_MONTHS - forSaleMonths);
}

/** Eine Zeile des Steckbriefs in der Konkurrenz-Ansicht (Texte der Oberfläche auf Englisch). */
export interface RivalProfileLine {
  readonly label: string;
  readonly value: string;
}

const pct = (share: number) => `${Math.round(share * 100)}%`;
const list = (classes: readonly CabinClass[]) => classes.map((c) => CLASS_LABEL[c]).join(', ');

/** Die Zeilen „Cabin plan“ (Einrichtung neuer Flugzeuge, 7.5), „Fares“, „Price wars“, „Catering“, „Network“, „New routes“ des Steckbriefs. */
export function rivalProfileLines(p: RivalProfile): RivalProfileLine[] {
  const others = p.classes.filter((c) => c !== 'economy');
  const cabin = others.length === 0
    ? `Economy only, ${p.economyPitch} cm pitch`
    : `Economy (${p.economyPitch} cm pitch), ${list(others)}`;
  const fares = p.farePosition === 'best'
    ? 'The most profitable fare for each cabin'
    : p.farePosition === 1
      ? 'What its passengers will pay for its service'
      : `${pct(1 - p.farePosition)} below what its passengers will pay for its service`;
  const wars = p.priceWars
    ? `Cuts fares ${pct(p.priceWarCut)} on contested pairs, never below ${pct(p.fareFloor)} of the market fare`
    : 'Does not start price wars';
  const catering = p.mealClasses.length === 0
    ? 'No free meals'
    : p.mealClasses.length === p.classes.length
      ? 'Meals in every cabin'
      : `Meals in ${list(p.mealClasses)}`;
  const targets = p.targets === 'business' ? 'Business cities' : p.targets === 'leisure' ? 'Leisure destinations' : 'Business and leisure';
  const network = [
    targets,
    ...(p.avoidsLongHaul ? [`mostly under ${LONG_HAUL_KM.toLocaleString('en-US')} km`] : []),
    `up to ${p.maxHubs} hub${p.maxHubs === 1 ? '' : 's'}`,
    ...(p.buildsLounge ? ['VIP lounges at its hubs'] : []),
  ].join(', ');
  return [
    { label: 'Cabin plan', value: cabin },
    { label: 'Fares', value: fares },
    { label: 'Price wars', value: wars },
    { label: 'Catering', value: catering },
    { label: 'Network', value: network },
    { label: 'New routes', value: `Judged after ${p.patienceMonths} months` },
  ];
}
