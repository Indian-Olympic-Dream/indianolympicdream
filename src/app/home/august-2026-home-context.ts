/**
 * Verified release-slice facts which are not yet represented by schedule rows.
 * They add no invented timing: every unscheduled moment remains explicitly TBC.
 */
export interface AugustHomeEventContext {
  dailyCampaign?: {
    openingHeadline: string;
    dailyHeadline: string;
    awaitingDetail: string;
  };
  indiaMoment?: {
    headline: string;
    context: string;
  };
  programme?: {
    totalEvents: number;
    groupLabels: string[];
  };
}

export const AUGUST_2026_HOME_CONTEXT: Record<string, AugustHomeEventContext> = {
  'bwf-world-championships-2026': {
    dailyCampaign: {
      openingHeadline: 'Indian opening-round matches',
      dailyHeadline: 'Indian players in action',
      awaitingDetail: 'Order of play awaiting confirmation',
    },
  },
  'diamond-league-lausanne': {
    indiaMoment: {
      headline: 'Neeraj Chopra',
      context: 'Javelin',
    },
  },
  'indian-open-wact-silver-level-meet': {
    indiaMoment: {
      headline: "India's athletes in action",
      context: 'Programme timings awaiting confirmation',
    },
  },
};
