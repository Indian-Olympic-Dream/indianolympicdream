import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate } from '@angular/service-worker';
import { EMPTY } from 'rxjs';

import { SwupdateService } from './swupdate.service';

describe('SwupdateService', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [
      {
        provide: SwUpdate,
        useValue: {
          isEnabled: false,
          versionUpdates: EMPTY,
          checkForUpdate: jasmine.createSpy('checkForUpdate'),
        },
      },
      { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } },
    ],
  }));

  it('should be created', () => {
    const service: SwupdateService = TestBed.inject(SwupdateService);
    expect(service).toBeTruthy();
  });
});
