import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { interval } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
@Injectable({
  providedIn: 'root'
})
export class SwupdateService {
  private platformId = inject(PLATFORM_ID);

  constructor(public updates: SwUpdate, public snackBar: MatSnackBar) {
    // If updates are enabled
    if (updates.isEnabled) {
      // poll the service worker to check for updates
      interval(6 * 60 * 60).subscribe(() => updates.checkForUpdate());
    }
  }
  // Called from app.components.ts constructor
  public checkForUpdates() {
    if (this.updates.isEnabled) {
      this.updates.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') {
          console.log('current version is', event.currentVersion);
          console.log('available version is', event.latestVersion);
          this.promptUser(event);
        }
      });
    }
  }

  // If there is an update, promt the user
  private promptUser(e: VersionEvent): void {
    if (e.type === 'VERSION_READY') {
      const snackBarRef = this.snackBar.open(
        'A new version of app is available',
        'Update',
        { horizontalPosition: 'left' }
      );
      snackBarRef.onAction().subscribe(() => {
        if (isPlatformBrowser(this.platformId)) {
          document.location.reload();
        }
      });
    }
  }
}
