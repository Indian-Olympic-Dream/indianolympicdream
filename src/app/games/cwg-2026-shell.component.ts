import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { NavigationEnd, Router, RouterModule } from "@angular/router";
import { filter } from "rxjs";

@Component({
  selector: "app-cwg-2026-shell",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./cwg-2026-shell.component.html",
  styleUrl: "./cwg-2026-shell.component.scss",
})
export class Cwg2026ShellComponent {
  private readonly router = inject(Router);

  readonly isHomePage = signal(true);

  readonly navItems = [
    { label: "Overview", path: "/cwg-2026" },
    { label: "Schedule", path: "/cwg-2026/schedule" },
    { label: "Athletes", path: "/cwg-2026/athletes" },
  ];

  constructor() {
    this.updateRouteState(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateRouteState(e.urlAfterRedirects));
  }

  private updateRouteState(url: string): void {
    const cleanUrl = url.split("?")[0].split("#")[0];
    this.isHomePage.set(cleanUrl === "/cwg-2026" || cleanUrl === "/cwg-2026/");
  }
}
