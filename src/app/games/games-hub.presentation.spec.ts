import type { GamesScheduleRow } from '../services/payload.service';
import {
  hasOfficialResult,
  hasOfficialResultForDetail,
  hasPublishedResult,
  hasPublishedResultForDetail,
  isOpenScheduleDetail,
  isOpenScheduleRow,
} from './games-hub.presentation';

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

  it('splits a mixed programme session between Results and Schedule at fixture level', () => {
    const completed = {
      event: "Men's Singles",
      phase: '2nd Round',
      unit: 'Match 3',
      sourceUrl: 'https://results.example/results/M.SINGLES.R32.000300',
    };
    const upcoming = {
      event: "Women's Doubles",
      phase: '2nd Round',
      unit: 'Match 3',
      sourceUrl: 'https://results.example/results/W.DOUBLES.R16.000300',
    };
    const mixed = row({
      sessionDetails: [completed, upcoming],
      result: {
        official: true,
        summary: 'SEN Lakshya lost to LOH Kean Yew 1–2',
        matches: [{
          officialKey: 'M.SINGLES.R32.000300',
          event: "Men's Singles",
          phase: '2nd Round',
          unit: 'Match 3',
          summary: 'SEN Lakshya lost to LOH Kean Yew 1–2',
        }],
      },
    });

    expect(hasOfficialResult(mixed)).toBe(true);
    expect(hasOfficialResultForDetail(completed, mixed)).toBe(true);
    expect(hasOfficialResultForDetail(upcoming, mixed)).toBe(false);
    expect(isOpenScheduleDetail(upcoming, mixed)).toBe(true);
    expect(isOpenScheduleRow(mixed)).toBe(true);
  });

  it('does not reopen completed rows for unmatched ceremonies or withdrawn units', () => {
    const result = {
      official: true,
      summary: 'India won Silver',
      matches: [{
        officialKey: 'M.RIFLE.FINAL',
        event: '10m Air Rifle Men Individual',
        phase: 'Final',
        unit: 'Final',
        summary: 'India won Silver',
      }],
    };

    expect(isOpenScheduleRow(row({
      result,
      sessionDetails: [{
        event: '10m Air Rifle Men Individual',
        phase: 'Victory Ceremony',
        unit: '10m Air Rifle Men Victory Ceremony',
        status: 'Planned',
      }],
    }))).toBe(false);

    expect(isOpenScheduleRow(row({
      result,
      sessionDetails: [{
        event: "Men's Traditional -77kg",
        phase: 'Quarterfinals',
        unit: 'Bout 27',
        status: 'Withdrawn',
      }],
    }))).toBe(false);
  });

  it('puts a completed provisional result in Results without calling it official', () => {
    const detail = {
      event: 'Mixed Dinghy',
      phase: 'Opening Series',
      unit: 'Race 1',
      status: 'Unofficial',
      sourceUrl: 'https://results.example/results/X.470.PREL.000100',
    };
    const provisional = row({
      status: 'completed',
      sessionDetails: [detail],
      result: {
        official: false,
        provisional: true,
        summary: 'India — 8th · 10 · DSQ',
        matches: [{
          officialKey: 'X.470.PREL.000100',
          event: 'Mixed Dinghy',
          phase: 'Opening Series',
          unit: 'Race 1',
          summary: 'India — 8th · 10 · DSQ',
        }],
      },
    });

    expect(hasOfficialResult(provisional)).toBe(false);
    expect(hasOfficialResultForDetail(detail, provisional)).toBe(false);
    expect(hasPublishedResult(provisional)).toBe(true);
    expect(hasPublishedResultForDetail(detail, provisional)).toBe(true);
    expect(isOpenScheduleDetail(detail, provisional)).toBe(false);
    expect(isOpenScheduleRow(provisional)).toBe(false);
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
