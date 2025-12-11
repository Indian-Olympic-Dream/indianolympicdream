import { Component, HostBinding, OnInit } from "@angular/core";
import { SwupdateService } from "./swupdate.service";
import { OverlayContainer } from "@angular/cdk/overlay";
import {
  Router,
  Event as RouterEvent,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  RouterOutlet,
  ActivatedRoute,
  RouterLink,
  RouterLinkActive,
} from "@angular/router";
import { slideInAnimation } from "./animations";
import { CommonModule } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";
import { MatMenuModule } from "@angular/material/menu";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { LoaderService } from "./shared/components/loader/loader.service";
import { BreakpointObserver } from "@angular/cdk/layout";
import { LayoutModule } from "@angular/cdk/layout";
import { ScrollTrackingService } from "./shared/services/scroll-tracking.service";
import { BottomNavComponent } from "./bottom-nav/bottom-nav.component";

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  animations: [slideInAnimation],
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatSidenavModule,
    MatListModule,
    MatProgressSpinnerModule,
    LayoutModule,
    BottomNavComponent,
  ],
})
export class AppComponent implements OnInit {
  public isOlympicsMenuOpen = false;
  public loading: boolean = false;
  public isLightTheme = false;
  @HostBinding("class") componentCssClass;
  selectedtheme: string;
  currentTheme = "dark-theme";
  currentSport: string = "";
  logoTextTop = "Indian";
  logoTextBottom = "Dream";
  olympicOptions = [
    {
      id: "2020",
      name: "Tokyo 2020",
      logo: "assets/images/olympics/tokyo2020_no_bg.png",
    },
    { id: "2028", name: "LA 2028", logo: "assets/images/olympics/la2028.png" },
  ];

  selectedOlympics = this.olympicOptions[1].id;
  selectedOlympicsLogo: string = this.olympicOptions[1].logo;

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private swupdateservice: SwupdateService,
    public overlayContainer: OverlayContainer,
    private loaderService: LoaderService,
    private breakpointObserver: BreakpointObserver,
    private scrollTrackingService: ScrollTrackingService,
  ) {
    this.loaderService.loaderState.subscribe((state) => {
      this.loading = state.show;
    });
    this.loadThemePreference();
    this.swupdateservice.checkForUpdates();
    this.router.events.subscribe((event: RouterEvent) => {
      this.navigationInterceptor(event);
    });

    this.route.queryParams.subscribe((params) => {
      this.selectedOlympics = params["edition"] || "2028";
      this.updateSelectedOlympicsLogo();
    });

    this.breakpointObserver
      .observe(["(max-width: 399px)"])
      .subscribe((result) => {
        if (result.matches) {
          this.logoTextTop = "I";
          this.logoTextBottom = "D";
        } else {
          this.logoTextTop = "Indian";
          this.logoTextBottom = "Dream";
        }
      });
  }

  ngOnInit() {}

  onContentScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    // If there's no scrollable distance, progress is 0
    if (scrollHeight <= clientHeight) {
      this.scrollTrackingService.updateProgress(0);
      return;
    }

    const scrollPercent = (scrollTop / (scrollHeight - clientHeight)) * 100;
    this.scrollTrackingService.updateProgress(scrollPercent);
  }

  navigationInterceptor(event: RouterEvent): void {
    if (event instanceof NavigationStart) {
      this.loading = true;
    }
    if (event instanceof NavigationEnd) {
      this.loading = false;
      const childRoute = this.route.firstChild;
      const sportname = childRoute?.snapshot.paramMap.get("sportname");
      this.currentSport = sportname || "";
    }
    if (event instanceof NavigationCancel) {
      this.loading = false;
    }
    if (event instanceof NavigationError) {
      this.loading = false;
    }
  }

  isActivePath(): boolean {
    const url = this.router.url;
    return url.startsWith("/sports/") || url === "/" || url === "/home";
  }

  isScheduleActive(): boolean {
    return this.router.url.startsWith("/schedule");
  }

  isStoriesActive(): boolean {
    return this.router.url.startsWith("/stories");
  }

  loadThemePreference() {
    const savedTheme = localStorage.getItem("selectedTheme");
    this.currentTheme = savedTheme || "dark-theme";

    if (this.componentCssClass) {
      this.overlayContainer
        .getContainerElement()
        .classList.remove(this.componentCssClass);
    }
    this.overlayContainer
      .getContainerElement()
      .classList.add(this.currentTheme);
    this.componentCssClass = this.currentTheme;
    this.updateThemeColorMetaTag();
  }

  onSetTheme() {
    this.currentTheme =
      this.currentTheme === "default-theme" ? "dark-theme" : "default-theme";
    localStorage.setItem("selectedTheme", this.currentTheme);

    if (this.componentCssClass) {
      this.overlayContainer
        .getContainerElement()
        .classList.remove(this.componentCssClass);
    }
    this.overlayContainer
      .getContainerElement()
      .classList.add(this.currentTheme);
    this.componentCssClass = this.currentTheme;
    this.updateThemeColorMetaTag();
  }

  private updateThemeColorMetaTag() {
    const themeColorMetaTag = document.querySelector(
      'meta[name="theme-color"]',
    );
    if (themeColorMetaTag) {
      if (this.currentTheme === "dark-theme") {
        themeColorMetaTag.setAttribute("content", "#212121"); // Dark theme color
      } else {
        themeColorMetaTag.setAttribute("content", "#F5F5F5"); // Light theme color
      }
    }
  }

  onOlympicsChange(selection: string) {
    this.selectedOlympics = selection;
    this.updateSelectedOlympicsLogo();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edition: selection },
      queryParamsHandling: "merge",
    });
  }
  private updateSelectedOlympicsLogo(): void {
    const selected = this.olympicOptions.find(
      (option) => option.id === this.selectedOlympics,
    );
    this.selectedOlympicsLogo = selected
      ? selected.logo
      : this.olympicOptions[0].logo;
  }
  prepareRoute(outlet: RouterOutlet) {
    return outlet && outlet.activatedRouteData;
  }
}
