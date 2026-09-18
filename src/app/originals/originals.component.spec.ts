import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OriginalsComponent } from './originals.component';
import { OriginalsService, Video } from './originals.service';

describe('Originals editorial classification', () => {
  const video = (id: string, type: Video['type'], extra = {}): Video => ({
    id, youtubeId: id, title: 'Asian Games Preview', type, featured: false,
    duration: 30, sports: [], athletes: [], calendarEvents: [], tags: [], ...extra,
  });
  const videos = [
    video('abcdefghijk', 'highlight'), video('bcdefghijkl', 'short', { duration: 180 }),
    video('cdefghijklm', 'live', { broadcast: { status: 'replay' } }),
    video('defghijklmn', 'podcast'), video('efghijklmno', 'video'),
  ];
  let component: OriginalsComponent;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: OriginalsService, useValue: {
      getVideosByType: (type: string) => of(videos.filter(v => v.type === type)),
    } }] });
    component = TestBed.runInInjectionContext(() => new OriginalsComponent());
    component.ngOnInit();
  });
  it('keeps distinct videos with identical titles and includes unclassified uploads', () => {
    expect(component.displayVideos().length).toBe(5);
  });
  it('does not turn short-duration highlights into Shorts', () => {
    component.setTypeFilter('short');
    expect(component.displayVideos().map(v => v.id)).toEqual(['bcdefghijkl']);
  });
  it('includes live replays and preserves editorial podcast format', () => {
    component.setTypeFilter('live');
    expect(component.displayVideos()[0].id).toBe('cdefghijklm');
    component.setTypeFilter('podcast');
    expect(component.displayVideos()[0].id).toBe('defghijklmn');
  });
});
