import test from 'node:test';
import assert from 'node:assert/strict';
import { hasIndiaAppearance, scheduleTiming } from '../src/app/games/games-hub.presentation.ts';

const base = { id: 'session-a', startTime: '2026-09-18T05:00:00.000Z', sport: { slug: 'cricket' }, participationStatus: 'confirmed', timingPrecision: 'session-window' };
test('legacy confirmed master session is not an India appearance', () => {
  assert.equal(hasIndiaAppearance(base), false);
  assert.equal(hasIndiaAppearance({ ...base, gamesParticipations: [{ id: 'india-team' }] }), true);
  assert.equal(hasIndiaAppearance({ ...base, gamesParticipations: [{ id: 'india-team' }], isConditional: true }), false);
  assert.equal(hasIndiaAppearance({ ...base, gamesParticipations: [{ id: 'india-team' }], status: 'cancelled' }), false);
});
test('IST timing preserves precision and never invents a session end', () => {
  assert.equal(scheduleTiming(base), 'From 10:30 IST');
  assert.equal(scheduleTiming({ ...base, timingPrecision: 'exact' }), '10:30 IST');
  assert.equal(scheduleTiming({ ...base, timingPrecision: 'tbd' }), 'Time TBC');
  assert.equal(scheduleTiming({ ...base, endTime: '2026-09-18T08:00:00.000Z' }), '10:30–13:30 IST');
});
