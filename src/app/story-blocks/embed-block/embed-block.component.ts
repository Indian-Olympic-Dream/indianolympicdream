import { Component, Input, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { SafeResourceUrlPipe } from "../../shared/pipes/safe-resource-url.pipe";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";

// State for each video card
interface VideoState {
  isPlaying: boolean;
  isLoading: boolean;
  thumbnailUrl: string;
}

@Component({
  selector: "app-embed-block",
  standalone: true,
  imports: [
    CommonModule,
    SafeResourceUrlPipe,
    MatProgressSpinnerModule,
    MatCardModule,
    MatIconModule,
  ],
  templateUrl: "./embed-block.component.html",
  styleUrls: ["./embed-block.component.scss"],
})
export class EmbedBlockComponent implements OnInit {
  @Input() block: any;

  public videoState: VideoState;
  public embedUrl: string = "";
  private videoId: string = "";

  ngOnInit(): void {
    // Currently, this only supports YouTube. We can add more platform logic here later.
    if (this.block.platform === "youtube") {
      this.videoId = this.getYouTubeId(this.block.url);
      if (this.videoId) {
        this.embedUrl = `https://www.youtube.com/embed/${this.videoId}?autoplay=1&mute=0&enablejsapi=1&rel=0`;
        this.videoState = {
          isPlaying: false,
          isLoading: false,
          // Use a high-quality thumbnail
          thumbnailUrl: `https://img.youtube.com/vi/${this.videoId}/hqdefault.jpg`,
        };
      }
    }
  }

  playVideo(): void {
    if (this.videoState && !this.videoState.isLoading) {
      this.videoState.isLoading = true;
      this.videoState.isPlaying = true;
    }
  }

  onVideoLoad(): void {
    if (this.videoState) {
      this.videoState.isLoading = false;
    }
  }

  private getYouTubeId(url: string): string | null {
    if (!url) return null;
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }
}
