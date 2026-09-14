import { Video, resolveYouTubeVideoId } from './originals.service';

/** Home is a current selection, not a permanently pinned archive. */
export function selectHomeVideos(videos: Video[], now = new Date()): Video[] {
  const time = (value?: string | null) => Date.parse(value || '') || 0;
  const rank = (video: Video) => video.broadcast?.status === 'live' ? 0
    : video.broadcast?.status === 'scheduled' ? 1 : 2;
  const unique = new Map<string, Video>();
  for (const video of videos) {
    const id = resolveYouTubeVideoId(video);
    if (!id || (video.broadcast?.status === 'scheduled' && time(video.broadcast.scheduledStartTime) < now.getTime())) continue;
    if (!unique.has(id)) unique.set(id, video);
  }
  return [...unique.values()].sort((a, b) => rank(a) - rank(b) || (rank(a) === 1
    ? time(a.broadcast?.scheduledStartTime) - time(b.broadcast?.scheduledStartTime)
    : time(b.publishedDate) - time(a.publishedDate))).slice(0, 3);
}

export function selectHubVideo(videos: Video[], now = new Date()): Video | null {
  const time = (value?: string | null) => Date.parse(value || '') || 0;
  const rank = (video: Video) => video.broadcast?.status === 'live' ? 0
    : video.broadcast?.status === 'scheduled' && time(video.broadcast.scheduledStartTime) >= now.getTime() ? 1
    : video.featured ? 2 : 3;
  return videos.filter((video) => resolveYouTubeVideoId(video)).sort((a, b) =>
    rank(a) - rank(b) || (rank(a) === 1
      ? time(a.broadcast?.scheduledStartTime) - time(b.broadcast?.scheduledStartTime)
      : time(b.publishedDate) - time(a.publishedDate)),
  )[0] || null;
}

export function broadcastLabel(video: Video): string {
  if (video.broadcast?.status === 'live') return 'IOD live';
  if (video.broadcast?.status === 'replay') return 'Watch the replay';
  if (video.broadcast?.status === 'scheduled') return 'Join us on YouTube';
  return 'Watch with IOD';
}

export function broadcastTimeLabel(video: Video): string | null {
  const time = Date.parse(video.broadcast?.scheduledStartTime || '');
  if (video.broadcast?.status !== 'scheduled' || !Number.isFinite(time)) return null;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(time)) + ' IST';
}
