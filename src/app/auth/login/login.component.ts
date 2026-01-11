import { Component, inject, ViewEncapsulation, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { Router, RouterModule } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterModule,
  ],
  template: `
    <div class="step-container">
      <h1 class="title">Welcome Back</h1>
      <p class="subtitle">Enter your password to log in.</p>

      <div class="user-chip">
        <span class="email-text">{{ email }}</span>
        <button matIconButton class="edit-btn" (click)="goBack()">
          <mat-icon>edit</mat-icon>
        </button>
      </div>

      <form [formGroup]="loginForm" (ngSubmit)="onLogin()">
        <div class="custom-input-group">
          <input
            [type]="hidePassword ? 'password' : 'text'"
            formControlName="password"
            placeholder="Password"
            class="custom-input"
          />
          <button
            type="button"
            class="visibility-toggle"
            (click)="hidePassword = !hidePassword"
          >
            <mat-icon>{{
              hidePassword ? "visibility_off" : "visibility"
            }}</mat-icon>
          </button>
        </div>

        <div
          class="forgot-link-container"
          style="text-align: right; margin-top: 8px;"
        >
          <a
            routerLink="/auth/forgot-password"
            class="forgot-link"
            style="color: #FCD535; font-size: 13px; text-decoration: none;"
            >Forgot Password?</a
          >
        </div>

        <button
          mat-flat-button
          class="submit-btn"
          type="submit"
          [disabled]="loading || loginForm.invalid"
        >
          <span *ngIf="!loading">Log In</span>
          <mat-spinner
            *ngIf="loading"
            diameter="24"
            color="accent"
          ></mat-spinner>
        </button>
      </form>
    </div>
  `,
  styleUrls: ["../auth-shared.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  email = "";
  loading = false;
  hidePassword = true;

  loginForm = this.fb.group({
    password: ["", [Validators.required]],
  });

  ngOnInit() {
    this.email = this.authService.authEmail();
    if (!this.email) {
      this.router.navigate(["/auth"]);
    }
  }

  goBack() {
    this.router.navigate(["/auth"]);
  }

  onLogin() {
    if (this.loginForm.valid) {
      this.loading = true;
      const password = this.loginForm.value.password!;

      this.authService.login({ email: this.email, password }).subscribe({
        next: () => {
          this.loading = false;
          this.router.navigate(["/sub-home"]);
        },
        error: (err) => {
          this.loading = false;
          console.error(err);
          let errorMsg = "Invalid password. Please try again.";

          if (
            err.status === 403 ||
            (err.error &&
              err.error.message &&
              err.error.message.includes("verify"))
          ) {
            errorMsg = "Please verify your email address before logging in.";
          }

          this.snackBar.open(errorMsg, "Close", {
            duration: 5000,
            panelClass: ["snackbar-error"],
          });
        },
      });
    }
  }
}
