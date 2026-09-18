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
    expect(labels[1]).toBe('Asian Games');
    expect(labels[2]).toBe('Calendar');
    expect(labels.length).toBe(6);
  });

  it('places Asian Games immediately after Sports, with the official logo', () => {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));
    const sportsIndex = links.findIndex(link => link.textContent?.trim() === 'Sports');
    expect(sportsIndex).toBe(0);
    expect(links[sportsIndex + 1].textContent?.trim()).toBe('Asian Games');
    expect(links[sportsIndex + 1].getAttribute('href')).toBe('/games/asian-games-2026');
    expect(links[sportsIndex + 1].querySelector('img')?.getAttribute('src')).toBe('assets/images/ag-2026/logo.webp');
  });
});
