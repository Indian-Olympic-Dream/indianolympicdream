import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
const compiled = buildSync({entryPoints:['src/app/games/asian-games-session.presentation.ts'],bundle:true,platform:'node',format:'esm',write:false});
const { asianSessionBadge, asianSessionMedal, asianMedalEventCount, resolveTimelineDate, isCeremonyDetail, sessionDetailSubtitle, isHeadToHeadDetail, isStartListDetail } = await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const entryCompiled = buildSync({entryPoints:['src/app/games/asian-games-entry.presentation.ts'],bundle:true,platform:'node',format:'esm',write:false});
const { asianGamesEventsEquivalent, indianEntriesForSessionDetail } = await import('data:text/javascript;base64,'+Buffer.from(entryCompiled.outputFiles[0].text).toString('base64'));
const fixture = {id:'india',startTime:'2026-09-18T05:00:00Z',participationStatus:'confirmed',gamesParticipations:[{id:'team-india'}],timingPrecision:'exact'};

test('confirmed India participation and medal significance coexist', () => {
  const row = {...fixture,isMedalSession:true};
  assert.deepEqual(asianSessionBadge(row), {label:'Confirmed',type:'confirmed'});
  assert.equal(asianSessionMedal(row), true);
  assert.equal(asianSessionBadge({...row,isConditional:true}).label,'If qualified');
});
test('neutral programme rows do not infer a pending start list, while actual statuses remain visible', () => {
  assert.equal(asianSessionBadge({...fixture,gamesParticipations:[]}),null);
  assert.equal(asianSessionBadge({...fixture,gamesParticipations:[],participationStatus:'provisional'}),null);
  for(const [status,label] of [['cancelled','Cancelled'],['postponed','Postponed'],['completed','Completed'],['eliminated','Eliminated'],['live','Live']]) {
    assert.equal(asianSessionBadge({...fixture,status}).label,label);
  }
  assert.equal(asianSessionBadge({...fixture,status:'completed',result:{summary:'Won'}}).label,'Result');
});
test('pre-Games default is the next day, during Games default stays on today including a rest day', () => {
  const dates=['2026-09-18','2026-09-20','2026-10-03'];
  assert.equal(resolveTimelineDate(dates,'','2026-09-16','2026-10-04'),'2026-09-18');
  assert.equal(resolveTimelineDate(dates,'','2026-09-19','2026-10-04'),'2026-09-19');
  assert.equal(resolveTimelineDate(dates,'','2026-10-04','2026-10-04'),'2026-10-04');
  assert.equal(resolveTimelineDate(dates,'','2026-10-05','2026-10-04'),'2026-10-03');
});
test('explicit dates and all-days selection survive filter changes and empty data', () => {
  assert.equal(resolveTimelineDate([],'2026-09-22','2026-09-20','2026-10-04'),'2026-09-22');
  assert.equal(resolveTimelineDate([],'all','2026-09-20','2026-10-04'),'all');
  assert.equal(resolveTimelineDate([],'','2026-09-20','2026-10-04'),'2026-09-20');
});
test('drawer separates ceremonies and removes repeated official titles without dropping heat information', () => {
  const final={event:'10m Air Rifle Women Individual',phase:'Final',unit:"10m Air Rifle Women's Final"};
  assert.equal(isCeremonyDetail(final),false);
  assert.equal(sessionDetailSubtitle(final),'Final');
  assert.equal(sessionDetailSubtitle({event:'10m Air Rifle Women Individual',phase:'Qualification',unit:'Qualification'}),'Qualification');
  assert.equal(isCeremonyDetail({...final,phase:'Victory Ceremony'}),true);
  assert.equal(sessionDetailSubtitle({event:'10m Air Rifle Women Team',phase:'Victory Ceremony',unit:'10m Air Rifle Team Women Victory Ceremony'}),'Victory Ceremony');
  assert.equal(sessionDetailSubtitle({event:'100m Men',phase:'Round 1',unit:'Heat 2'}),'Round 1 · Heat 2');
});
test('matrix medal totals count events inside sessions and collapse bronze/gold phases', () => {
  const shooting = {...fixture,sport:{id:'shooting'},sessionDetails:[
    {event:'Skeet Mixed Team',phase:'Final',medal:true},
    {event:'10m Air Pistol Men Individual',phase:'Final',medal:true},
    {event:'Skeet Mixed Team',phase:'Victory Ceremony',medal:false},
  ]};
  assert.equal(asianMedalEventCount([shooting]),2);

  const hockeyBronze = {...fixture,id:'hockey-bronze',sport:{id:'hockey'},sessionDetails:[{event:'Women',unit:'Bronze Medal Match',medal:true}]};
  const hockeyGold = {...fixture,id:'hockey-gold',sport:{id:'hockey'},sessionDetails:[{event:'Women',unit:'Gold Medal Match',medal:true}]};
  assert.equal(asianMedalEventCount([hockeyBronze,hockeyGold]),1);
  assert.equal(asianMedalEventCount([hockeyGold,{...hockeyGold,id:'volleyball-gold',sport:{id:'volleyball'}}]),2);
});

test('programme details resolve active Indian entries without including withdrawn or replaced athletes', () => {
  const sport = {id:'shooting',slug:'shooting',name:'Shooting'};
  const row = {...fixture,sport};
  const detail = {event:'10m Air Rifle Women Individual'};
  const entries = [
    {id:'1',gamesKey:'asian-games-2026',sport,athlete:{id:'a',fullName:'Elavenil Valarivan'},eventBucket:"Women's 10m Air Rifle",selectionStatus:'approved'},
    {id:'2',gamesKey:'asian-games-2026',sport,athlete:{id:'b',fullName:'Former Entry'},eventBucket:"Women's 10m Air Rifle",selectionStatus:'replaced'},
    {id:'3',gamesKey:'asian-games-2026',sport:{id:'archery',slug:'archery',name:'Archery'},athlete:{id:'c',fullName:'Another Sport'},eventBucket:"Women's 10m Air Rifle",selectionStatus:'approved'},
  ];
  assert.deepEqual(indianEntriesForSessionDetail(detail,row,entries),['Elavenil Valarivan']);
});

test('event matching preserves weight classes and handles official gender wording', () => {
  assert.equal(asianGamesEventsEquivalent("Women's +87kg",'Women +87 kg'),true);
  assert.equal(asianGamesEventsEquivalent("Men's +90kg","Men's 90kg"),false);
  assert.equal(asianGamesEventsEquivalent("Men's +90kg","Men's -90kg"),false);
  assert.equal(asianGamesEventsEquivalent("Boys' Skiff","Men's Skiff"),true);
  assert.equal(asianGamesEventsEquivalent('Women','Women Hockey'),true);
  assert.equal(asianGamesEventsEquivalent("Men's 100m","Men's 200m"),false);
});

test('victory ceremonies never inherit athletes from their medal event', () => {
  const sport = {id:'weightlifting',slug:'weightlifting',name:'Weightlifting'};
  const entries = [{id:'1',gamesKey:'asian-games-2026',sport,athlete:{id:'a',fullName:'India Lifter'},eventBucket:"Women's +87kg",selectionStatus:'approved'}];
  const ceremony = {event:"Women's +87kg",phase:'Victory Ceremony',unit:"Women's +87kg Victory Ceremony"};
  assert.deepEqual(indianEntriesForSessionDetail(ceremony,{...fixture,sport},entries),[]);
});

test('distinguishes head-to-head fixtures from multi-entry start lists', () => {
  const shootingQual = {
    event: '10m Air Rifle Women Individual',
    phase: 'Qualification',
    unit: 'Qualification',
    organisations: ['MGL', 'KOR', 'JPN', 'QAT', 'TPE', 'MAS', 'MDV', 'IND', 'THA', 'VIE', 'INA', 'KGZ']
  };
  assert.equal(isHeadToHeadDetail(shootingQual, 'shooting'), false);
  assert.equal(isStartListDetail(shootingQual, 'shooting'), true);

  const cricketMatch = {
    event: 'Women',
    phase: 'Quarterfinals',
    unit: 'Quarterfinal 4',
    sides: [{ code: 'IND', label: 'India' }, { code: 'JPN', label: 'Japan' }]
  };
  assert.equal(isHeadToHeadDetail(cricketMatch, 'cricket'), true);
  assert.equal(isStartListDetail(cricketMatch, 'cricket'), false);

  const athleticsHeat = {
    event: '100m Men',
    phase: 'Round 1',
    unit: 'Heat 2',
    organisations: ['IND', 'JPN', 'CHN', 'KOR', 'QAT', 'THA', 'MAS', 'KAZ']
  };
  assert.equal(isHeadToHeadDetail(athleticsHeat, 'athletics'), false);
  assert.equal(isStartListDetail(athleticsHeat, 'athletics'), true);

  const boxingBout = {
    event: "Women's 54kg",
    phase: 'Round of 16',
    unit: 'Bout 12',
    organisations: ['IND', 'UZB']
  };
  assert.equal(isHeadToHeadDetail(boxingBout, 'boxing'), true);
  assert.equal(isStartListDetail(boxingBout, 'boxing'), false);
});
