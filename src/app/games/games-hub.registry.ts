import { ASIAN_GAMES_2026 } from './asian-games-2026.config';

export interface GamesHubRegistration {
  hubKey: string;
  route: string[];
  title: string;
  homeContext: string;
  start: string;
  end: string;
  competitionStart: string;
  dateLabel: string;
  location: string;
}

const HUBS: Readonly<Record<string, GamesHubRegistration>> = {
  'asian-games-2026': {
    hubKey: 'asian-games-2026',
    route: ['/games', 'asian-games-2026'],
    title: 'Aichi-Nagoya 2026',
    homeContext: "India at the 20th Asian Games",
    start: ASIAN_GAMES_2026.start,
    end: ASIAN_GAMES_2026.end,
    competitionStart: ASIAN_GAMES_2026.competitionStart,
    dateLabel: ASIAN_GAMES_2026.dateLabel,
    location: ASIAN_GAMES_2026.location,
  },
};

export const getGamesHubRegistration = (
  hubKey: string | null | undefined,
): GamesHubRegistration | null => {
  if (!hubKey) return null;
  return HUBS[hubKey] || null;
};
