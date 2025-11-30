import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { PayloadMediaPipe } from "../../shared/payload-media.pipe";

@Component({
  selector: "app-image-gallery-block",
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, PayloadMediaPipe],
  templateUrl: "./image-gallery-block.component.html",
  styleUrls: ["./image-gallery-block.component.scss"],
})
export class ImageGalleryBlockComponent {
  @Input() block: any;

  currentIndex: number = 0;

  previousImage(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else {
      this.currentIndex = this.block.images.length - 1; // Loop to the end
    }
  }

  nextImage(): void {
    if (this.currentIndex < this.block.images.length - 1) {
      this.currentIndex++;
    } else {
      this.currentIndex = 0; // Loop to the start
    }
  }

  goToImage(index: number): void {
    this.currentIndex = index;
  }
}
