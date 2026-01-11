import { Component, ViewEncapsulation } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";

@Component({
  selector: "app-auth-layout",
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-header">
          <button mat-icon-button class="back-button" routerLink="/home">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <span class="brand">IOD SPORTS</span>
          <div style="width: 40px;"></div>
          <!-- Spacer -->
        </div>

        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styleUrls: ["../auth-shared.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class AuthLayoutComponent {}
