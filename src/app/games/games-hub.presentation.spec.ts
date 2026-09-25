import type { GamesScheduleRow } from '../services/payload.service';
import { hasOfficialResult, isOpenScheduleRow } from './games-hub.presentation';

const row = (overrides: Partial<GamesScheduleRow>): GamesScheduleRow => ({
  id: 'row',
  startTime: '2026-09-25T01:00:00.000Z',
  status: 'scheduled',
  ...overrides,
} as GamesScheduleRow);

describe('matrix schedule/results eligibility', () => {
  it('puts an official published result in Results and removes it from Schedule', () => {
    const completed = row({ status: 'completed', result: { official: true, summary: 'India won 2–0' } });

    expect(hasOfficialResult(completed)).toBe(true);
    expect(isOpenScheduleRow(completed)).toBe(false);
  });

  it('keeps a scheduled row in Schedule even when earlier rows that day have results', () => {
    const scheduled = row({ status: 'scheduled', isConditional: true });

    expect(hasOfficialResult(scheduled)).toBe(false);
    expect(isOpenScheduleRow(scheduled)).toBe(true);
  });

  it('keeps an unofficial result operationally open', () => {
    const provisional = row({ status: 'completed', result: { official: false, summary: 'Provisional' } });

    expect(hasOfficialResult(provisional)).toBe(false);
    expect(isOpenScheduleRow(provisional)).toBe(true);
  });

  it('does not present cancelled, eliminated, or postponed rows as upcoming', () => {
    expect(isOpenScheduleRow(row({ status: 'cancelled' }))).toBe(false);
    expect(isOpenScheduleRow(row({ status: 'eliminated' }))).toBe(false);
    expect(isOpenScheduleRow(row({ status: 'postponed' }))).toBe(false);
  });

  it('requires both an official flag and a non-empty summary for Results', () => {
    expect(hasOfficialResult(row({ status: 'completed', result: { official: true, summary: '' } }))).toBe(false);
    expect(hasOfficialResult(row({ status: 'completed', result: { summary: 'Final' } }))).toBe(false);
  });
});
