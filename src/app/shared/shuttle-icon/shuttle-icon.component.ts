import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-shuttle-icon',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.2 3.2h9.6l-2.5 9.2H9.7L7.2 3.2Zm2.7 11.2h4.2l1.4 3.7-1.9 2.7h-3.2l-1.9-2.7 1.4-3.7ZM9.2 3.5l2 8.2m3.6-8.2-2 8.2M12 3.5v8.2" />
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; width: 18px; height: 18px; color: #82adf7; }
    svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.55; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShuttleIconComponent {}
