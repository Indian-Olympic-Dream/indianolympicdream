import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { EmbedBlockComponent } from "../embed-block/embed-block.component";
import { ImageBlockComponent } from "../image-block/image-block.component";
import { ImageGalleryBlockComponent } from "../image-gallery-block/image-gallery-block.component";
import { TextBlockComponent } from "../text-block/text-block.component";
import { BlockquoteBlockComponent } from "../blockquote-block/blockquote-block.component";
import { PullQuoteBlockComponent } from "../pull-quote-block/pull-quote-block.component";
import { RichTextBlockComponent } from "../rich-text-block/rich-text-block.component";

// Import other block components here in the future

@Component({
  selector: "app-block-renderer",
  standalone: true,
  imports: [
    CommonModule,
    RichTextBlockComponent,
    PullQuoteBlockComponent,
    BlockquoteBlockComponent,
    TextBlockComponent,
    ImageGalleryBlockComponent,
    ImageBlockComponent,
    EmbedBlockComponent,
    // Other block components
  ],
  templateUrl: "./block-renderer.component.html",
})
export class BlockRendererComponent {
  @Input() block: any;
}
