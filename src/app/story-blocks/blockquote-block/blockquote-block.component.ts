import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-blockquote-block',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './blockquote-block.component.html',
  styleUrls: ['./blockquote-block.component.scss']
})
export class BlockquoteBlockComponent {
  @Input() block: any;
}
