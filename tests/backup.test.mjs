import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBackup, parseBackup } from '../src/backup.ts';

const date = '2026-11-15';
const updated = '2026-11-15T08:00:00.000Z';
const example = () => ({
  draft: { note: 'Fictional journal', tag: '', time: 10, energy: 'Steady' },
  active: null, smaller: null,
  history: [{ id: 'step-1', date: updated, day: date, step: { title: 'Open the document', minutes: 2, reason: 'Start here.' }, outcome: 'Done', barrier: '' }],
  checks: [{ date, updated, zone: 'Asia/Dubai', version: 'ignite-pillars-v1', ratings: [4,3,4,3] }],
  settings: { zone: 'Asia/Dubai', setup: true }, prompts: {}, ratingDrafts: {}, ratingContext: {},
  extras: { water: [{ id: 'water-1', day: date, text: '255 mL', ml: 255 }], meals: [], activity: [], sleep: [], tasks: [], wake: '07:00', win: '22:30', stop: '22:00' },
  lantern: { dock: 'right', messages: [{ role: 'user', text: 'Fictional chat' }] }, journalHistory: [],
});

test('round trips a versioned IGNITE backup and previews record counts', () => {
  const data = example();
  const envelope = createBackup(data);
  assert.deepEqual({ app: envelope.app, version: envelope.version }, { app: 'IGNITE', version: 1 });
  const restored = parseBackup(JSON.stringify(envelope));
  assert.equal(restored.legacy, false);
  assert.deepEqual(restored.data, data);
  assert.deepEqual(restored.summary, { checkIns: 1, steps: 1, healthLogs: 1, chatMessages: 1, tasks: 0 });
  assert.equal(parseBackup(JSON.stringify(data)).legacy, true);
  const legacy = parseBackup(JSON.stringify({draft:data.draft,active:null,smaller:null,history:data.history,extras:data.extras}));
  assert.equal(legacy.legacy,true);
  assert.deepEqual(legacy.summary,{checkIns:0,steps:1,healthLogs:1,chatMessages:0,tasks:0});
});

test('rejects malformed ratings, dates, prototype keys and duplicate record identifiers', () => {
  const badRating = example();
  badRating.checks[0].ratings[0] = 6;
  assert.throws(() => parseBackup(JSON.stringify(createBackup(badRating))), /check-in/i);
  const invalidDate = example();
  invalidDate.extras.water[0].day = '2026-11-31';
  assert.throws(() => parseBackup(JSON.stringify(createBackup(invalidDate))), /water/i);
  const duplicate = example();
  duplicate.extras.water.push({...duplicate.extras.water[0]});
  assert.throws(() => parseBackup(JSON.stringify(createBackup(duplicate))), /duplicate/i);
  const invalidSetup={...example(),setupDraft:{stage:0,preferences:{},schedule:{water:'replace stored logs'}}};
  assert.throws(()=>parseBackup(JSON.stringify(createBackup(invalidSetup))),/drafts/i);
  assert.throws(() => parseBackup('{"__proto__":{"polluted":true}}'), /unsafe/i);
  assert.throws(() => parseBackup(JSON.stringify({ ...createBackup(example()), version: 2 })), /version/i);
});

test('retains a sleep band and rejects an exact duration attached to it',()=>{
  const data=example();
  const approximate={id:'sleep-1',day:date,zone:'Asia/Dubai',text:'8 h or more',band:'8 h or more'};
  data.extras.sleep.push(approximate);
  assert.deepEqual(parseBackup(JSON.stringify(createBackup(data))).data.extras.sleep[0],approximate);
  approximate.minutes=480;
  assert.throws(()=>parseBackup(JSON.stringify(createBackup(data))),/sleep history/i);
});
