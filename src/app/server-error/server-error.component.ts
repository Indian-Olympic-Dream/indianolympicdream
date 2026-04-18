import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';

type InternalErrorState = {
  kind?: 'http' | 'runtime' | 'navigation';
  route?: string;
  sourceUrl?: string;
  method?: string;
  statusCode?: number;
  statusText?: string;
  message?: string;
  stack?: string;
};

@Component({
  selector: 'app-server-error',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './server-error.component.html',
  styleUrls: ['./server-error.component.scss'],
})
export class ServerErrorComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);

  protected readonly errorState = computed(() => this.readNavigationState());
  protected readonly errorSummary = computed(() => {
    const record = this.errorState();
    if (!record) return 'This is usually caused by a temporary loading issue. Please try again in a moment.';

    if (record.kind === 'http' && record.statusCode) {
      return `The last request returned ${record.statusCode}${record.statusText ? ` ${record.statusText}` : ''}.`;
    }

    if (record.kind === 'navigation') {
      return 'The page could not be loaded completely.';
    }

    if (record.kind === 'runtime') {
      return 'Something unexpected happened while the page was loading.';
    }

    return 'This page could not be loaded.';
  });

  retry(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    window.location.reload();
  }

  private readNavigationState(): InternalErrorState | null {
    const state =
      this.router.getCurrentNavigation()?.extras.state ||
      (isPlatformBrowser(this.platformId) ? window.history.state : null);

    if (!state || typeof state !== 'object') {
      return null;
    }

    const candidate = state as InternalErrorState;
    if (!candidate.kind && !candidate.message && !candidate.statusCode) {
      return null;
    }

    return candidate;
  }
}
