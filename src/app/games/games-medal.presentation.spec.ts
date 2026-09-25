import { deduplicateMedalRecords, medalView } from './games-medal.presentation';
import type { GamesHubMedalRecord, GamesHubMedalSummary } from '../services/payload.service';

const medal = (
  key: string,
  event: string,
  olympicCategory: GamesHubMedalRecord['olympicCategory'],
  medalType: GamesHubMedalRecord['medal'] = 'bronze',
): GamesHubMedalRecord => ({
  key,
  medal: medalType,
  sport: key.startsWith('shoot') ? 'Shooting' : 'Sport',
  sportSlug: key.startsWith('shoot') ? 'shooting' : 'sport',
  olympicStatus: 'active',
  olympicCategory,
  event,
  recipient: 'India',
  officialKey: key,
  sourceId: key,
  dateKey: '2026-09-25',
  source: 'official-medal',
});

const summaryFor = (records: GamesHubMedalRecord[]): GamesHubMedalSummary => ({
  verifiedAt: null,
  total: records.length,
  gold: records.filter(record => record.medal === 'gold').length,
  silver: records.filter(record => record.medal === 'silver').length,
  bronze: records.filter(record => record.medal === 'bronze').length,
  records,
  bySport: [],
});

describe('games medal presentation', () => {
  it('separates LA28 programme medals from Asian Games-only medals', () => {
    const summary = summaryFor([
      medal('cricket', 'Women T20', 'new_in_la28', 'gold'),
      medal('shoot-rifle', '10m Air Rifle Men Individual', 'la28', 'silver'),
      medal('soft-tennis', "Men's Singles", 'non_olympic'),
    ]);

    expect(medalView(summary, 'all')).toEqual(
      jasmine.objectContaining({ total: 3, gold: 1, silver: 1, bronze: 1 }),
    );
    expect(medalView(summary, 'la28')).toEqual(
      jasmine.objectContaining({ total: 2, gold: 1, silver: 1, bronze: 0 }),
    );
    expect(medalView(summary, 'asian-games')).toEqual(
      jasmine.objectContaining({ total: 1, gold: 0, silver: 0, bronze: 1 }),
    );
  });

  it('trusts the API programme-event mapping for similarly named shooting events', () => {
    const summary = summaryFor([
      medal('shoot-trap-mixed', 'Trap Mixed Team', 'la28', 'gold'),
      medal('shoot-skeet-mixed', 'Skeet Mixed Team', 'non_olympic'),
      medal('shoot-rifle-team', '10m Air Rifle Men Team', 'non_olympic', 'silver'),
    ]);

    expect(medalView(summary, 'la28').records.map(record => record.event)).toEqual(['Trap Mixed Team']);
    expect(medalView(summary, 'asian-games').records.map(record => record.event)).toEqual([
      'Skeet Mixed Team',
      '10m Air Rifle Men Team',
    ]);
  });

  it('does not promote an Asian Games event because its parent sport is on the LA28 programme', () => {
    const summary = summaryFor([
      {
        ...medal('weightlifting-49', 'Women 49kg', 'non_olympic', 'silver'),
        sport: 'Weightlifting',
        sportSlug: 'weightlifting',
      },
      {
        ...medal('badminton-team', 'Men Team', 'non_olympic'),
        sport: 'Badminton',
        sportSlug: 'badminton',
      },
    ]);

    expect(medalView(summary, 'la28').total).toBe(0);
    expect(medalView(summary, 'asian-games').total).toBe(2);
  });

  it('deduplicates the same official medal and keeps the strongest source', () => {
    const official = medal('rowing-medal', "Men's Double Sculls", 'la28');
    const duplicate: GamesHubMedalRecord = {
      ...official,
      key: 'rowing-summary',
      sourceId: 'rowing-summary',
      source: 'result-summary',
    };

    const records = deduplicateMedalRecords([duplicate, official]);

    expect(records.length).toBe(1);
    expect(records[0].source).toBe('official-medal');
  });

  it('excludes classification races from medal totals', () => {
    const finalA = medal('rowing-final-a', "Men's Double Sculls Final A", 'la28');
    const finalB = medal('rowing-final-b', "Men's Single Sculls Final B", 'la28');

    expect(deduplicateMedalRecords([finalA, finalB]).map(record => record.key)).toEqual(['rowing-final-a']);
  });

  it('reconciles programme filters and medal colours to the all-medals view', () => {
    const summary = summaryFor([
      medal('cricket', 'Women T20', 'new_in_la28', 'gold'),
      medal('shoot-individual', '10m Air Rifle Men Individual', 'la28', 'gold'),
      medal('shoot-team', '10m Air Rifle Men Team', 'non_olympic', 'silver'),
      medal('athletics', "Women's 10,000m", 'la28'),
      medal('kabaddi', "Men's Team", 'non_olympic', 'silver'),
    ]);

    const all = medalView(summary, 'all');
    const la28 = medalView(summary, 'la28');
    const gamesOnly = medalView(summary, 'asian-games');

    expect(la28.total + gamesOnly.total).toBe(all.total);
    expect(la28.gold + gamesOnly.gold).toBe(all.gold);
    expect(la28.silver + gamesOnly.silver).toBe(all.silver);
    expect(la28.bronze + gamesOnly.bronze).toBe(all.bronze);
  });
});
