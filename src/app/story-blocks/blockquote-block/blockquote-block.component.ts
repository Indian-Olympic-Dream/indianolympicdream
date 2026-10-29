import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-blockquote-block',
  standalone: true,
  imports: [],
  templateUrl: './blockquote-block.component.html',
  styleUrls: ['./blockquote-block.component.scss']
})
export class BlockquoteBlockComponent {
  @Input() block: any;
}
