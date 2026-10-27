import { signal } from '@angular/core';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { SportsDetailService } from './shared/sports-detail/sports-detail.service';
import { SwupdateService } from './swupdate.service';

describe('AppComponent', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [
        RouterTestingModule,
        AppComponent
    ],
    providers: [
      { provide: SwupdateService, useValue: { checkForUpdates: jasmine.createSpy('checkForUpdates') } },
      {
        provide: SportsDetailService,
        useValue: {
          detail: signal(null),
          isOpen: signal(false),
          returnToResults: signal(false),
          close: jasmine.createSpy('close'),
        },
      },
    ],
}).compileComponents();
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  });

  it('recognises shop routes', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    spyOnProperty(app.router, 'url', 'get').and.returnValue('/shop/the-golden-shot-tee');
    expect(app.isShopRoute()).toBeTrue();
  });
});
