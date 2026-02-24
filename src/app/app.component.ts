import { Component, HostBinding } from "@angular/core";
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
import { LayoutModule } from "@angular/cdk/layout";
import { ScrollTrackingService } from "./shared/services/scroll-tracking.service";
import { BottomNavComponent } from "./bottom-nav/bottom-nav.component";
import { FooterComponent } from "./footer/footer.component";
import { AuthService } from "./core/services/auth.service";

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
    FooterComponent,
  ],
})
export class AppComponent {
  public isOlympicsMenuOpen = false;
  public loading: boolean = false;
  isLightTheme = false;
  @HostBinding("class") componentCssClass;
  selectedtheme: string;
  currentTheme = "dark-theme";
  currentSport: string = "";

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private swupdateservice: SwupdateService,
    public overlayContainer: OverlayContainer,
    private loaderService: LoaderService,
    private scrollTrackingService: ScrollTrackingService,
    public authService: AuthService,
  ) {
    this.loaderService.loaderState.subscribe((state) => {
      this.loading = state.show;
    });
    this.loadThemePreference();
    this.swupdateservice.checkForUpdates();
    this.router.events.subscribe((event: RouterEvent) => {
      this.navigationInterceptor(event);
    });

  }

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

    return url === "/" || url === "/home";
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

  prepareRoute(outlet: RouterOutlet) {
    return outlet && outlet.activatedRouteData;
  }

  logout() {
    this.authService.logout();
  }
}
