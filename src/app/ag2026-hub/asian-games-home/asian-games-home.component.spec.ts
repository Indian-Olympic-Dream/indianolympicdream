import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsianGamesHomeComponent } from './asian-games-home.component';

describe('AsianGamesHomeComponent', () => {
  let component: AsianGamesHomeComponent;
  let fixture: ComponentFixture<AsianGamesHomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsianGamesHomeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AsianGamesHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
