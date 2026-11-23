/**
 * Ereignis-Band der Kopfzeile und Krisen-Frage nach dem Modell (Paket 4.7c, 8.4, 8.5, E6, E35).
 *
 * - `eventBand` liest die laufenden Ereignisse aus dem Modell (`activeWorldEvents`: geschichtliche aus den Daten und
 *   gewürfelte aus dem Spielstand), mit Titel und Text aus den Modell-Daten (`HISTORICAL_EVENTS`,
 *   `RANDOM_EVENT_TEMPLATES`), Restdauer, Regionen und Nachfrage-Faktor. Nur die Texte der Antworten (Name, Erklärung)
 *   kommen aus `src/lib/eventSystem.ts`; ihr Preis aus dem Modell.
 * - `crisisBase` / `pricedChoices` setzen den Preis einer Krisen-Antwort als Anteil der Treibstoff-Rechnung bzw. des
 *   Erlöses des letzten abgeschlossenen Monats (`crisisResponsePrice`, 8.5); die festen Preise (3–6 Mio. $) entfallen.
 *
 * Rein: liest nur seine Eingabe (R12).
 */
import { HISTORICAL_EVENTS, RANDOM_EVENT_TEMPLATES } from '../model/constants';
import { activeWorldEvents, crisisResponsePrice, type CrisisResponseBase, type WorldEvent } from '../model/monthEvents';
import { eventKey, historicalEvents, type EventChoice, type EventRegion, type HistoricalEvent } from './eventSystem';
import type { MonthlyReport } from './gameTypes';

/** Ein Eintrag des Ereignis-Bands; Format der Oberfläche, damit „Decision pending“ die Frage öffnen kann. */
export interface BandEvent extends HistoricalEvent {
  /** Monate bis zum Ende, den laufenden mitgezählt. */
  readonly monthsLeft: number;
  /** Gewählte Antwort, falls schon entschieden. */
  readonly chosen: EventChoice | undefined;
}

/** Ob eine Antwort etwas kauft (Preis-Absicherung oder Rückgewinnung); „nichts tun“ kostet nichts. */
export const isPaidChoice = (choice: Pick<EventChoice, 'hedgesFuel' | 'softensDemand'>): boolean =>
  !!choice.hedgesFuel || !!choice.softensDemand;

/**
 * Bezugsgrößen der Krisen-Antwort aus dem Bericht des letzten abgeschlossenen Monats (8.5): Treibstoff-Rechnung
 * (`breakdown.fuel`) und Monatserlös (`routeRevenues`). Ohne Bericht (erster Monat) `null`: Dann ist eine kaufende
 * Antwort noch nicht zu haben (sonst kostete sie 0, z. B. im Szenario, das in der Ölkrise 1973 beginnt; O69).
 */
export function crisisBase(report: Pick<MonthlyReport, 'breakdown' | 'routeRevenues'> | undefined): CrisisResponseBase | null {
  if (!report) return null;
  return {
    fuelBill: Math.max(0, report?.breakdown?.fuel ?? 0),
    revenue: Math.max(0, report?.routeRevenues ?? 0),
  };
}

/**
 * Antworten eines Ereignisses mit dem Preis des Modells (8.5): Eine kaufende Antwort kostet `crisisResponsePrice`,
 * gerundet auf $; „nichts tun“ 0. Ohne Bezugsgröße (`base = null`) oder mit Preis 0 (Monat ohne Flüge, also ohne
 * Treibstoff-Rechnung bzw. Erlös) ist die kaufende Antwort `unpriced` (nicht wählbar, O69). Ein Ereignis ohne
 * Antwort im Modell bekommt keine Antworten.
 */
export function pricedChoices(title: string, choices: readonly EventChoice[] | undefined, base: CrisisResponseBase | null): EventChoice[] | undefined {
  const def = HISTORICAL_EVENTS.find((e) => e.title === title);
  if (!choices || choices.length === 0 || !def?.response) return undefined;
  const price = base ? Math.round(crisisResponsePrice(def, base)) : 0;
  return choices.map(({ unpriced: _u, ...c }) => {
    if (!isPaidChoice(c)) return { ...c, cost: 0 };
    return price > 0 ? { ...c, cost: price } : { ...c, cost: 0, unpriced: true };
  });
}

/** Das Ereignis der Oberfläche mit Preisen des Modells (für die Frage beim Beginn). */
export function pricedEvent<E extends HistoricalEvent>(ev: E, base: CrisisResponseBase | null): E {
  const choices = pricedChoices(ev.title, ev.choices, base);
  const { choices: _old, ...rest } = ev;
  return (choices ? { ...rest, choices } : rest) as E;
}

/** Text eines Ereignisses aus den Modell-Daten: geschichtlich, sonst Vorlage des Zufallsereignisses. */
function eventDescription(title: string): string {
  return HISTORICAL_EVENTS.find((e) => e.title === title)?.description
    ?? RANDOM_EVENT_TEMPLATES.find((t) => t.title === title)?.description
    ?? '';
}

/**
 * Die im Monat `month` laufenden Ereignisse für das Band (8.4), in der Reihenfolge des Modells (geschichtliche, dann
 * gewürfelte). Mit gewählter Antwort (`eventChoices`, Schlüssel `eventKey`) und Antworten zum Preis des Modells.
 *
 * @param randomEvents Gewürfelte Ereignisse aus dem Modell-Spielstand (`ModelState.randomEvents`).
 */
export function eventBand(
  month: number,
  randomEvents: readonly WorldEvent[],
  eventChoices: Readonly<Record<string, string>>,
  base: CrisisResponseBase | null,
): BandEvent[] {
  return activeWorldEvents(month, randomEvents).map((e) => {
    const app = historicalEvents.find((h) => h.title === e.title && h.startOffset === e.startMonth);
    const choices = pricedChoices(e.title, app?.choices, base);
    const key = eventKey({ title: e.title, startOffset: e.startMonth });
    const chosenId = eventChoices[key];
    return {
      startOffset: e.startMonth,
      duration: e.months,
      title: e.title,
      description: eventDescription(e.title),
      demandMultiplier: e.demandMultiplier,
      // Kein Treibstoff-Faktor im Modell (E8); der Preis steht in der Treibstoff-Zahl.
      fuelMultiplier: 1,
      ...(e.regions && e.regions.length > 0 ? { regions: [...e.regions] as EventRegion[] } : {}),
      ...(choices ? { choices } : {}),
      monthsLeft: e.startMonth + e.months - month,
      chosen: chosenId ? choices?.find((c) => c.id === chosenId) : undefined,
    };
  });
}
