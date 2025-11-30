import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pull-quote-block',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pull-quote-block.component.html',
  styleUrls: ['./pull-quote-block.component.scss']
})
export class PullQuoteBlockComponent {
  @Input() block: any;
}
