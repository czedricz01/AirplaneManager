import test from 'node:test';
import assert from 'node:assert/strict';

import { FILLER_STORIES, buildEdition, fillerFor, rivalMoves, type EditionInput } from './newspaper';
import { setDecimalSymbol } from './format';

setDecimalSymbol('.');

const quiet = (over: Partial<EditionInput> = {}): EditionInput => ({
  offset: 180, // 01/1975, the paper is dated February 1975
  airlineName: 'Neo Airlines',
  report: { totalProfit: 1_000_000, routeRevenues: 8_000_000, paxTotal: 30_000, transferPax: 1_200, reputation: 62 },
  prevReport: { totalProfit: 900_000, routeRevenues: 7_500_000, reputation: 61 },
  ...over
});

const oil = { title: '1973 Oil Crisis', description: 'An oil embargo.', demandMultiplier: 0.9, fuelMultiplier: 2, duration: 18 };
const surge = { title: 'Summer Vacation Surge', demandMultiplier: 1.12, fuelMultiplier: 1.05, duration: 3 };
const expansion = { airline: 'Lufthansa', code: 'LH', hub: 'FRA', kind: 'expansion' as const, destinations: ['JFK', 'ORD'], count: 2 };
const defect = { kind: 'technical' as const, title: 'Technical defect: D-ABXA', text: 'Technical defect: D-ABXA: 25% of flights cancelled on FRA-LHR.', cancelShare: 0.25 };

test('the headline goes to the biggest news, in a fixed order', () => {
  const everything: Partial<EditionInput> = {
    eventsStarted: [surge, oil],
    strike: { morale: 28 },
    disruptions: [defect],
    milestones: [{ title: 'Ten aircraft', detail: 'A fleet rather than a handful of aeroplanes.' }],
    chronicle: [{ offset: 180, kind: 'record', key: 'record:profit', value: 1e6, text: 'Best month yet: $1,000,000 operating profit.' }],
    rivalMoves: [expansion],
    eventsEnded: [{ title: 'Economic Slump' }]
  };
  const order = ['crisis', 'strike', 'disruption', 'milestone', 'record', 'rival', 'event', 'filler'];
  const drop: Record<string, Partial<EditionInput>> = {
    crisis: { eventsStarted: [surge] },
    strike: { strike: null },
    disruption: { disruptions: [] },
    milestone: { milestones: [] },
    record: { chronicle: [] },
    rival: { rivalMoves: [] },
    event: { eventsStarted: [], eventsEnded: [] }
  };
  let input = quiet(everything);
  for (const kind of order) {
    assert.equal(buildEdition(input).kind, kind);
    input = { ...input, ...drop[kind] };
  }
});

test('front-page stories name what happened', () => {
  const crisis = buildEdition(quiet({ eventsStarted: [oil] }));
  assert.equal(crisis.headline, '1973 Oil Crisis Rocks the Airline Industry');
  assert.match(crisis.subhead, /Demand −10%, fuel \+100%/);
  assert.equal(crisis.date, 'February 1975');
  assert.equal(crisis.issue, 'Vol. 16 · No. 2');
  assert.equal(crisis.price, '25¢');

  assert.equal(buildEdition(quiet({ strike: { morale: 28.4 } })).headline, 'Neo Airlines Grounded as Staff Walk Out');
  assert.equal(buildEdition(quiet({ disruptions: [{ ...defect, cancelShare: 0.1 }] })).kind, 'filler', 'a small disruption is no front-page news');
  assert.equal(buildEdition(quiet({ disruptions: [{ kind: 'airport-strike', title: 'Airport strike at CDG', text: 'x', cancelShare: 0.3, ref: 'CDG' }] })).headline,
    'Airport Strike at CDG Snarls Neo Airlines Schedule');

  const loss = buildEdition(quiet({ report: { totalProfit: -2e6, routeRevenues: 1e6 }, profitHistory: [5e5, -1e6, 2e5, 3e5, 1e5, 0] }));
  assert.equal(loss.kind, 'record');
  assert.equal(loss.headline, 'Neo Airlines Posts Its Worst Month Yet');
  assert.equal(buildEdition(quiet({ report: { totalProfit: -2e6, routeRevenues: 1e6 }, profitHistory: [-3e6] })).kind, 'filler', 'not with too little history');

  const names: Record<string, string> = { FRA: 'Frankfurt', JFK: 'New York', ORD: 'Chicago' };
  const rival = buildEdition(quiet({ rivalMoves: [expansion, { ...expansion, airline: 'Air France', code: 'AF', hub: 'CDG', destinations: ['JFK'], count: 1 }], airportName: id => names[id] || id }));
  assert.equal(rival.headline, 'Lufthansa Spreads Its Wings', 'the bigger expansion');
  assert.match(rival.lead, /New York and Chicago/);
  const watch = rival.columns.find(c => c.title === 'Rival watch')!;
  assert.equal(watch.body, 'Air France adds New York to its CDG network.');
  assert.doesNotMatch(watch.body, /Lufthansa/, 'the front-page story is not repeated');
});

test('the columns always carry results, markets and rivals, and the brief when there is one', () => {
  const plain = buildEdition(quiet({ ticker: { fuelPerLitre: 0.575, fuelTrend: '-4.0%', demand: 0.96, demandTrend: '+1.0%', rank: 2, airlines: 6 } }));
  assert.deepEqual(plain.columns.map(c => c.title), ['Neo Airlines results', 'Markets', 'Rival watch']);
  assert.match(plain.columns[0].body, /operating profit of \$1,000,000, up from \$900,000/);
  const recovery = buildEdition(quiet({ prevReport: { totalProfit: -5e5, routeRevenues: 1 } }));
  assert.match(recovery.columns[0].body, /\$1,000,000, against a loss of \$500,000 the month before/);
  assert.match(plain.columns[0].body, /30,000 passengers flew with the airline, 1,200 of them changing planes/);
  assert.match(plain.columns[0].body, /reputation rises to 62/);
  assert.match(plain.columns[1].body, /\$0\.575 a litre \(-4\.0% on the month\)/);
  assert.deepEqual(plain.ticker.map(t => t.value), ['$0.575/L', '96', '#2 of 6']);

  const busy = buildEdition(quiet({
    chronicle: [{ offset: 180, kind: 'network', key: 'region:NA', text: 'First route to North America: FRA-JFK.' }],
    launches: [{ tier: 'National', region: 'EU' }],
    ffpStarted: true
  }));
  assert.equal(busy.columns.length, 4);
  assert.equal(busy.columns[3].title, 'In brief');
  assert.match(busy.columns[3].body, /First route to North America.*national advertising campaign in Europe.*frequent flyer programme/);
});

test('a quiet month prints an era-appropriate filler, the same one every time', () => {
  for (const offset of [0, 45, 180, 230, 400, 700]) {
    const year = 1960 + Math.floor(offset / 12);
    const story = fillerFor(offset);
    assert.ok(year >= story.from && year <= story.to, `${story.headline} fits ${year}`);
  }
  assert.equal(fillerFor(0).headline, 'The Jet Age Takes Hold');
  assert.notEqual(fillerFor(0).headline, fillerFor(1).headline, 'consecutive months differ');
  assert.ok(FILLER_STORIES.every(f => f.from <= f.to));

  const a = buildEdition(quiet({ rivalMoves: [expansion], chronicle: [], eventsRunning: [{ title: '1973 Oil Crisis' }] }));
  const b = buildEdition(quiet({ rivalMoves: [expansion], chronicle: [], eventsRunning: [{ title: '1973 Oil Crisis' }] }));
  assert.deepEqual(a, b);
  assert.equal(buildEdition(quiet()).headline, fillerFor(180).headline);
});

test('rival moves compare the airlines before and after their turn', () => {
  const before = [
    { id: 'a', name: 'Alpha', code: 'AA', hub: 'FRA', fleet: [1, 2], routes: [{ origin: 'FRA', destination: 'LHR' }, { origin: 'FRA', destination: 'CDG' }] },
    { id: 'b', name: 'Beta', code: 'BB', hub: 'AMS', fleet: [1], routes: [] },
    { id: 'z', name: 'Zulu', code: 'ZZ', hub: 'MAD', fleet: [], routes: [] }
  ];
  const after = [
    { id: 'a', name: 'Alpha', code: 'AA', hub: 'FRA', fleet: [1, 2, 3], routes: [{ origin: 'FRA', destination: 'LHR' }, { origin: 'FRA', destination: 'JFK' }] },
    { id: 'b', name: 'Beta', code: 'BB', hub: 'AMS', fleet: [1], routes: [] },
    { id: 'c', name: 'Gamma', code: 'GG', hub: 'VIE', fleet: [1], routes: [{ origin: 'VIE', destination: 'FCO' }] }
  ];
  assert.deepEqual(rivalMoves(before, after).map(m => [m.airline, m.kind, m.destinations, m.count]), [
    ['Alpha', 'expansion', ['JFK'], 1],
    ['Alpha', 'closure', ['CDG'], 1],
    ['Alpha', 'fleet', [], 1],
    ['Gamma', 'founded', ['FCO'], 1],
    ['Zulu', 'folded', [], 0]
  ]);
  assert.deepEqual(rivalMoves(after, after), []);
});
