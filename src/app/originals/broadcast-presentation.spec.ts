import { selectHomeVideos } from './broadcast-presentation';
import { Video, resolveYouTubeVideoId } from './originals.service';

describe('Home editorial selection', () => {
  const now = new Date('2026-09-10T12:00:00Z');
  const video = (id: string, extra = {}): Video => ({
    id, youtubeId: id, title: id, type: 'video', publishedDate: '2026-09-09',
    featured: false, sports: [], athletes: [], calendarEvents: [], tags: [], ...extra,
  });
  it('prioritizes live then scheduled then latest; ignores old featured pins and expired schedules', () => {
    const result = selectHomeVideos([
      video('abcdefghijk', { featured: true, publishedDate: '2026-01-01' }),
      video('bcdefghijkl'),
      video('cdefghijklm', { broadcast: { status: 'live' } }),
      video('defghijklmn', { broadcast: { status: 'scheduled', scheduledStartTime: '2026-09-12' } }),
      video('efghijklmno', { broadcast: { status: 'scheduled', scheduledStartTime: '2026-09-08' } }),
    ], now);
    expect(result.map(v => v.id)).toEqual(['cdefghijklm', 'defghijklmn', 'bcdefghijkl']);
  });
  it('supports Shorts and live URLs without guessing their editorial type', () => {
    expect(resolveYouTubeVideoId({ youtubeURL: 'https://www.youtube.com/shorts/abcdefghijk' })).toBe('abcdefghijk');
    expect(resolveYouTubeVideoId({ youtubeURL: 'https://www.youtube.com/live/bcdefghijkl' })).toBe('bcdefghijkl');
  });
});
