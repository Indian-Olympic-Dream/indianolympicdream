import { TestBed } from '@angular/core/testing';
import { Apollo } from 'apollo-angular';

import { OriginalsService } from './originals.service';

describe('OriginalsService', () => {
  let service: OriginalsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: Apollo, useValue: {} }],
    });
    service = TestBed.inject(OriginalsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
