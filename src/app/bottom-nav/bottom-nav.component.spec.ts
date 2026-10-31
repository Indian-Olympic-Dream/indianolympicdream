import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BottomNavComponent } from './bottom-nav.component';

describe('BottomNavComponent', () => {
  let component: BottomNavComponent;
  let fixture: ComponentFixture<BottomNavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomNavComponent], providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BottomNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses Sports as the first destination and includes 6 destinations', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-label'))
      .map(label => (label as HTMLElement).textContent?.trim());
    expect(labels[0]).toBe('Sports');
    expect(labels[1]).toBe('Calendar');
    expect(labels[2]).toBe('Athletes');
    expect(labels.length).toBe(6);
  });

  it('keeps Asian Games out of the primary nav and places Calendar after Sports', () => {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));
    const sportsIndex = links.findIndex(link => link.textContent?.trim() === 'Sports');
    expect(sportsIndex).toBe(0);
    expect(links.some(link => link.textContent?.trim() === 'Asian Games')).toBeFalse();
    expect(links[sportsIndex + 1].textContent?.trim()).toBe('Calendar');
    expect(links[sportsIndex + 1].getAttribute('href')).toBe('/calendar');
    expect(links[sportsIndex + 1].querySelector('img')?.getAttribute('src')).toBe('assets/icons/calendar.svg');
  });
});
