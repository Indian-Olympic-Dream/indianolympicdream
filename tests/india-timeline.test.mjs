import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
const compiled = buildSync({entryPoints:['src/app/games/india-timeline.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {buildIndiaTimeline,timeUntilStart} = await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const now=new Date('2026-09-20T03:00:00Z');
const row=(id,startTime,status='scheduled')=>({id,startTime,status,timingPrecision:'exact',participationStatus:'confirmed',gamesParticipations:[{id:'india'}]});
test('rolling India view includes the next 24 hours across the IST day boundary',()=>{
 const view=buildIndiaTimeline([row('next','2026-09-21T02:00:00Z'),row('later','2026-09-21T04:00:00Z')],now);
 assert.deepEqual(view.upcoming.map(r=>r.id),['next']);assert.equal(view.nextDay,false);
});
test('past scheduled rows await an update, never become live or a result by the clock',()=>{
 const view=buildIndiaTimeline([row('past','2026-09-20T02:00:00Z')],now);
 assert.equal(view.pending.length,1);assert.equal(view.live.length,0);assert.equal(view.results.length,0);
});
test('before competition, the next confirmed India day is a labelled fallback',()=>{
 const view=buildIndiaTimeline([row('next','2026-09-22T05:00:00Z')],now);
 assert.equal(view.nextDay,true);assert.equal(view.focusDay,'2026-09-22');assert.equal(view.upcoming.length,1);
});
test('choosing an empty day stays on that day; programme windows never enter the India feed',()=>{
 const programme={...row('window','2026-09-20T05:00:00Z'),gamesParticipations:[],timingPrecision:'session-window'};
 const view=buildIndiaTimeline([programme,row('next','2026-09-22T05:00:00Z')],now,'2026-09-20');
 assert.equal(view.total,0);assert.equal(view.focusDay,'2026-09-20');assert.equal(view.nextDay,false);
});
test('live and completed need explicit evidence, cancelled fixtures are excluded',()=>{
 const view=buildIndiaTimeline([row('live','2026-09-19T01:00:00Z','live'),row('result','2026-09-20T02:00:00Z','completed'),row('cancel','2026-09-20T05:00:00Z','cancelled')],now);
 assert.equal(view.live.length,1);assert.equal(view.results.length,1);assert.equal(view.total,2);
});
test('countdowns distinguish minutes, hours and days without claiming a start',()=>{
 assert.equal(timeUntilStart('2026-09-20T03:05:00Z',now),'In 5m');
 assert.equal(timeUntilStart('2026-09-20T05:15:00Z',now),'In 2h 15m');
 assert.equal(timeUntilStart('2026-09-22T05:00:00Z',now),'In 2d 2h');
 assert.equal(timeUntilStart('2026-09-20T02:00:00Z',now),'Awaiting update');
});
