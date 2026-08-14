import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterModule } from "@angular/router";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-bottom-nav",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatIconModule,
  ],
  templateUrl: "./bottom-nav.component.html",
  styleUrl: "./bottom-nav.component.scss",
})
export class BottomNavComponent {
  constructor(public router: Router) {}

  isCalendarActive(): boolean {
    const path = this.router.url.split(/[?#]/, 1)[0];
    return path === "/calendar" || path.startsWith("/calendar/");
  }

  isHomeActive(): boolean {
    return this.router.url.split(/[?#]/, 1)[0] === "/";
  }
}
