import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

const compiled = buildSync({
  entryPoints: ['src/app/games/asian-games-scope.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const {
  IOD_COVERAGE_SPORTS,
  LA28_SPORT_GROUPS,
  matchesGamesScope,
  continuousGamesDates,
} = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));

test('LA28 programme includes 27 sanction groups, independently of IOD Core 12', () => {
  assert.equal(IOD_COVERAGE_SPORTS.size, 12);
  assert.equal(LA28_SPORT_GROUPS.size, 27);
  for (const sport of LA28_SPORT_GROUPS) assert.ok(matchesGamesScope(sport, true));
  for (const sport of ['soft-tennis', 'esports', 'karate', 'kabaddi', 'kurash', 'mixed-martial-arts', 'sepaktakraw', 'teqball', 'wushu']) {
    assert.ok(matchesGamesScope(sport, false));
    assert.equal(matchesGamesScope(sport, true), false);
  }
});

test('editorial coverage is optional and intersects programme and sport selection', () => {
  for (const sport of IOD_COVERAGE_SPORTS) assert.ok(matchesGamesScope(sport, true, 'all', true));
  for (const sport of ['swimming', 'rowing', 'track-cycling']) {
    assert.ok(matchesGamesScope(sport, true));
    assert.equal(matchesGamesScope(sport, false, 'all', true), false);
  }
  assert.equal(matchesGamesScope('tennis', true, 'cricket', true), false);
});

test('sport selection intersects the same scope without folding disciplines into a parent', () => {
  assert.ok(matchesGamesScope('tennis', true, 'tennis'));
  assert.equal(matchesGamesScope('soft-tennis', true, 'tennis'), false);
  assert.ok(matchesGamesScope('soft-tennis', false, 'soft-tennis'));
  assert.equal(matchesGamesScope('hockey', true, 'tennis'), false);
  assert.equal(matchesGamesScope(undefined, false), false);
});

test('matrix spans rest/ceremony days and the month boundary without duplicating dates', () => {
  assert.deepEqual(continuousGamesDates(['2026-09-18', '2026-09-20', '2026-09-18']), ['2026-09-18', '2026-09-19', '2026-09-20']);
  assert.deepEqual(continuousGamesDates(['2026-10-01', '2026-09-30']), ['2026-09-30', '2026-10-01']);
  assert.deepEqual(continuousGamesDates([]), []);
});
