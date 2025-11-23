import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { SafeResourceUrlPipe } from "../../shared/pipes/safe-resource-url.pipe";

@Component({
  selector: "app-embed-block",
  standalone: true,
  imports: [CommonModule, MatCardModule, SafeResourceUrlPipe],
  templateUrl: "./embed-block.component.html",
  styleUrls: ["./embed-block.component.scss"],
})
export class EmbedBlockComponent {
  @Input() block: any;

  get embedUrl(): string {
    if (!this.block?.url) {
      return "";
    }

    const url = this.block.url;
    const platform = this.block.platform;

    switch (platform) {
      case "youtube":
        const youtubeId = this.getYouTubeId(url);
        return youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : "";
      case "vimeo":
        const vimeoId = this.getVimeoId(url);
        return vimeoId ? `https://player.vimeo.com/video/${vimeoId}` : "";
      default:
        return url;
    }
  }

  private getYouTubeId(url: string): string | null {
    if (!url) return null;
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  private getVimeoId(url: string): string | null {
    if (!url) return null;
    const regExp =
      /https?:\/\/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/;
    const match = url.match(regExp);
    return match ? match[3] : null;
  }
}
