import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekly, version, monday, localDate, weekDays } from '../src/wellbeing.ts';
const dates=weekDays('2026-11-09');
const rows=(ratings)=>ratings.map((rating,i)=>({date:dates[i],version,ratings:rating}));

test('missing days and historical versions never satisfy the gate',()=>{
  const checks=rows([[5,4,3,2],[5,4,3,2],[5,4,null,2]]);
  checks.push({date:dates[3],version:'earlier',ratings:[5,5,5,5]});
  assert.deepEqual(weekly(checks,dates).coverage,[3,3,2,3]);
  assert.equal(weekly(checks,dates).comparisonScore,null);
  assert.equal(weekly(checks,dates).completed,2);
});
test('means are equally weighted and stage follows rounded score',()=>{
  const checks=rows([[4,4,4,4],[4,4,4,4],[4,4,4,4],[3,null,null,null],[4,null,null,null],[4,null,null,null]]);
  assert.equal(weekly(checks,dates).score,4);
  assert.equal(weekly(checks,dates).stage,'Doing well');
  assert.equal(weekly(checks,dates.slice(0,2)).comparisonScore,null);
  for (const [rating,stage] of [[1,'Feeling stretched'],[2,'Finding balance'],[3,'Feeling steady'],[4,'Doing well'],[5,'Doing well']]) {
    assert.equal(weekly(rows(Array.from({length:3},()=>[rating,rating,rating,rating])),dates).stage, stage);
  }
});
test('one complete day gives a stage and all-skipped days count as participation',()=>{
  const checks=rows([[4,3,4,3],[null,null,null,null]]);
  const summary=weekly(checks,dates);
  assert.equal(summary.score,3.5);
  assert.equal(summary.stage,'Feeling steady');
  assert.equal(summary.completed,1);
  assert.equal(summary.participation,2);
  assert.deepEqual(summary.coverage,[1,1,1,1]);
  assert.equal(summary.comparisonScore,null);
});
test('ratings scattered across partial days qualify a comparison but not the stage',()=>{
  const checks=rows([[5,null,3,2],[5,4,null,2],[5,4,3,null],[null,4,3,2]]);
  const summary=weekly(checks,dates);
  assert.equal(summary.score,null);
  assert.equal(summary.comparisonScore,3.5);
  assert.equal(summary.completed,0);
});
test('calendar day and Monday align across time zones',()=>{
  const moment=new Date('2026-11-09T01:00:00Z');
  assert.equal(monday(localDate('America/Los_Angeles',moment)),'2026-11-02');
  assert.equal(monday(localDate('Asia/Dubai',moment)),'2026-11-09');
});
