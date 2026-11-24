import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AIRCRAFT_CLASSES, ALL_CLASS_IDS, classGateMessage, classOfAircraft, classesOfFleet, openClasses
} from './aircraftClasses';
import { projectsForClasses } from './research';
import { aircraftList } from '../data/aircraft';
import { SCENARIOS } from '../data/scenarios';
import { CLASS_RESEARCH } from '../model/constants';
import { researchProject, startingResearch } from '../model/progress';

test('an aircraft belongs to the class its size and speed give (model sizeClassOf)', () => {
  assert.equal(classOfAircraft({ class: 'Regional', capacity: 50 }), 'commuter');
  assert.equal(classOfAircraft({ class: 'Regional', capacity: 78 }), 'regional');
  assert.equal(classOfAircraft({ class: 'Narrowbody', capacity: 110 }), 'regional', 'a small jet is a regional aircraft');
  assert.equal(classOfAircraft({ class: 'Narrowbody', capacity: 186 }), 'narrowbody');
  assert.equal(classOfAircraft({ class: 'Widebody', capacity: 315 }), 'widebody');
  assert.equal(classOfAircraft({ class: 'Widebody', capacity: 660 }), 'jumbo');
  assert.equal(classOfAircraft({ class: 'Narrowbody', capacity: 128, cruiseSpeed: 2158 }), 'supersonic');
  assert.equal(classOfAircraft({}), 'commuter');
});

test('every aircraft of the catalogue has a class, and every class has aircraft', () => {
  const seen = new Set(aircraftList.map(a => classOfAircraft(a)));
  for (const id of ALL_CLASS_IDS) assert.ok(seen.has(id), `no aircraft in ${id}`);
});

test('the game starts with turboprop commuters to fly', () => {
  const atStart = aircraftList.filter(a => a.firstDeliveryOffset <= 0 && (a.lastDeliveryOffset ?? 0) >= 0 && classOfAircraft(a) === 'commuter');
  assert.ok(atStart.length >= 2);
});

test('every class but the first is opened by the model class project', () => {
  assert.equal(AIRCRAFT_CLASSES[0].projectId, null);
  for (const c of AIRCRAFT_CLASSES.slice(1)) {
    const project = researchProject(c.projectId!);
    assert.equal(project.kind, 'class');
    assert.equal(project.opens, c.id);
  }
  assert.equal(Object.keys(CLASS_RESEARCH).length, AIRCRAFT_CLASSES.length - 1);
});

test('only the developed classes and those of the fleet are open, all of them in Free Mode', () => {
  assert.deepEqual([...openClasses([])], ['commuter']);
  assert.deepEqual([...openClasses(['class-regional'])].sort(), ['commuter', 'regional']);
  assert.equal(openClasses([], [], 'free').size, ALL_CLASS_IDS.length);
  assert.deepEqual([...openClasses(['unknown'])], ['commuter']);
  assert.deepEqual([...openClasses([], [{ class: 'Widebody', capacity: 300 }])].sort(), ['commuter', 'widebody']);
});

test('the classes of a fleet', () => {
  const fleet = [{ class: 'Widebody', capacity: 300 }, { class: 'Regional', capacity: 40 }];
  assert.deepEqual([...classesOfFleet(fleet)].sort(), ['commuter', 'widebody']);
  assert.deepEqual([...classesOfFleet([])], []);
});

test('the refusal names the aircraft and the class, and is null when the class is open', () => {
  const dc10 = { manufacturer: 'McDonnell Douglas', type: 'DC-10-30', class: 'Widebody', capacity: 380 };
  assert.equal(classGateMessage(dc10, new Set(['widebody'])), null);
  const msg = classGateMessage(dc10, openClasses([]))!;
  assert.match(msg, /DC-10-30/);
  assert.match(msg, /Wide-body/);
  assert.match(msg, /up to 500 seats/);
  assert.match(msg, /Develop/);
});

test('a scenario\'s start rank has already developed every class its start fleet flies, or the game adds it', () => {
  for (const sc of SCENARIOS) {
    const classes = new Set(sc.fleet.map(e => {
      const spec = aircraftList.find(a => a.id === e.model);
      assert.ok(spec, `${sc.id}: ${e.model} exists`);
      return classOfAircraft(spec!);
    }));
    const developed = new Set([...startingResearch(sc.startRank ?? 0).done, ...projectsForClasses(classes)]);
    for (const c of classes) {
      const id = AIRCRAFT_CLASSES.find(d => d.id === c)!.projectId;
      if (id) assert.ok(developed.has(id), `${sc.id}: ${id} is developed`);
    }
  }
});
