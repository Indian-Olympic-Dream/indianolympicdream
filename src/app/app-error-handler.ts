import { ErrorHandler, Injectable, Injector, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private injector = inject(Injector);
  private platformId = inject(PLATFORM_ID);

  handleError(error: unknown): void {
    console.error(error);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const router = this.injector.get(Router);
    const errorObject = error instanceof Error ? error : new Error(String(error));

    if (router.url === '/internal-error') {
      return;
    }

    void router.navigateByUrl('/internal-error', {
      replaceUrl: true,
      state: {
        kind: 'runtime',
        route: router.url,
        sourceUrl: this.currentUrl(),
        message: errorObject.message || 'Unhandled runtime error.',
        stack: errorObject.stack,
      },
    });
  }

  private currentUrl(): string {
    if (!isPlatformBrowser(this.platformId)) return '/';
    return window.location.href;
  }
}
