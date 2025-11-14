import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-text-block',
  standalone: true,
  imports: [CommonModule],
  template: `<p *ngIf="block?.text">{{ block.text }}</p>`,
  styles: [`
    :host {
      display: contents; // Ensure the component doesn't add an extra element to the DOM
    }
  `]
})
export class TextBlockComponent {
  @Input() block: any;
}
