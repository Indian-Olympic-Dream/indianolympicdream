import { Component, Input } from "@angular/core";


@Component({
  selector: "app-text-block",
  standalone: true,
  imports: [],
  template: `@if (block?.text) {<p>{{ block.text }}</p>}`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class TextBlockComponent {
  @Input() block: any;
}
