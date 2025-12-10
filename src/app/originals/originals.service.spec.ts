import { TestBed } from '@angular/core/testing';

import { OriginalsService } from './originals.service';

describe('OriginalsService', () => {
  let service: OriginalsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OriginalsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
