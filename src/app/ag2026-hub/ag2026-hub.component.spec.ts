import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ag2026HubComponent } from './ag2026-hub.component';

describe('Ag2026HubComponent', () => {
  let component: Ag2026HubComponent;
  let fixture: ComponentFixture<Ag2026HubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ag2026HubComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Ag2026HubComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
