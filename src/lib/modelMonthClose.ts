/**
 * Monatsabschluss der Oberfläche über das Modell (Paket 4.2f, E72, F57, F58).
 *
 * `runModelMonth` (`modelMonth.ts`) rechnet den Monat und gibt alle Felder für X+1 zurück. Was nur die Oberfläche
 * betrifft, steht hier: Meldungen, die das Modell nicht kennt (Flugzeug-Vorschau im Januar, Start und Ende von
 * Ereignissen, Jubiläum, Kampagnen-Ende, Störungs-Ausblick, Personal-Unruhe), Fragen an den Spieler (Krisen-Antwort,
 * Streik, große Störungen), Chronik, Zeitung, Szenario-Sterne, Jahresziel-Dialog, Vogelschlag-Hinweise, Autosave.
 * Gerechnet wird hier nichts (R2): Geld, Ruf, Fluggäste kommen aus dem Modell.
 *
 * `modelMonthClose` liest nur seine Eingabe, mit einer Ausnahme wie im alten Abschluss (`src/lib/monthClose.ts`): die
 * Zufallsereignisse der Ansicht kommen in den Modul-Zustand von `eventSystem.ts` (`setRuntimeRandomEvents`), damit
 * `getActiveEvents` des neuen Monats sie kennt. `applyModelClose` setzt das Ergebnis auf die Setter von `App.tsx`.
 */
import type { AiAirline } from '../components/CompetitorsView';
import { aircraftList } from '../data/aircraft';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { scenarioById } from '../data/scenarios';
import { describeGoal } from './annualGoals';
import { bestStars, starsFor, type ScenarioStars } from './careerScore';
import { appendChronicle, chronicleEntriesForMonth, departureMarketShare, regionsServed } from './chronicle';
import {
  MAJOR_DISRUPTION_SHARE,
  buildDisruptionDecision,
  describeDisruption,
  disruptionRoutesLabel,
  disruptionTitle,
  disruptionsToAsk,
  type BirdStrike,
} from './disruptions';
import { eventKey, getActiveEvents, setRuntimeRandomEvents, type HistoricalEvent } from './eventSystem';
import { LITRES_PER_GALLON, formatCurrency, formatNumber } from './format';
import {
  ensureFreeOption,
  type ChronicleEntry,
  type Disruption as AppDisruption,
  type GameDecision,
  type GameSettings,
  type RegionId,
} from './gameState';
import type { GameMessage, MonthlyReport } from './gameTypes';
import { CAMPAIGN_SPECS, REGION_LABELS } from './marketing';
import { nextMessageId } from './messages';
import { rivalCompanyId } from './modelBridgeWorld';
import { PLAYER_ID, defaultModelEnv, runModelMonth, type AppGame, type AppMonth, type ModelEnv } from './modelMonth';
import { buildEventEndMessage, buildEventStartMessage, buildRivalOffers, offsetToDateStr } from './monthClose';
import { buildEdition, rivalMoves, type Edition } from './newspaper';
import { playerScore } from './modelCompany';
import { strikeQuestion } from './modelStaff';
import { MILESTONES, RANKS, STRIKE_MORALE_THRESHOLD } from '../model/constants';

/** Was der Abschluss über `AppGame` hinaus aus `App.tsx` liest. */
export interface ModelCloseInput extends AppGame {
  readonly airlineName: string;
  readonly chronicle: readonly ChronicleEntry[];
  readonly homeRegion: RegionId;
  readonly scenarioStars: ScenarioStars;
  readonly gameSettings: Pick<GameSettings, 'newspaper'>;
  readonly autosaveInterval: number;
  readonly freeMode: boolean;
  /** Bericht des Vormonats (Zeitung). */
  readonly latestReport: MonthlyReport | null;
  /** Treibstoff und Nachfrage für die Kurse der Zeitung (Anzeige der Kopfzeile, bis 4.7). */
  readonly getFuelData: (offset: number) => { price: number; trend: string };
  readonly getBaseGlobalDemand: (offset: number) => { value: number; trend: string };
}

/** Alles, was nach dem Abschluss in `App.tsx` gesetzt wird. */
export interface ModelClose {
  /** Felder des Spielstands für X+1 (Bericht mit Marktanteil). */
  readonly month: AppMonth;
  /** Neue Nachrichten, neueste zuerst (Modell und Oberfläche). */
  readonly messages: readonly GameMessage[];
  /** Neue Fragen (Streik, große Störungen), mit kostenloser Antwort. */
  readonly decisions: readonly GameDecision[];
  /** Ein Ereignis mit Krisen-Antwort, das mit X+1 beginnt und noch keine Antwort hat. */
  readonly crisisQuestion: HistoricalEvent | null;
  /** Chronik nach dem Abschluss (ganze Liste). */
  readonly chronicle: readonly ChronicleEntry[];
  readonly edition: Edition;
  readonly openNewspaper: boolean;
  /** Neue Szenario-Sterne, wenn sie sich geändert haben. */
  readonly scenarioStars: ScenarioStars | null;
  readonly scenarioResultOpen: boolean;
  readonly goalOfferOpen: boolean;
  readonly birdStrikeAlerts: readonly BirdStrike[];
  readonly autosave: boolean;
}

/** Monate, für die das Szenario läuft, bis zum Abschluss von `month` (Sterne, `starsFor`). */
function scenarioStarsIfWon(g: Pick<AppGame, 'scenario' | 'month'>): { title: string; stars: number } | undefined {
  const s = g.scenario;
  const def = s?.status === 'running' ? scenarioById(s.id) : undefined;
  if (!s || !def) return undefined;
  return { title: def.title, stars: starsFor(true, g.month - s.startedOffset + 1, def.deadlineOffset - s.startedOffset + 1) };
}

/** Januar: welche Typen im neuen Jahr zum ersten Mal geliefert werden (wie der alte Abschluss). */
export function launchPreviewMessage(nextMonth: number, id: number): GameMessage | null {
  if (nextMonth % 12 !== 0) return null;
  const year = 1960 + Math.floor(nextMonth / 12);
  const debuting = aircraftList.filter((ac) => ac.firstDeliveryOffset >= nextMonth && ac.firstDeliveryOffset <= nextMonth + 11);
  const source = 'Aerospace Forecast Gazette';
  if (debuting.length === 0) {
    return {
      id,
      text: `LAUNCH PREVIEW ${year}: No major aircraft releases are scheduled to hit the commercial markets this year.`,
      isRead: false,
      dateStr: `01/${year}`,
      details: {
        title: `Aviation Forecast ${year}`,
        source,
        content: `AEROSPACE FORECAST FOR ${year}\n\nNo major commercial aircraft models are scheduled to make their maiden deliveries this year.`,
      },
    };
  }
  const lines = debuting
    .map((ac) => {
      const m = String(1 + (ac.firstDeliveryOffset % 12)).padStart(2, '0');
      return `• ${ac.manufacturer} ${ac.type} (${ac.class}, Range: ${ac.maxRange}km, Pax: ${ac.capacity}) - Expected debut: ${m}/${year}`;
    })
    .join('\n');
  return {
    id,
    text: `LAUNCH PREVIEW ${year}: ${debuting.length} new aircraft models scheduled to debut this year (including ${debuting[0].manufacturer} ${debuting[0].type}). Click for full forecast.`,
    isRead: false,
    dateStr: `01/${year}`,
    details: {
      title: `Aviation Forecast ${year}`,
      source,
      content: `AEROSPACE FORECAST FOR ${year}\n\nThe world aviation industry expects these aircraft introductions this year:\n\n${lines}\n\nThey can be bought from their launch month.`,
    },
  };
}

/**
 * Geschätzter Erlös, den eine Störung kostet: Erlös der getroffenen Strecken im Bericht X × Anteil (Anzeige der Frage;
 * gebucht wird im Abschluss X+1 nach 8.9).
 */
export function disruptionStake(d: Pick<AppDisruption, 'routeIds' | 'cancelShare'>, report: Pick<MonthlyReport, 'routes'>): number {
  const revenue = new Map((report.routes ?? []).map((r) => [r.id, r.revenue]));
  return d.routeIds.reduce((s, id) => s + (revenue.get(id) ?? 0) * d.cancelShare, 0);
}

/**
 * Die KI vor dem Abschluss für den Vergleich der Zeitung (`rivalMoves`): Vor dem ersten Abschluss über das Modell tragen
 * die Ansichten noch die alten Kennungen (`ai_…`), danach die des Modells (`rival-<Kürzel>`, F56). Ohne Umrechnung
 * stünde jede KI einmal als „aufgelöst“ und „gegründet“ in der Zeitung.
 */
export function rivalViewsBefore(g: Pick<AppGame, 'rivals' | 'aiAirlines'>): AiAirline[] {
  return g.rivals ? [...g.aiAirlines] : g.aiAirlines.map((a) => ({ ...a, id: rivalCompanyId(a.code) }));
}

/**
 * Ein Monat über das Modell mit allem, was die Oberfläche dazu zeigt. `newId` vergibt die Kennungen der Nachrichten.
 */
export function modelMonthClose(input: ModelCloseInput, env: ModelEnv = defaultModelEnv(), newId: () => number = nextMessageId): ModelClose {
  const X = input.month;
  const next = X + 1;
  const dateStr = offsetToDateStr(X);
  const activeBefore = getActiveEvents(X);

  const goalText = input.annualGoal && input.annualGoal.year === 1960 + Math.floor(X / 12) && X % 12 === 11
    ? describeGoal(input.annualGoal, formatCurrency, formatNumber)
    : undefined;
  const scenarioText = scenarioStarsIfWon(input);
  const raw = runModelMonth(input, env, newId, {
    ...(goalText ? { goal: goalText } : {}),
    ...(scenarioText ? { scenario: scenarioText } : {}),
    skipKinds: ['randomEvent'],
  });

  // Bericht mit Marktanteil nach Abflügen (Chronik, Zeitung; wie der alte Abschluss).
  const share = departureMarketShare([...raw.routes], buildRivalOffers([...raw.aiAirlines]));
  const report: MonthlyReport = { ...raw.report, marketShare: share };
  const month: AppMonth = { ...raw, report, reportHistory: [...raw.reportHistory.slice(0, -1), report] };

  const extra: GameMessage[] = [];
  const routeLabel = (id: string) => {
    const r = month.routes.find((x) => x.id === id) ?? input.routes.find((x) => x.id === id);
    return r ? `${r.origin}-${r.destination}` : 'a closed route';
  };

  // Ereignisse: Start und Ende (geschichtliche und Zufallsereignisse), Krisen-Frage.
  setRuntimeRandomEvents([...month.randomEvents]);
  const afterEvents = getActiveEvents(next);
  const beforeKeys = new Set(activeBefore.map(eventKey));
  const afterKeys = new Set(afterEvents.map(eventKey));
  const eventsStarted = afterEvents.filter((ev) => !beforeKeys.has(eventKey(ev)));
  const eventsEnded = activeBefore.filter((ev) => !afterKeys.has(eventKey(ev)));
  let crisisQuestion: HistoricalEvent | null = null;
  for (const ev of eventsStarted) {
    extra.push(buildEventStartMessage(ev, newId()));
    if (!crisisQuestion && ev.choices && ev.choices.length > 0 && !input.eventChoices[eventKey(ev)]) crisisQuestion = ev;
  }
  for (const ev of eventsEnded) extra.push(buildEventEndMessage(ev, newId(), next));

  const preview = launchPreviewMessage(next, 0);
  if (preview) extra.push({ ...preview, id: newId() });

  // Personal: Unruhe und Streik-Frage (der Streik selbst kommt aus dem Modell, 8.7).
  const strike = month.staff.strike;
  const strikeCalled = !!strike && strike.startOffset === next && input.staff.strike?.startOffset !== next;
  if (input.staff.morale >= STRIKE_MORALE_THRESHOLD && month.staff.morale < STRIKE_MORALE_THRESHOLD && !strikeCalled) {
    extra.push({
      id: newId(),
      text: `STAFF UNREST: morale has fallen to ${Math.round(month.staff.morale)}.`,
      isRead: false,
      dateStr,
      details: {
        title: 'Staff unrest',
        source: 'Human resources',
        content:
          `Morale among crew and ground staff is down to ${Math.round(month.staff.morale)}. Below ${STRIKE_MORALE_THRESHOLD} the unions ` +
          `may call a strike at any month's end.\n\nPay is set under My Company > Staff.`,
      },
    });
  }
  const decisions: GameDecision[] = [];
  if (strikeCalled) decisions.push(ensureFreeOption(strikeQuestion(month.staff, next, offsetToDateStr(next), report.routeRevenues)));

  // Störungen des neuen Monats: Ausblick und Fragen zu großen.
  const known = new Set(input.disruptions.map((d) => d.id));
  const rolled = month.disruptions.filter((d) => d.offset === next && !known.has(d.id));
  if (rolled.length > 0) {
    const monthStr = offsetToDateStr(next);
    extra.push({
      id: newId(),
      text: rolled.length === 1 ? `OPERATIONS: ${disruptionTitle(rolled[0])} in ${monthStr}.` : `OPERATIONS: ${rolled.length} disruptions in ${monthStr}.`,
      isRead: false,
      dateStr,
      details: {
        title: `Operations outlook ${monthStr}`,
        source: 'Operations control',
        content: `The following will cost flights in ${monthStr}:\n\n${rolled.map((d) => describeDisruption(d, routeLabel)).join('\n')}`,
      },
    });
    const major = rolled.filter((d) => d.cancelShare >= MAJOR_DISRUPTION_SHARE);
    for (const d of disruptionsToAsk(major, (x) => disruptionStake(x, report))) {
      decisions.push(ensureFreeOption(buildDisruptionDecision(d, monthStr, disruptionStake(d, report), routeLabel)));
    }
  }

  // Vogelschläge: bezahlt im Abschluss X (8.6); der Hinweis zeigt die Rechnung.
  const birdStrikeAlerts: BirdStrike[] = month.birdStrikes.map((b) => ({
    id: `bird_${X}_${b.registration}`,
    offset: X,
    routeId: input.routes.find((r) => r.aircraft === b.registration)?.id ?? '',
    registration: b.registration,
    cost: b.cost,
  }));

  // Kampagnen, deren letzter Monat X war.
  for (const c of input.marketing.campaigns) {
    if (month.marketing.campaigns.some((x) => x.id === c.id)) continue;
    const where = c.tier === 'global' ? 'worldwide' : `in ${REGION_LABELS[c.region]}`;
    extra.push({
      id: newId(),
      text: `CAMPAIGN ENDED: ${CAMPAIGN_SPECS[c.tier].label} campaign ${where}.`,
      isRead: false,
      dateStr,
      details: {
        title: 'Campaign ended',
        source: 'Marketing department',
        content: `The ${CAMPAIGN_SPECS[c.tier].label.toLowerCase()} campaign ${where} has run its ${c.duration} months.`,
      },
    });
  }

  // Jubiläum alle zehn Jahre.
  if (next > input.startMonth && (next - input.startMonth) % 120 === 0) {
    const years = (next - input.startMonth) / 12;
    // Karriere-Punkte nach dem Modell (6.12) mit dem Unternehmenswert nach dem Abschluss (E48).
    const score = playerScore({
      companyValue: month.companyValue,
      month: next,
      rank: month.career.rank,
      free: input.freeMode,
      milestones: month.milestones.length,
      reputation: month.reputation,
      takeovers: month.career.takeovers,
      researchDone: month.career.research.done,
      years,
    });
    extra.push({
      id: newId(),
      text: `ANNIVERSARY: ${years} years of ${input.airlineName || 'Neo Airlines'}. Career score ${formatNumber(score.total)}.`,
      isRead: false,
      dateStr,
      details: {
        title: `${years} years`,
        source: 'Board of Directors',
        content: `The board looks back on ${years} years: career score ${formatNumber(score.total)}.\n\nYou may retire at any time under Career.`,
      },
    });
  }

  // Chronik.
  const playerNews = month.news.filter((n) => n.companyId === PLAYER_ID);
  const earned = playerNews.flatMap((n) => {
    if (n.kind === 'milestone') return [{ title: MILESTONES.find((m) => m.id === n.subject)?.title ?? n.subject ?? 'Milestone' }];
    if (n.kind === 'rankUp') {
      const r = RANKS[n.amount ?? -1];
      return r ? [{ title: `Rank: ${r.title}` }] : [];
    }
    return [];
  });
  const goalNews = playerNews.find((n) => n.kind === 'goalMet' || n.kind === 'goalMissed');
  const goal = goalNews && input.annualGoal
    ? {
      year: input.annualGoal.year,
      target: input.annualGoal.target,
      achieved: 0,
      met: goalNews.kind === 'goalMet',
      text: `${input.annualGoal.year} goal ${goalNews.kind === 'goalMet' ? 'met' : 'missed'}${goalText ? `: ${goalText}` : ''}.`,
    }
    : null;
  const regionsNow = regionsServed([...month.routes], airportsMapAdjusted);
  const monthChronicle = chronicleEntriesForMonth([...input.chronicle], {
    offset: X,
    profit: report.totalProfit,
    capitalAfter: month.capital,
    reputation: month.reputation,
    reputationBefore: input.reputation,
    history: [...input.reportHistory],
    milestones: earned,
    goal,
    eventsStarted,
    eventsEnded: eventsEnded.map((ev) => ({ title: ev.title, endOffset: next })),
    strike: strikeCalled ? { offset: next, morale: month.staff.morale } : null,
    disruptions: input.disruptions
      .filter((d) => d.offset === X)
      .map((d) => ({
        offset: d.offset,
        cancelShare: d.cancelShare,
        routeCount: d.routeIds.length,
        mitigated: d.mitigated,
        title: disruptionTitle(d),
        where: disruptionRoutesLabel(d, routeLabel, 3),
      })),
    regions: regionsNow,
    homeRegion: input.homeRegion,
    hubs: month.transferHubs.map((h) => ({ id: h.id, name: airportsMapAdjusted.get(h.id)?.name ?? h.id, pax: h.pax })),
  });

  // Szenario: Sterne, Chronik, Ergebnis-Dialog. Entschieden hat das Modell (8.15).
  let scenarioStars: ScenarioStars | null = null;
  let scenarioDecided: { title: string; won: boolean; reason: string } | null = null;
  if (input.scenario?.status === 'running' && month.scenario && month.scenario.status !== 'running') {
    const won = month.scenario.status === 'won';
    const title = scenarioById(input.scenario.id)?.title ?? input.scenario.id;
    const reason = month.scenario.result?.reason ?? '';
    const stars = won ? scenarioText?.stars ?? 1 : 0;
    scenarioDecided = { title, won, reason };
    if (stars > 0) {
      const best = bestStars(input.scenarioStars, input.scenario.id, stars);
      if (best !== input.scenarioStars) scenarioStars = best;
    }
    monthChronicle.push({
      offset: X,
      kind: 'scenario',
      key: 'scenario:result',
      text: `Scenario "${title}" ${won ? `won with ${stars} star${stars === 1 ? '' : 's'}` : 'lost'}. ${reason}`,
    });
  }
  const chronicle = monthChronicle.length > 0 ? appendChronicle([...input.chronicle], monthChronicle) : input.chronicle;

  // Zeitung.
  const nextFuel = input.getFuelData(next);
  const nextDemand = input.getBaseGlobalDemand(next);
  const edition = buildEdition({
    offset: X,
    airlineName: input.airlineName,
    report,
    prevReport: input.latestReport,
    profitHistory: input.reportHistory.map((r) => r.totalProfit),
    chronicle: monthChronicle,
    milestones: earned,
    eventsStarted,
    eventsEnded,
    eventsRunning: afterEvents,
    strike: strikeCalled ? { morale: month.staff.morale } : null,
    disruptions: rolled.map((d) => ({
      kind: d.kind,
      title: disruptionTitle(d),
      text: describeDisruption(d, routeLabel).replace(/^•\s*/, ''),
      cancelShare: d.cancelShare,
      routeCount: d.routeIds.length,
      ref: d.ref,
    })),
    rivalMoves: rivalMoves(rivalViewsBefore(input), [...month.aiAirlines]),
    launches: input.marketing.campaigns
      .filter((c) => c.startOffset === X)
      .map((c) => ({ tier: CAMPAIGN_SPECS[c.tier].label, region: c.tier === 'global' ? ('global' as const) : c.region })),
    ffpStarted: input.marketing.ffpActive && input.marketing.ffpSinceOffset === X,
    scenario: scenarioDecided,
    airportName: (id) => airportsMapAdjusted.get(id)?.name || id,
    ticker: {
      fuelPerLitre: nextFuel.price / LITRES_PER_GALLON,
      fuelTrend: nextFuel.trend,
      demand: nextDemand.value,
      demandTrend: nextDemand.trend,
      rank: 1 + month.aiAirlines.filter((ai) => (ai.capital || 0) > month.capital).length,
      airlines: month.aiAirlines.length + 1,
    },
  });

  const monthsPassed = next - input.startMonth;
  const autosave = input.autosaveInterval >= 1 && input.autosaveInterval <= 12 && monthsPassed > 0 && monthsPassed % input.autosaveInterval === 0;
  const goalOfferOpen = playerNews.some((n) => n.kind === 'goalOffered') && !!month.career.goalOffer;

  return {
    month,
    // Nachrichten des Modells sind schon neueste zuerst; die der Oberfläche kommen davor, ebenfalls neueste zuerst.
    messages: [...extra.reverse(), ...month.messages],
    decisions,
    crisisQuestion,
    chronicle,
    edition,
    openNewspaper: input.gameSettings.newspaper,
    scenarioStars,
    scenarioResultOpen: scenarioDecided !== null,
    goalOfferOpen,
    birdStrikeAlerts,
    autosave,
  };
}
