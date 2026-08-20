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
  macau: 'MAC', mac: 'MAC',
};

const COUNTRY_NAMES: Record<string, string> = {
  AUT: 'Austria', BUL: 'Bulgaria', CAN: 'Canada', CHN: 'China', DEN: 'Denmark',
  ESP: 'Spain', INA: 'Indonesia', IND: 'India', IRL: 'Ireland', JPN: 'Japan',
  KOR: 'Korea', MAC: 'Macau', MAS: 'Malaysia', MMR: 'Myanmar', MYA: 'Myanmar',
  SCO: 'Scotland', SRI: 'Sri Lanka', TUR: 'Türkiye', USA: 'United States',
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
  activeMomentId = signal<string | null>(null);
  returnToResults = signal<boolean>(false);

  open(detail: SportsDetailModel): void {
    this.detail.set(detail);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.detail.set(null);
    this.activeMomentId.set(null);
    this.returnToResults.set(false);
  }

  /**
   * Builds and opens a SportsDetailModel directly from a SportsMoment on Home.
   */
  openMoment(moment: SportsMoment, allScheduleRows: GamesScheduleRow[] = []): void {
    this.returnToResults.set(false);
    this.activeMomentId.set(moment.id);
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
        if (moment.result?.matchScore) {
          matchup.teamA.score = moment.result.matchScore.home;
          matchup.teamB.score = moment.result.matchScore.away;
        }
      }
    }

    const state: SportsDetailState =
      moment.timingState === 'tbc' ? 'tbc' : (moment.state as SportsDetailState);

    const stateLabel =
      state === 'live' ? 'LIVE NOW' :
        state === 'completed' ? (moment.resultPending ? 'AWAITING RESULT' : 'RESULT') :
          state === 'tbc' ? 'TIME TBC' : 'UPCOMING';

    const dateFormatted = this.formatDateKey(moment.dateKey);

    const isBadminton = moment.sport.slug === 'badminton' || (moment.competition || '').toLowerCase().includes('bwf');
    const isHockey = moment.sport.slug === 'hockey' || (moment.competition || '').toLowerCase().includes('hockey');
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
      resultSummary: state === 'completed' && !moment.resultPending && !moment.result?.live
        ? moment.resultLabel
        : null,
      actions: moment.action?.navigation.href ? {
        externalUrl: moment.action.navigation.href,
        whereToWatchUrl: null,
      } : null,
    };

    // 1. A Home Hockey moment is a focused scorecard. Full tournament format
    // belongs to the Event Centre, not this moment sheet.
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

      this.open(baseModel);
      return;
    }

    // 2. A Home BWF moment is one match, not a miniature tournament browser.
    if (isBadminton) {
      baseModel.competitionTitle = 'BWF World Championships 2026';
      baseModel.venue = 'Indira Gandhi Indoor Stadium, New Delhi';
      baseModel.actions = {
        whereToWatchUrl: 'https://www.hotstar.com/in/sports/badminton',
        whereToWatchLabel: 'Watch Live',
        externalUrl: 'https://bwfworldchampionships.bwfbadminton.com/',
      };
      if (baseModel.matchup) {
        baseModel.badmintonMatchDetail = true;
        const scorecard = this.buildBadmintonMatchDetail(moment, baseModel.matchup);
        this.payload.getEventHubParticipations('bwf-world-championships-2026').pipe(
          catchError(() => of([])),
          map((rows) => {
            if (!rows.length) return scorecard;
            const participation = this.findBadmintonParticipationForMoment(
              this.mapBadmintonEntries(rows, moment.dateKey),
              moment,
            );
            return participation ? {
              ...scorecard,
              seed: scorecard.seed || participation.seed,
              opponentSeed: scorecard.opponentSeed || participation.opponentSeed,
              opponentCountry: scorecard.opponentCountry || participation.opponentCountry,
              opponentCountryCode: scorecard.opponentCountryCode || participation.opponentCountryCode,
              opponentFlag: scorecard.opponentFlag || participation.opponentFlag,
            } : scorecard;
          }),
        ).subscribe((entry) => {
          this.open({ ...baseModel, badmintonEntries: [entry] });
        });
        return;
      }
      this.open(baseModel);
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

  /** Opens a focused result while preserving the Latest Results sheet underneath. */
  openMomentFromResults(moment: SportsMoment): void {
    this.openMoment(moment);
    this.returnToResults.set(true);
  }

  refreshOpenMoment(moment: SportsMoment): void {
    if (!this.isOpen() || this.activeMomentId() !== moment.id) return;
    const current = this.detail();
    if (!current) return;

    const state: SportsDetailState = moment.timingState === 'tbc' ? 'tbc' : moment.state;
    const next: SportsDetailModel = {
      ...current,
      state,
      stateLabel: state === 'live' ? 'LIVE NOW' : state === 'completed' ? 'RESULT' : state === 'tbc' ? 'TIME TBC' : 'UPCOMING',
      timeLabel: state === 'live' ? 'LIVE' : moment.timingLabel,
      resultSummary: state === 'completed' && !moment.resultPending && !moment.result?.live
        ? moment.resultLabel
        : null,
    };

    if (next.matchup && moment.result?.matchScore) {
      next.matchup = {
        teamA: { ...next.matchup.teamA, score: moment.result.matchScore.home },
        teamB: { ...next.matchup.teamB, score: moment.result.matchScore.away },
      };
    }
    if (next.badmintonMatchDetail && next.matchup) {
      const previous = next.badmintonEntries?.[0];
      const refreshed = this.buildBadmintonMatchDetail(moment, next.matchup);
      next.badmintonEntries = [{
        ...refreshed,
        seed: refreshed.seed || previous?.seed || null,
        opponentSeed: refreshed.opponentSeed || previous?.opponentSeed || null,
        opponentCountry: refreshed.opponentCountry || previous?.opponentCountry,
        opponentCountryCode: refreshed.opponentCountryCode || previous?.opponentCountryCode,
        opponentFlag: refreshed.opponentFlag || previous?.opponentFlag,
      }];
    }
    this.detail.set(next);
  }

  /**
   * Opens SportsDetailModel from a Day Anchor (e.g. BWF Worlds tournament anchor).
   */
  openAnchor(anchor: SportsMomentAnchor): void {
    this.returnToResults.set(false);
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
      venue: isBadminton ? 'Indira Gandhi Indoor Stadium, New Delhi' : (anchor.location || null),
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
    this.returnToResults.set(false);
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
    MAC: '🇲🇴',
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
        discLower.includes("women's doubles") || discLower === 'wd' ? 'WD' :
        discLower.includes("men's doubles") || discLower === 'md' ? 'MD' : 'XD';

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

    // The official order of play can mix rounds on the same competition day.
    // Match the focused Home moment against the complete verified roster rather
    // than inferring which entries are eligible from the calendar date.
    return all;
  }

  private buildBadmintonMatchDetail(
    moment: SportsMoment,
    matchup: NonNullable<SportsDetailModel['matchup']>,
  ): BadmintonEntryItem {
    const contextParts = (moment.context || '')
      .split('·')
      .map((part) => part.trim())
      .filter(Boolean);
    const discipline = contextParts[0] || 'Badminton';
    const disciplineCode: BadmintonEntryItem['disciplineCode'] =
      /women's singles|^ws$/i.test(discipline) ? 'WS' :
        /women's doubles|^wd$/i.test(discipline) ? 'WD' :
          /men's doubles|^md$/i.test(discipline) ? 'MD' :
            /mixed|^xd$/i.test(discipline) ? 'XD' : 'MS';
    const round = contextParts.find((part) => /round/i.test(part)) || 'Round TBC';
    const court = contextParts.find((part) => /court/i.test(part));
    const sequence = contextParts.find((part) => /match\s+\d+\s+in order|follows|not before|scheduled start|time tba/i.test(part));
    const matchOrder = sequence?.match(/match\s+(\d+)/i)?.[1];
    const splitSide = (name: string): string[] => name
      .split(/\s*\/\s*/)
      .map((part) => part.trim())
      .filter(Boolean);

    matchup.teamA.isIndia = true;
    matchup.teamA.code = 'IND';
    matchup.teamA.flag = '';
    const matchupOpponentCode = moment.result?.matchup?.opponentCountryCode?.toUpperCase() || '';
    const winnerCountryCode = moment.result?.winnerCountryCode?.toUpperCase() || '';
    // Older verified BWF results predate the structured matchup block. In an
    // India-facing match, a non-IND winner is deterministically the opponent;
    // this preserves those results without guessing from athlete names.
    const opponentCountryCode = matchupOpponentCode || (winnerCountryCode && winnerCountryCode !== 'IND'
      ? winnerCountryCode
      : '');

    return {
      discipline,
      disciplineCode,
      names: splitSide(matchup.teamA.name),
      seed: moment.result?.matchup?.indiaSeed || null,
      opponentNames: splitSide(matchup.teamB.name),
      opponentSeed: moment.result?.matchup?.opponentSeed || null,
      round,
      matchOrder: matchOrder ? Number(matchOrder) : null,
      timeLabel: moment.timingLabel,
      court,
      bye: false,
      note: [court, sequence].filter(Boolean).join(' · ') || moment.context || undefined,
      status: moment.state,
      score: moment.result?.score?.india.join(' ') || null,
      opponentScore: moment.result?.score?.opponent.join(' ') || null,
      opponentStatusLabel: moment.result?.completion === 'retirement' ? 'RET' : null,
      resultNote: this.getBadmintonResultNote(moment),
      durationLabel: this.getBadmintonDurationLabel(moment),
      outcome: moment.result?.outcome || null,
      opponentCountry: COUNTRY_NAMES[opponentCountryCode] || opponentCountryCode,
      opponentCountryCode,
      opponentFlag: opponentCountryCode ? (this.BADMINTON_COUNTRY_FLAGS[opponentCountryCode] || '🏸') : '',
      currentGame: moment.result?.live?.currentGame || null,
      servingSide: moment.result?.live?.servingSide || null,
      liveRevision: moment.result?.live?.revision || null,
      liveUpdatedAt: moment.result?.live?.updatedAt || null,
      liveStatus: moment.result?.live?.status || null,
      livePhase: moment.result?.live?.phase || null,
      livePressure: moment.result?.live?.pressure || null,
      liveChallenge: moment.result?.live?.challenge || null,
      liveUpdates: moment.result?.live?.updates || [],
    };
  }

  private getBadmintonResultNote(moment: SportsMoment): string | null {
    if (!moment.result) return null;
    const parts: string[] = [];
    if (moment.result.outcome === 'win') parts.push('India won');
    else if (moment.result.outcome === 'loss') parts.push('India lost');

    if (moment.result.completion === 'retirement') parts.push('Opponent retired');
    else if (moment.result.completion === 'walkover') parts.push('Walkover');
    else if (moment.result.completion === 'disqualification') parts.push('Disqualification');

    if (moment.result.advanced) parts.push('Advanced');
    return parts.join(' · ') || null;
  }

  private getBadmintonDurationLabel(moment: SportsMoment): string | null {
    const durationSeconds = moment.result?.durationSeconds ?? moment.result?.live?.elapsedSeconds;
    if (!durationSeconds) return null;
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return seconds ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${minutes} min`;
  }

  private findBadmintonParticipationForMoment(
    entries: BadmintonEntryItem[],
    moment: SportsMoment,
  ): BadmintonEntryItem | null {
    const opponentSide = moment.headline.split(/\s+(?:vs\.?|v)\s+/i)[1];
    if (!opponentSide) return null;

    const normalize = (value: string): string => value
      .normalize('NFKD')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();
    const targetOpponents = opponentSide
      .split(/\s*\/\s*/)
      .map(normalize)
      .filter(Boolean);

    return entries.find((entry) => targetOpponents.every((target) =>
      (entry.opponentNames || []).some((name) => {
        const candidate = normalize(name);
        return candidate.includes(target) || target.includes(candidate);
      }),
    )) || null;
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
