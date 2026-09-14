import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Video, getYouTubeThumbnailUrl, resolveYouTubeVideoId } from '../originals/originals.service';
import { broadcastLabel, broadcastTimeLabel } from '../originals/broadcast-presentation';
import { SafeResourceUrlPipe } from '../shared/pipes/safe-resource-url.pipe';

@Component({
  selector: 'app-hub-broadcast',
  standalone: true,
  imports: [CommonModule, MatIcon, SafeResourceUrlPipe],
  template: `
    <article class="broadcast" [class.is-live]="video.broadcast?.status === 'live'">
      <div class="player">
        <button *ngIf="!playing()" type="button" class="poster" (click)="playing.set(true)" [attr.aria-label]="'Play ' + video.title">
          <img *ngIf="thumbnail()" [src]="thumbnail()" alt="" width="480" height="270" (error)="thumbnailFailed()">
          <span class="play"><mat-icon>play_arrow</mat-icon></span>
          <span class="status"><i *ngIf="video.broadcast?.status === 'live'"></i>{{ label(video) }}</span>
        </button>
        <iframe *ngIf="playing()" [src]="embedUrl | safeResourceUrl" [title]="video.title"
          allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
        <button *ngIf="playing()" class="close" type="button" (click)="playing.set(false)" aria-label="Close video"><mat-icon>close</mat-icon></button>
      </div>
      <div class="copy">
        <div class="meta"><span>Indian Olympic Dream</span><time *ngIf="time(video) as date">{{ date }}</time></div>
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
