import { Injectable, inject, signal } from '@angular/core';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  CalendarEvent,
  GamesParticipationRow,
  GamesScheduleRow,
  PayloadService,
} from '../../services/payload.service';
import { SportsMoment, SportsMomentAnchor } from '../../home/sports-moment.model';
import {
  AthleticsCompetitor,
  BadmintonEntryItem,
  HockeyGroupMatch,
  ProgrammeEventItem,
  SportsDetailModel,
  SportsDetailState,
} from './sports-detail.model';

const COUNTRY_CODES: Record<string, string> = {
  india: 'IND', ind: 'IND',
  wales: 'WAL', wal: 'WAL',
  england: 'ENG', eng: 'ENG',
  pakistan: 'PAK', pak: 'PAK',
  china: 'CHN', chn: 'CHN',
  netherlands: 'NED', ned: 'NED',
  belgium: 'BEL', bel: 'BEL',
  germany: 'GER', ger: 'GER',
  australia: 'AUS', aus: 'AUS',
  japan: 'JPN', jpn: 'JPN',
  korea: 'KOR', kor: 'KOR', 'south korea': 'KOR',
  malaysia: 'MAS', mas: 'MAS',
  indonesia: 'INA', ina: 'INA',
  spain: 'ESP', esp: 'ESP',
  france: 'FRA', fra: 'FRA',
  canada: 'CAN', can: 'CAN',
  scotland: 'SCO', sco: 'SCO',
  newzealand: 'NZL', nzl: 'NZL', 'new zealand': 'NZL',
  southafrica: 'RSA', rsa: 'RSA', 'south africa': 'RSA',
  nigeria: 'NGR', ngr: 'NGR',
  kenya: 'KEN', ken: 'KEN',
  usa: 'USA', 'united states': 'USA',
  grenada: 'GRN', grn: 'GRN',
  trinidad: 'TTO', tto: 'TTO',
  srilanka: 'SRI', sri: 'SRI', 'sri lanka': 'SRI',
  myanmar: 'MMR', mmr: 'MMR', mya: 'MMR', burma: 'MMR',
  ireland: 'IRL', irl: 'IRL',
  vietnam: 'VIE', vie: 'VIE',
  guatemala: 'GUA', gua: 'GUA',
  brazil: 'BRA', bra: 'BRA',
  ukraine: 'UKR', ukr: 'UKR',
  azerbaijan: 'AZE', aze: 'AZE',
  estonia: 'EST', est: 'EST',
  bulgaria: 'BUL', bul: 'BUL',
  turkey: 'TUR', tur: 'TUR',
  czechia: 'CZE', cze: 'CZE', 'czech republic': 'CZE',
  finland: 'FIN', fin: 'FIN',
  switzerland: 'SUI', sui: 'SUI',
  israel: 'ISR', isr: 'ISR',
  mexico: 'MEX', mex: 'MEX',
  egypt: 'EGY', egy: 'EGY',
  mauritius: 'MRI', mri: 'MRI',
  maldives: 'MDV', mdv: 'MDV',
  poland: 'POL', pol: 'POL',
  hungary: 'HUN', hun: 'HUN',
  sweden: 'SWE', swe: 'SWE',
  norway: 'NOR', nor: 'NOR',
  italy: 'ITA', ita: 'ITA',
  portugal: 'POR', por: 'POR',
  slovenia: 'SLO', slo: 'SLO',
  slovakia: 'SVK', svk: 'SVK',
  romania: 'ROU', rou: 'ROU',
  nepal: 'NEP', nep: 'NEP',
  bangladesh: 'BAN', ban: 'BAN',
  peru: 'PER', per: 'PER',
  'el salvador': 'ESA', esa: 'ESA',
  suriname: 'SUR', sur: 'SUR',
  algeria: 'ALG', alg: 'ALG',
  kazakhstan: 'KAZ', kaz: 'KAZ',
  chile: 'CHI', chi: 'CHI',
  argentina: 'ARG', arg: 'ARG',
  austria: 'AUT', aut: 'AUT',
  denmark: 'DEN', den: 'DEN',
  'chinese taipei': 'TPE', tpe: 'TPE', taiwan: 'TPE',
  thailand: 'THA', tha: 'THA',
  'hong kong': 'HKG', hkg: 'HKG',
  singapore: 'SGP', sgp: 'SGP', sin: 'SGP',
};

const HOCKEY_FLAGS: Record<string, string> = {
  india: '🇮🇳', ind: '🇮🇳',
  wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', wal: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  england: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', eng: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  china: '🇨🇳', chn: '🇨🇳',
  spain: '🇪🇸', esp: '🇪🇸',
  germany: '🇩🇪', ger: '🇩🇪',
  chile: '🇨🇱', chi: '🇨🇱',
  southafrica: '🇿🇦', 'south africa': '🇿🇦', rsa: '🇿🇦',
  belgium: '🇧🇪', bel: '🇧🇪',
  netherlands: '🇳🇱', ned: '🇳🇱',
  australia: '🇦🇺', aus: '🇦🇺',
  argentina: '🇦🇷', arg: '🇦🇷',
  newzealand: '🇳🇿', 'new zealand': '🇳🇿', nzl: '🇳🇿',
  france: '🇫🇷', fra: '🇫🇷',
  pakistan: '🇵🇰', pak: '🇵🇰',
  japan: '🇯🇵', jpn: '🇯🇵',
  korea: '🇰🇷', kor: '🇰🇷',
  malaysia: '🇲🇾', mas: '🇲🇾',
  ireland: '🇮🇪', irl: '🇮🇪',
  myanmar: '🇲🇲', mmr: '🇲🇲', mya: '🇲🇲',
};

function cleanTeamName(name: string): string {
  return name
    .replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{E0000}-\u{E007F}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .trim();
}

function resolveCountryCode(name: string): string {
  const clean = cleanTeamName(name).toLowerCase();
  return COUNTRY_CODES[clean] || clean.slice(0, 3).toUpperCase();
}

@Injectable({
  providedIn: 'root',
})
export class SportsDetailService {
  private payload = inject(PayloadService);

  isOpen = signal<boolean>(false);
  detail = signal<SportsDetailModel | null>(null);

  open(detail: SportsDetailModel): void {
    this.detail.set(detail);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.detail.set(null);
  }

  /**
   * Builds and opens a SportsDetailModel directly from a SportsMoment on Home.
   */
  openMoment(moment: SportsMoment, allScheduleRows: GamesScheduleRow[] = []): void {
    const isMatchup = /vs\.?|v|-/i.test(moment.headline);
    let matchup = null;

    if (isMatchup) {
      const match = moment.headline.match(/^(.*?)\s+(?:vs\.?|v|-)\s+(.*?)$/i);
      if (match && match[1] && match[2]) {
        const teamAName = cleanTeamName(match[1]);
        const teamBName = cleanTeamName(match[2]);
        const isTeamAIndia = teamAName.toLowerCase().includes('india') || teamAName.toLowerCase() === 'ind';
        const isTeamBIndia = teamBName.toLowerCase().includes('india') || teamBName.toLowerCase() === 'ind';
        const flagA = HOCKEY_FLAGS[teamAName.toLowerCase()] || '';
        const flagB = HOCKEY_FLAGS[teamBName.toLowerCase()] || '';
        matchup = {
          teamA: { name: teamAName, code: resolveCountryCode(teamAName), isIndia: isTeamAIndia, flag: flagA },
          teamB: { name: teamBName, code: resolveCountryCode(teamBName), isIndia: isTeamBIndia, flag: flagB },
        };
      }
    }

    const state: SportsDetailState =
      moment.timingState === 'tbc' ? 'tbc' : (moment.state as SportsDetailState);

    const stateLabel =
      state === 'live' ? 'LIVE NOW' :
        state === 'completed' ? 'RESULT' :
          state === 'tbc' ? 'TIME TBC' : 'UPCOMING';

    const dateFormatted = this.formatDateKey(moment.dateKey);

    const isBadminton = moment.sport.slug === 'badminton' || (moment.competition || '').toLowerCase().includes('bwf');
    const isHockey = moment.sport.slug === 'hockey' || (moment.competition || '').toLowerCase().includes('hockey') || moment.headline.toLowerCase().includes('vs');
    const isLausanne = (moment.headline || '').toLowerCase().includes('neeraj') || (moment.context || '').toLowerCase().includes('lausanne') || (moment.competition || '').toLowerCase().includes('lausanne');
    const isContinental = (moment.competition || '').toLowerCase().includes('continental') || (moment.headline || '').toLowerCase().includes("india's athletes") || (moment.context || '').toLowerCase().includes('programme');

    let tournamentLogoUrl: string | null = null;
    if (isBadminton) tournamentLogoUrl = 'assets/images/tournaments/bwf-2026.png';
    else if (isHockey) tournamentLogoUrl = 'assets/images/tournaments/fih-hockey-2026.png';
    else if (isLausanne) tournamentLogoUrl = 'assets/images/tournaments/diamond-league.png';
    else if (isContinental) tournamentLogoUrl = 'assets/images/tournaments/continental-tour-2026.png';

    const baseModel: SportsDetailModel = {
      sportName: moment.sport.name,
      sportSlug: moment.sport.slug,
      sportPictogramUrl: moment.sport.pictogramUrl,
      tournamentLogoUrl,
      competitionTitle: moment.competition || moment.sport.name,
      state,
      stateLabel,
      headline: moment.headline,
      contextLine: moment.context,
      dateLabel: dateFormatted,
      timeLabel: moment.timingLabel,
      presentationSize: 'compact',
      matchup,
      resultSummary: moment.resultLabel,
      actions: moment.action?.navigation.href ? {
        externalUrl: moment.action.navigation.href,
        whereToWatchUrl: null,
      } : null,
    };

    // 1. Hockey Match: enrich with distinct Men's / Women's Pool D campaign
    if (isHockey) {
      const isWomen = (moment.context || '').toLowerCase().includes('women') ||
        (moment.headline || '').toLowerCase().includes('women') ||
        (moment.competition || '').toLowerCase().includes('women');

      baseModel.competitionTitle = isWomen
        ? 'FIH Hockey Women’s World Cup 2026'
        : 'FIH Hockey Men’s World Cup 2026';
      baseModel.venue = 'Wavre (BEL) & Amstelveen (NED)';
      baseModel.actions = {
        whereToWatchUrl: 'https://www.hotstar.com/in/sports/hockey',
        whereToWatchLabel: 'Watch Live',
        externalUrl: 'https://www.worldcup.hockey/',
      };

      if (isWomen) {
        baseModel.hockeyGroupMatches = [
          {
            matchLabel: 'Match 1',
            dateLabel: '16 Aug',
            timeLabel: '16:30 IST',
            opponent: 'China',
            opponentCode: 'CHN',
            opponentFlag: '🇨🇳',
            indiaFlag: '🇮🇳',
            isCurrentMatch: moment.dateKey === '2026-08-16' || moment.headline.toLowerCase().includes('china'),
            isCompleted: false,
          },
          {
            matchLabel: 'Match 2',
            dateLabel: '18 Aug',
            timeLabel: '18:30 IST',
            opponent: 'Spain',
            opponentCode: 'ESP',
            opponentFlag: '🇪🇸',
            indiaFlag: '🇮🇳',
            isCurrentMatch: moment.dateKey === '2026-08-18' || moment.headline.toLowerCase().includes('spain'),
            isCompleted: false,
          },
          {
            matchLabel: 'Match 3',
            dateLabel: '20 Aug',
            timeLabel: '20:45 IST',
            opponent: 'Chile',
            opponentCode: 'CHI',
            opponentFlag: '🇨🇱',
            indiaFlag: '🇮🇳',
            isCurrentMatch: moment.dateKey === '2026-08-20' || moment.headline.toLowerCase().includes('chile'),
            isCompleted: false,
          },
        ];
      } else {
        baseModel.hockeyGroupMatches = [
          {
            matchLabel: 'Match 1',
            dateLabel: '15 Aug',
            timeLabel: '16:30 IST',
            opponent: 'Wales',
            opponentCode: 'WAL',
            opponentFlag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
            indiaFlag: '🇮🇳',
            isCurrentMatch: moment.dateKey === '2026-08-15' || moment.headline.toLowerCase().includes('wales'),
            isCompleted: false,
          },
          {
            matchLabel: 'Match 2',
            dateLabel: '17 Aug',
            timeLabel: '18:30 IST',
            opponent: 'England',
            opponentCode: 'ENG',
            opponentFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
            indiaFlag: '🇮🇳',
            isCurrentMatch: moment.dateKey === '2026-08-17' || moment.headline.toLowerCase().includes('england'),
            isCompleted: false,
          },
          {
            matchLabel: 'Match 3',
            dateLabel: '19 Aug',
            timeLabel: '20:45 IST',
            opponent: 'Germany',
            opponentCode: 'GER',
            opponentFlag: '🇩🇪',
            indiaFlag: '🇮🇳',
            isCurrentMatch: moment.dateKey === '2026-08-19' || moment.headline.toLowerCase().includes('germany'),
            isCompleted: false,
          },
        ];
      }

      this.open(baseModel);
      return;
    }

    // 2. Badminton BWF Worlds: enrich with Indian entries
    if (isBadminton) {
      baseModel.competitionTitle = 'BWF World Championships 2026';
      baseModel.venue = 'KD Jadhav Indoor Hall, New Delhi';
      baseModel.actions = {
        whereToWatchUrl: 'https://www.hotstar.com/in/sports/badminton',
        whereToWatchLabel: 'Watch Live',
        externalUrl: 'https://bwfworldchampionships.bwfbadminton.com/',
      };
      this.payload.getEventHubParticipations('bwf-world-championships-2026').pipe(
        catchError(() => of([])),
        map((rows) => this.mapBadmintonEntries(rows, moment.dateKey))
      ).subscribe((entries) => {
        baseModel.badmintonEntries = entries;
        this.open(baseModel);
      });
      return;
    }

    // 3. Lausanne Diamond League (Neeraj Chopra): enrich with competitor field
    if (isLausanne) {
      baseModel.competitionTitle = 'Wanda Diamond League Lausanne 2026';
      baseModel.venue = 'Stade Olympique de la Pontaise, Lausanne';
      baseModel.actions = {
        whereToWatchUrl: 'https://www.youtube.com/@diamondleague/featured',
        whereToWatchLabel: 'Watch Live',
        externalUrl: 'https://lausanne.diamondleague.com/',
      };
      this.payload.getEventHubParticipations('lausanne-dl-2026').pipe(
        catchError(() => of([])),
        map((rows) => this.mapAthleticsField(rows))
      ).subscribe((field) => {
        baseModel.athleticsField = field.length ? field : this.fallbackLausanneField();
        this.open(baseModel);
      });
      return;
    }

    // 4. Bhubaneswar Continental Tour: enrich with 18-event programme
    if (isContinental) {
      baseModel.competitionTitle = 'Indian Open World Athletics Continental Tour 2026';
      baseModel.venue = 'Kalinga Stadium, Bhubaneswar';
      baseModel.actions = {
        externalUrl: 'https://worldathletics.org/competitions/world-athletics-continental-tour',
      };
      baseModel.athleticsProgramme = this.fallbackBhubaneswarProgramme();
      this.open(baseModel);
      return;
    }

    this.open(baseModel);
  }

  /**
   * Opens SportsDetailModel from a Day Anchor (e.g. BWF Worlds tournament anchor).
   */
  openAnchor(anchor: SportsMomentAnchor): void {
    const isBadminton = anchor.sport.slug === 'badminton' || anchor.title.toLowerCase().includes('bwf');
    const isContinental = anchor.title.toLowerCase().includes('continental') || (anchor.context || '').toLowerCase().includes('continental');

    const model: SportsDetailModel = {
      sportName: anchor.sport.name,
      sportSlug: anchor.sport.slug,
      sportPictogramUrl: anchor.sport.pictogramUrl,
      competitionTitle: isBadminton ? 'BWF World Championships 2026' : anchor.title,
      state: 'tbc',
      stateLabel: 'UPCOMING',
      headline: anchor.title,
      contextLine: anchor.context,
      dateLabel: 'Aug 2026',
      timeLabel: 'Timings TBC',
      venue: isBadminton ? 'KD Jadhav Indoor Hall, New Delhi' : (anchor.location || null),
      presentationSize: 'wide',
      actions: isBadminton ? {
        whereToWatchUrl: 'https://www.hotstar.com/in/sports/badminton',
        whereToWatchLabel: 'Watch Live',
        externalUrl: 'https://bwfworldchampionships.bwfbadminton.com/',
      } : isContinental ? {
        externalUrl: 'https://worldathletics.org/competitions/world-athletics-continental-tour',
      } : null,
    };

    if (isBadminton) {
      this.payload.getEventHubParticipations('bwf-world-championships-2026').pipe(
        catchError(() => of([])),
        map((rows) => this.mapBadmintonEntries(rows))
      ).subscribe((entries) => {
        model.badmintonEntries = entries;
        this.open(model);
      });
      return;
    }

    if (isContinental) {
      model.athleticsProgramme = this.fallbackBhubaneswarProgramme();
      this.open(model);
      return;
    }

    this.open(model);
  }

  /**
   * Opens SportsDetailModel from an Athletics Programme Summary (e.g. Bhubaneswar 18-event meet).
   */
  openProgramme(event: CalendarEvent, programmeRows?: any[]): void {
    const model: SportsDetailModel = {
      sportName: 'Athletics',
      sportSlug: 'athletics',
      competitionTitle: event.title,
      state: 'tbc',
      stateLabel: 'PROGRAMME TBC',
      headline: "India's athletes in action",
      contextLine: 'Bhubaneswar · 22 Aug',
      dateLabel: 'Sat, 22 Aug 2026',
      timeLabel: 'Timings TBC',
      venue: event.location || 'Kalinga Stadium, Bhubaneswar',
      presentationSize: 'wide',
      actions: event.externalUrl ? { externalUrl: event.externalUrl } : null,
      athleticsProgramme: this.mapAthleticsProgramme(programmeRows),
    };

    this.open(model);
  }

  private readonly BADMINTON_COUNTRY_FLAGS: Record<string, string> = {
    IND: '🇮🇳',
    AUT: '🇦🇹',
    CHN: '🇨🇳',
    BEL: '🇧🇪',
    SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    DEN: '🇩🇰',
    JPN: '🇯🇵',
    MAS: '🇲🇾',
    INA: '🇮🇩',
    TPE: '🇹🇼',
    KOR: '🇰🇷',
    THA: '🇹🇭',
    HKG: '🇭🇰',
    ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    FRA: '🇫🇷',
    GER: '🇩🇪',
    SGP: '🇸🇬',
    SIN: '🇸🇬',
    ESP: '🇪🇸',
    CAN: '🇨🇦',
    USA: '🇺🇸',
    WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    MMR: '🇲🇲',
    MYA: '🇲🇲',
    IRL: '🇮🇪',
    VIE: '🇻🇳',
    GUA: '🇬🇹',
    BRA: '🇧🇷',
    NED: '🇳🇱',
    UKR: '🇺🇦',
    AZE: '🇦🇿',
    EST: '🇪🇪',
    BUL: '🇧🇬',
    TUR: '🇹🇷',
    CZE: '🇨🇿',
    FIN: '🇫🇮',
    SUI: '🇨🇭',
    ISR: '🇮🇱',
    MEX: '🇲🇽',
    NGR: '🇳🇬',
    RSA: '🇿🇦',
    EGY: '🇪🇬',
    MRI: '🇲🇺',
    SRI: '🇱🇰',
    MDV: '🇲🇻',
    AUS: '🇦🇺',
    NZL: '🇳🇿',
    POL: '🇵🇱',
    HUN: '🇭🇺',
    SWE: '🇸🇪',
    NOR: '🇳🇴',
    ITA: '🇮🇹',
    POR: '🇵🇹',
    SLO: '🇸🇮',
    SVK: '🇸🇰',
    ROU: '🇷🇴',
    PAK: '🇵🇰',
    NEP: '🇳🇵',
    BAN: '🇧🇩',
    PER: '🇵🇪',
    ESA: '🇸🇻',
    SUR: '🇸🇷',
    ALG: '🇩🇿',
    KAZ: '🇰🇿',
    CHI: '🇨🇱',
    ARG: '🇦🇷',
    GRN: '🇬🇳',
    TTO: '🇹🇹',
    KEN: '🇰🇪',
  };

  private mapBadmintonEntries(rows: GamesParticipationRow[], dateKey?: string): BadmintonEntryItem[] {
    if (!rows.length) return this.fallbackBadmintonEntries(dateKey);
    const groups = new Map<string, GamesParticipationRow[]>();
    rows.forEach((row) => {
      const key = row.eventBucket || row.id;
      groups.set(key, [...(groups.get(key) || []), row]);
    });

    const KNOWN_INDIAN_SEEDS: Record<string, string> = {
      'lakshya sen': '14',
      'pv sindhu': '16',
      'satwiksairaj rankireddy': '3',
      'chirag shetty': '3',
    };

    const KNOWN_OPPONENT_SEEDS: Record<string, string> = {
      'shi yu qi': '1',
    };

    const all: BadmintonEntryItem[] = [...groups.entries()].map(([key, gRows]): BadmintonEntryItem => {
      const discName = gRows[0].eventName || "Men's Singles";
      const discLower = discName.toLowerCase();
      const disciplineCode: 'MS' | 'WS' | 'MD' | 'WD' | 'XD' =
        discLower.includes("men's singles") || discLower === 'ms' ? 'MS' :
        discLower.includes("women's singles") || discLower === 'ws' ? 'WS' :
        discLower.includes("men's doubles") || discLower === 'md' ? 'MD' :
        discLower.includes("women's doubles") || discLower === 'wd' ? 'WD' : 'XD';

      const note = gRows[0].publicNote || '';
      const indianNames = gRows.map((r) => r.athlete?.fullName || r.sourceName || 'India').filter(Boolean);

      // Parse opponent and seed details from note
      const isBye = /bye/i.test(note) && !note.includes('First round:');

      let opponentNames: string[] = [];
      let opponentCountry = '';
      let opponentCountryCode = '';
      let opponentFlag = '';

      const oppMatch = note.match(/First\s+round:\s*([^(.]+)(?:\s*\(([^)]+)\))?/i);
      if (oppMatch) {
        opponentNames = oppMatch[1].trim().split(/\s*\/\s*/).map((n) => n.trim());
        opponentCountryCode = (oppMatch[2] || '').trim().toUpperCase();
        opponentFlag = this.BADMINTON_COUNTRY_FLAGS[opponentCountryCode] || '🏸';
        opponentCountry = opponentCountryCode;
      } else if (isBye) {
        opponentNames = ['Winner of R64 (TBD)'];
        opponentCountryCode = 'TBD';
        opponentFlag = '🎟️';
      } else {
        opponentNames = ['Opponent to be confirmed'];
        opponentCountryCode = 'TBC';
        opponentFlag = '🏸';
      }

      // Determine Indian seed
      let seed: string | null = null;
      for (const n of indianNames) {
        const lower = n.toLowerCase();
        if (KNOWN_INDIAN_SEEDS[lower]) {
          seed = KNOWN_INDIAN_SEEDS[lower];
          break;
        }
      }
      if (!seed) {
        const seedMatch = note.match(/seed(?:ed)?\s*\[?(\d+)\]?/i);
        if (seedMatch) seed = seedMatch[1];
      }

      // Determine Opponent seed
      let opponentSeed: string | null = null;
      for (const opp of opponentNames) {
        const lower = opp.toLowerCase();
        if (KNOWN_OPPONENT_SEEDS[lower]) {
          opponentSeed = KNOWN_OPPONENT_SEEDS[lower];
          break;
        }
      }
      if (!opponentSeed) {
        const oppSeedMatch = note.match(/\[(\d+)\]\s*[A-Z]/i) || note.match(/(?:vs|against)\s+\[?(\d+)\]?/i);
        if (oppSeedMatch) opponentSeed = oppSeedMatch[1];
      }

      return {
        discipline: discName,
        disciplineCode,
        names: indianNames,
        seed,
        opponentNames,
        opponentSeed,
        opponentCountry,
        opponentCountryCode,
        opponentFlag,
        round: isBye ? 'Round of 32' : 'Round of 64',
        timeLabel: isBye ? 'Direct Entry to R32' : 'Order of play TBC',
        court: 'Court TBC',
        bye: isBye,
        note: note || (isBye ? 'Seeded bye to Round of 32' : 'First round fixture'),
        status: isBye ? 'bye' : 'upcoming',
      };
    });

    if (dateKey === '2026-08-17') {
      return all.filter((e) => !e.bye && e.round === 'Round of 64');
    }
    if (dateKey === '2026-08-18') {
      return all.filter((e) => e.bye || e.round === 'Round of 32');
    }
    return all;
  }

  private mapAthleticsField(rows: GamesParticipationRow[]): AthleticsCompetitor[] {
    if (!rows.length) return this.fallbackLausanneField();
    const KNOWN_JAVELIN_PBS: Record<string, string> = {
      'neeraj chopra': '90.23m',
      'arshad nadeem': '92.97m',
      'anderson peters': '93.07m',
      'keshorn walcott': '90.16m',
      'thomas rohler': '93.90m',
      'thomas röhler': '93.90m',
      'rumesh pathirage': '92.62m',
    };

    const mapped: AthleticsCompetitor[] = rows.map((r) => {
      const name = r.sourceName || r.athlete?.fullName || '';
      const countryRaw = r.displayGroup || r.publicNote || '';
      const countryCode = resolveCountryCode(countryRaw || name);
      const isIndia = countryCode === 'IND' || name.toLowerCase().includes('neeraj');
      const flag = this.BADMINTON_COUNTRY_FLAGS[countryCode] || (isIndia ? '🇮🇳' : '🌍');
      const pb = KNOWN_JAVELIN_PBS[name.toLowerCase().trim()] || (isIndia ? '90.23m' : undefined);
      return {
        name,
        country: countryRaw || (isIndia ? 'India' : countryCode),
        countryCode,
        flag,
        isIndia,
        pb,
      };
    }).filter((r) => !!r.name);

    const hasNeeraj = mapped.some((m) => m.isIndia || m.name.toLowerCase().includes('neeraj'));
    if (!hasNeeraj) {
      mapped.unshift({
        name: 'Neeraj Chopra',
        country: 'India',
        countryCode: 'IND',
        flag: '🇮🇳',
        isIndia: true,
        pb: '90.23m',
      });
    } else {
      mapped.sort((a, b) => (b.isIndia ? 1 : 0) - (a.isIndia ? 1 : 0));
    }
    return mapped;
  }

  private mapAthleticsProgramme(programmeRows?: any[]): { men: ProgrammeEventItem[]; women: ProgrammeEventItem[] } {
    if (!programmeRows || !programmeRows.length) return this.fallbackBhubaneswarProgramme();
    const men: ProgrammeEventItem[] = [];
    const women: ProgrammeEventItem[] = [];

    programmeRows.forEach((item: any) => {
      const entry: ProgrammeEventItem = {
        gender: item.gender === 'women' ? 'women' : 'men',
        name: item.name || item.event || 'Track & Field',
        timeLabel: item.timeLabel || null,
      };
      if (entry.gender === 'men') men.push(entry);
      else women.push(entry);
    });

    return { men, women };
  }

  private formatDateKey(dateKey: string): string {
    if (!dateKey) return 'Date TBC';
    try {
      const date = new Date(`${dateKey}T12:00:00+05:30`);
      return new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(date);
    } catch {
      return dateKey;
    }
  }

  private fallbackHockeyRows(): any[] {
    return [
      { name: 'India vs Wales', startTime: '2026-08-15T16:30:00+05:30' },
      { name: 'India vs England', startTime: '2026-08-17T18:30:00+05:30' },
      { name: 'Pakistan vs India', startTime: '2026-08-19T18:30:00+05:30' },
    ];
  }

  private fallbackBadmintonEntries(dateKey?: string): BadmintonEntryItem[] {
    const all: BadmintonEntryItem[] = [
      // Men's Singles (MS)
      {
        discipline: "Men's Singles",
        disciplineCode: 'MS',
        names: ['Lakshya Sen'],
        seed: '14',
        opponentNames: ['Collins Valentine Filimon'],
        opponentCountry: 'Austria',
        opponentCountryCode: 'AUT',
        opponentFlag: '🇦🇹',
        round: 'Round of 64',
        timeLabel: 'Order of play TBC',
        court: 'Court TBC',
        bye: false,
        note: 'R64 vs Collins Valentine Filimon (AUT)',
        status: 'upcoming',
      },
      {
        discipline: "Men's Singles",
        disciplineCode: 'MS',
        names: ['Ayush Shetty'],
        opponentNames: ['Shi Yu Qi'],
        opponentSeed: '1',
        opponentCountry: 'China',
        opponentCountryCode: 'CHN',
        opponentFlag: '🇨🇳',
        round: 'Round of 64',
        timeLabel: 'Order of play TBC',
        court: 'Court TBC',
        bye: false,
        note: 'R64 vs [1] Shi Yu Qi (CHN)',
        status: 'upcoming',
      },
      // Women's Singles (WS)
      {
        discipline: "Women's Singles",
        disciplineCode: 'WS',
        names: ['PV Sindhu'],
        seed: '16',
        opponentNames: ['Winner of R64 (TBD)'],
        opponentCountry: 'TBD',
        round: 'Round of 32',
        timeLabel: 'Direct Entry to R32',
        bye: true,
        note: 'Seeded [16] · Bye to Round of 32',
        status: 'bye',
      },
      {
        discipline: "Women's Singles",
        disciplineCode: 'WS',
        names: ['Anmol Kharb'],
        opponentNames: ['Lianne Tan'],
        opponentCountry: 'Belgium',
        opponentCountryCode: 'BEL',
        opponentFlag: '🇧🇪',
        round: 'Round of 64',
        timeLabel: 'Order of play TBC',
        court: 'Court TBC',
        bye: false,
        note: 'R64 vs Lianne Tan (BEL)',
        status: 'upcoming',
      },
      // Men's Doubles (MD)
      {
        discipline: "Men's Doubles",
        disciplineCode: 'MD',
        names: ['Satwiksairaj Rankireddy', 'Chirag Shetty'],
        seed: '3',
        opponentNames: ['Winner of R64 (TBD)'],
        opponentCountry: 'TBD',
        round: 'Round of 32',
        timeLabel: 'Direct Entry to R32',
        bye: true,
        note: 'Seeded [3] · Bye to Round of 32',
        status: 'bye',
      },
      {
        discipline: "Men's Doubles",
        disciplineCode: 'MD',
        names: ['Hariharan Amsakarunan', 'Ruban Kumar Rethinasabapathi'],
        opponentNames: ['Christopher Grimley', 'Matthew Grimley'],
        opponentCountry: 'Scotland',
        opponentCountryCode: 'SCO',
        opponentFlag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
        round: 'Round of 64',
        timeLabel: 'Order of play TBC',
        court: 'Court TBC',
        bye: false,
        note: 'R64 vs C. Grimley / M. Grimley (SCO)',
        status: 'upcoming',
      },
      // Women's Doubles (WD)
      {
        discipline: "Women's Doubles",
        disciplineCode: 'WD',
        names: ['Treesa Jolly', 'Gayatri Gopichand'],
        opponentNames: ['Winner of R64 (TBD)'],
        opponentCountry: 'TBD',
        round: 'Round of 32',
        timeLabel: 'Direct Entry to R32',
        bye: true,
        note: 'Bye to Round of 32',
        status: 'bye',
      },
      {
        discipline: "Women's Doubles",
        disciplineCode: 'WD',
        names: ['Priya Konjengbam', 'Shruti Mishra'],
        opponentNames: ['Keng Shu Liang', 'Zhang Chi'],
        opponentCountry: 'China',
        opponentCountryCode: 'CHN',
        opponentFlag: '🇨🇳',
        round: 'Round of 64',
        timeLabel: 'Order of play TBC',
        court: 'Court TBC',
        bye: false,
        note: 'R64 vs Keng S.L. / Zhang C. (CHN)',
        status: 'upcoming',
      },
      // Mixed Doubles (XD)
      {
        discipline: "Mixed Doubles",
        disciplineCode: 'XD',
        names: ['Dhruv Kapila', 'Tanisha Crasto'],
        opponentNames: ['Jesper Toft', 'Amalie Magelund'],
        opponentCountry: 'Denmark',
        opponentCountryCode: 'DEN',
        opponentFlag: '🇩🇰',
        round: 'Round of 64',
        timeLabel: 'Order of play TBC',
        court: 'Court TBC',
        bye: false,
        note: 'R64 vs J. Toft / A. Magelund (DEN)',
        status: 'upcoming',
      },
      {
        discipline: "Mixed Doubles",
        disciplineCode: 'XD',
        names: ['Rohan Kapoor', 'Ruthvika Shivani Gadde'],
        opponentNames: ['Hiroki Midorikawa', 'Natsu Saito'],
        opponentCountry: 'Japan',
        opponentCountryCode: 'JPN',
        opponentFlag: '🇯🇵',
        round: 'Round of 64',
        timeLabel: 'Order of play TBC',
        court: 'Court TBC',
        bye: false,
        note: 'R64 vs H. Midorikawa / N. Saito (JPN)',
        status: 'upcoming',
      },
    ];

    if (dateKey === '2026-08-17') {
      return all.filter((e) => !e.bye && e.round === 'Round of 64');
    }
    if (dateKey === '2026-08-18') {
      return all.filter((e) => e.bye || e.round === 'Round of 32');
    }
    return all;
  }

  private fallbackLausanneField(): AthleticsCompetitor[] {
    return [
      { name: 'Neeraj Chopra', country: 'India', countryCode: 'IND', flag: '🇮🇳', isIndia: true, pb: '90.23m', sb: '88.36m' },
      { name: 'Arshad Nadeem', country: 'Pakistan', countryCode: 'PAK', flag: '🇵🇰', isIndia: false, pb: '92.97m', sb: '92.97m' },
      { name: 'Anderson Peters', country: 'Grenada', countryCode: 'GRN', flag: '🇬🇩', isIndia: false, pb: '93.07m', sb: '88.63m' },
      { name: 'Keshorn Walcott', country: 'Trinidad and Tobago', countryCode: 'TTO', flag: '🇹🇹', isIndia: false, pb: '90.16m', sb: '88.22m' },
      { name: 'Thomas Röhler', country: 'Germany', countryCode: 'GER', flag: '🇩🇪', isIndia: false, pb: '93.90m', sb: '85.50m' },
      { name: 'Rumesh Pathirage', country: 'Sri Lanka', countryCode: 'SRI', flag: '🇱🇰', isIndia: false, pb: '92.62m', sb: '92.62m' },
    ];
  }

  private fallbackBhubaneswarProgramme(): { men: ProgrammeEventItem[]; women: ProgrammeEventItem[] } {
    return {
      men: [
        { gender: 'men', name: '100m' },
        { gender: 'men', name: '400m' },
        { gender: 'men', name: '800m' },
        { gender: 'men', name: '5000m' },
        { gender: 'men', name: '110m Hurdles' },
        { gender: 'men', name: 'High Jump' },
        { gender: 'men', name: 'Long Jump' },
        { gender: 'men', name: 'Shot Put' },
        { gender: 'men', name: 'Javelin Throw' },
      ],
      women: [
        { gender: 'women', name: '100m' },
        { gender: 'women', name: '400m' },
        { gender: 'women', name: '1500m' },
        { gender: 'women', name: '5000m' },
        { gender: 'women', name: '100m Hurdles' },
        { gender: 'women', name: 'High Jump' },
        { gender: 'women', name: 'Long Jump' },
        { gender: 'women', name: 'Discus Throw' },
        { gender: 'women', name: 'Javelin Throw' },
      ],
    };
  }
}
