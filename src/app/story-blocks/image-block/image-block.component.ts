import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PayloadMediaPipe } from '../../shared/payload-media.pipe';

@Component({
  selector: 'app-image-block',
  standalone: true,
  imports: [CommonModule, PayloadMediaPipe],
  templateUrl: './image-block.component.html',
  styleUrls: ['./image-block.component.scss']
})
export class ImageBlockComponent {
  @Input() block: any;

  // Use the 'card' size for normal layout, but could use 'full' for wide/full-width
  get imageUrl(): string {
    return this.block?.image?.sizes?.card?.url || this.block?.image?.sizes?.full?.url;
  }
}
