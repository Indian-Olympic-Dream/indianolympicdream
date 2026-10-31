import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { SportsdataService } from './sportsdata.service';
import { PayloadService } from './services/payload.service';

describe('SportsdataService', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: PayloadService, useValue: {} },
    ],
  }));

  it('should be created', () => {
    const service: SportsdataService = TestBed.inject(SportsdataService);
    expect(service).toBeTruthy();
  });
});
