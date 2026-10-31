import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AthletesComponent } from './athletes.component';
import { PayloadService } from '../services/payload.service';

describe('AthletesComponent', () => {
  let component: AthletesComponent;
  let fixture: ComponentFixture<AthletesComponent>;

  const emptyRetiredFeed = {
    docs: [],
    totalDocs: 0,
    totalPages: 0,
    page: 1,
    hasNextPage: false,
    totalRetired: 0,
    facets: {
      categories: { team: 0, individual: 0, medalists: 0 },
      sportsByCategory: { team: [], individual: [], medalists: [] },
    },
  };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [AthletesComponent],
      providers: [
        provideRouter([]),
        {
          provide: PayloadService,
          useValue: {
            FALLBACK_SPORT_PICTOGRAM: 'assets/images/placeholder.svg',
            getContenderUnits: () => of({ docs: [], totalDocs: 0 }),
            getRetiredAthletesFeed: () => of(emptyRetiredFeed),
            getSports: () => of([]),
            getSportPictogramUrl: () => null,
            getMediaUrl: () => null,
          },
        },
      ],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AthletesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
