import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-pull-quote-block',
  standalone: true,
  imports: [],
  templateUrl: './pull-quote-block.component.html',
  styleUrls: ['./pull-quote-block.component.scss']
})
export class PullQuoteBlockComponent {
  @Input() block: any;
}
