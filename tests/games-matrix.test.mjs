import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMatrixSportStarts, indiaDateKey } from '../src/app/games/games-hub.presentation.ts';

const sport = (name, firstDay, slug = name.toLowerCase()) => ({ name, firstDay, slug });

test('matrix rows follow first competition day, not alphabetical order', () => {
  const rows = [sport('Archery', '2026-09-26'), sport('Hockey', '2026-09-18'), sport('Cricket', '2026-09-17')];
  assert.deepEqual(rows.sort(compareMatrixSportStarts).map(row => row.name), ['Cricket', 'Hockey', 'Archery']);
});

test('same-day starts have deterministic name/slug tie breaks', () => {
  const rows = [sport('Shooting', '2026-09-20'), sport('Badminton', '2026-09-20'), sport('Table Tennis', '2026-09-20')];
  assert.deepEqual(rows.sort(compareMatrixSportStarts).map(row => row.name), ['Badminton', 'Shooting', 'Table Tennis']);
  assert.ok(compareMatrixSportStarts(sport('Cycling', '2026-09-20', 'road'), sport('Cycling', '2026-09-20', 'track')) < 0);
});

test('unknown dates remain last and the September/October boundary is chronological', () => {
  const rows = [sport('Unknown', null), sport('October', '2026-10-01'), sport('September', '2026-09-30')];
  assert.deepEqual(rows.sort(compareMatrixSportStarts).map(row => row.name), ['September', 'October', 'Unknown']);
});

test('row ordering uses the same IST date as the visible columns', () => {
  assert.equal(indiaDateKey('2026-09-25T23:00:00.000Z'), '2026-09-26');
});
