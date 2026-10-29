
import { Component, Input, OnChanges, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Video, getYouTubeThumbnailUrl, resolveYouTubeVideoId } from '../originals/originals.service';
import { broadcastLabel, broadcastTimeLabel } from '../originals/broadcast-presentation';
import { SafeResourceUrlPipe } from '../shared/pipes/safe-resource-url.pipe';

@Component({
  selector: 'app-hub-broadcast',
  standalone: true,
  imports: [MatIcon, SafeResourceUrlPipe],
  template: `
    <article class="broadcast" [class.is-live]="video.broadcast?.status === 'live'">
      <div class="player">
        @if (!playing()) {
          <button type="button" class="poster" (click)="playing.set(true)" [attr.aria-label]="'Play ' + video.title">
            @if (thumbnail()) {
              <img [src]="thumbnail()" alt="" width="480" height="270" (error)="thumbnailFailed()">
            }
            <span class="play"><mat-icon>play_arrow</mat-icon></span>
            <span class="status">@if (video.broadcast?.status === 'live') {
              <i></i>
            }{{ label(video) }}</span>
          </button>
        }
        @if (playing()) {
          <iframe [src]="embedUrl | safeResourceUrl" [title]="video.title"
          allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
        }
        @if (playing()) {
          <button class="close" type="button" (click)="playing.set(false)" aria-label="Close video"><mat-icon>close</mat-icon></button>
        }
      </div>
      <div class="copy">
        <div class="meta"><span>Indian Olympic Dream</span>@if (time(video); as date) {
        <time>{{ date }}</time>
      }</div>
      <h2>{{ video.title }}</h2>
      <a [href]="watchUrl" target="_blank" rel="noopener noreferrer">{{ video.broadcast?.status === 'scheduled' ? 'Set a reminder on YouTube' : 'Open on YouTube' }} <mat-icon>north_east</mat-icon></a>
    </div>
    </article>
    `,
  styleUrl: './hub-broadcast.component.scss',
})
export class HubBroadcastComponent implements OnChanges {
  @Input({ required: true }) video!: Video;
  readonly playing = signal(false);
  readonly thumbnail = signal<string | null>(null);
  readonly label = broadcastLabel;
  readonly time = broadcastTimeLabel;
  private videoId = '';
  private fallbackUsed = false;
  get watchUrl(): string { return `https://www.youtube.com/watch?v=${resolveYouTubeVideoId(this.video)}`; }
  get embedUrl(): string { return `https://www.youtube-nocookie.com/embed/${resolveYouTubeVideoId(this.video)}?autoplay=1&rel=0`; }
  ngOnChanges(): void {
    if (this.videoId === this.video.id) return;
    this.videoId = this.video.id;
    this.playing.set(false);
    this.fallbackUsed = false;
    this.thumbnail.set(getYouTubeThumbnailUrl(this.video));
  }
  thumbnailFailed(): void {
    this.thumbnail.set(this.fallbackUsed ? null : `https://i.ytimg.com/vi/${resolveYouTubeVideoId(this.video)}/mqdefault.jpg`);
    this.fallbackUsed = true;
  }
}
