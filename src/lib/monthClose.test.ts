import test from 'node:test';
import assert from 'node:assert/strict';
import { closeMonth, type MonthCloseCommand, type MonthCloseInput } from './monthClose';
import { DEFAULT_BRANDING, DEFAULT_GAME_SETTINGS, NEUTRAL_PLAYER_MODIFIERS, createGameSystems } from './gameState';
import { NEUTRAL_EFFECTS } from './research';

/** An airline in its first month: money, a hub, and nothing else. */
function freshGame(over: Partial<MonthCloseInput> = {}): MonthCloseInput {
  const systems = createGameSystems();
  return {
    getFuelData: () => ({ price: 1, trend: '0%' }),
    getBaseGlobalDemand: () => ({ value: 1, trend: '0%' }),
    currentDateOffset: 0,
    startDateOffset: 0,
    airportManagement: { FRA: { level: 2, slots: { regional: 0, narrowbody: 0, widebody: 0 }, stands: { narrowbody: 0, widebody: 0 }, desks: { normal: 1, self: 0 } } },
    difficulty: 'Normal',
    rivalOffers: [],
    routes: [],
    fleet: [],
    playerMods: NEUTRAL_PLAYER_MODIFIERS,
    researchFx: NEUTRAL_EFFECTS,
    aiAirlines: [],
    marketing: systems.marketing,
    disruptions: [],
    reputation: 50,
    eventChoices: {},
    staff: systems.staff,
    profitStreak: 0,
    career: systems.career,
    capital: 25_000_000,
    milestones: [],
    yearsInBusiness: 0,
    randomEvents: [],
    pendingDecisions: [],
    monthlyCapex: [],
    selectedHub: 'FRA',
    aiAirlinesCount: 0,
    aiDifficulty: 'Normal',
    airlineCode: 'TA',
    branding: DEFAULT_BRANDING,
    annualGoal: null,
    reportHistory: [],
    fleetValue: 0,
    freeMode: false,
    airlineName: 'Test Air',
    chronicle: [],
    homeRegion: 'EU',
    scenario: null,
    scenarioStars: {},
    userId: null,
    latestReport: null,
    gameSettings: { ...DEFAULT_GAME_SETTINGS },
    autosaveInterval: 6,
    // Never below any event's probability, so no random event, disruption or strike is rolled.
    rng: () => 0.999,
    ...over
  };
}

/** The value the last call of a setter was given; undefined when it was not called. */
const lastValue = (commands: MonthCloseCommand[], setter: MonthCloseCommand['setter']) =>
  commands.filter(c => c.setter === setter).pop()?.value;

/** Runs every recorded call of a setter on a starting value, as React would. */
function replay<T>(commands: MonthCloseCommand[], setter: MonthCloseCommand['setter'], start: T): T {
  return commands
    .filter(c => c.setter === setter)
    .reduce<T>((value, c) => (typeof c.value === 'function' ? (c.value as unknown as (prev: T) => T)(value) : (c.value as unknown as T)), start);
}

test('closing a month moves the date on and shows the report', () => {
  const commands = closeMonth(freshGame());
  assert.equal(lastValue(commands, 'setCurrentDateOffset'), 1);
  assert.equal(lastValue(commands, 'setView'), 'monthly-overview');
});

test('the report of a month without routes: no revenue, and the airport upkeep as the loss', () => {
  const game = freshGame();
  const commands = closeMonth(game);
  const history = replay(commands, 'setReportHistory', game.reportHistory);
  assert.equal(history.length, 1);
  const report = history[0];
  assert.equal(report.month, 1);
  assert.equal(report.year, 1960);
  assert.equal(report.routeRevenues, 0);
  assert.equal(report.totalProfit, -report.airportUpkeep);
  // The bank balance moves by exactly what the report says.
  const capital = replay(commands, 'setCapital', game.capital);
  assert.equal(capital, game.capital + report.totalProfit);
  assert.equal(report.capitalAfter, capital);
});

test('one-off spending is cleared at the close and listed in the report', () => {
  const game = freshGame({ monthlyCapex: [{ label: 'Aircraft Purchases', amount: 1_000_000 }] });
  const commands = closeMonth(game);
  assert.deepEqual(replay(commands, 'setMonthlyCapex', game.monthlyCapex), []);
  const report = replay(commands, 'setReportHistory', game.reportHistory)[0];
  assert.equal(report.capex, 1_000_000);
  assert.equal(report.cashChange, report.totalProfit - 1_000_000);
});

test('the autosave is asked for when the interval comes round, and only then', () => {
  assert.equal(lastValue(closeMonth(freshGame({ autosaveInterval: 1 })), 'setPendingAutosave'), true);
  assert.equal(lastValue(closeMonth(freshGame({ autosaveInterval: 6 })), 'setPendingAutosave'), undefined);
  assert.equal(lastValue(closeMonth(freshGame({ autosaveInterval: 6, currentDateOffset: 5 })), 'setPendingAutosave'), true);
});

test('the newspaper opens with the close unless it is switched off', () => {
  assert.equal(lastValue(closeMonth(freshGame()), 'setIsNewspaperOpen'), true);
  const off = closeMonth(freshGame({ gameSettings: { ...DEFAULT_GAME_SETTINGS, newspaper: false } }));
  assert.equal(lastValue(off, 'setIsNewspaperOpen'), undefined);
});

test('December closes with next year\'s goals on offer', () => {
  const commands = closeMonth(freshGame({ currentDateOffset: 11 }));
  assert.equal(lastValue(commands, 'setGoalOfferOpen'), true);
  const career = lastValue(commands, 'setCareer') as MonthCloseInput['career'];
  assert.equal(career.goalOffer?.year, 1961);
  assert.ok((career.goalOffer?.options.length ?? 0) >= 1, 'at least one goal to choose');
});

test('the same state and the same random numbers give the same close', () => {
  const strip = (commands: MonthCloseCommand[]) => JSON.stringify(commands.map(c => [c.setter, typeof c.value === 'function' ? 'fn' : c.value]));
  // Message ids come from a running counter, so only their order is compared here.
  const withoutIds = (text: string) => text.replace(/"id":\d+/g, '"id":0');
  assert.equal(withoutIds(strip(closeMonth(freshGame()))), withoutIds(strip(closeMonth(freshGame()))));
});

test('full aircraft do not raise reputation; satisfaction and condition do', async () => {
  const { computeReputationTarget } = await import('./monthClose');
  const base = { weightedSat: 100, meanInterior: 90, meanAirframe: 90 };
  assert.equal(computeReputationTarget({ ...base, loadFactor: 0.3 }), computeReputationTarget({ ...base, loadFactor: 1 }));
  assert.ok(computeReputationTarget({ ...base, weightedSat: 120 }) > computeReputationTarget(base));
  assert.ok(computeReputationTarget({ ...base, meanInterior: 50 }) < computeReputationTarget(base));
  assert.equal(computeReputationTarget({ weightedSat: 130, meanInterior: 100, meanAirframe: 100 }), 100);
});
