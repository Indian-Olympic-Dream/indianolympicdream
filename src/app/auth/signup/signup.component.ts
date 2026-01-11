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
  selector: "app-signup",
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
    <div class="step-container" *ngIf="!emailSent; else sentState">
      <h1 class="title">Create Account</h1>
      <p class="subtitle">
        Get access to live scores, schedules, news and much more.
      </p>

      <div class="user-chip">
        <span class="email-text">{{ email }}</span>
        <button matIconButton class="edit-btn" (click)="goBack()">
          <mat-icon>edit</mat-icon>
        </button>
      </div>

      <form [formGroup]="signupForm" (ngSubmit)="onSignup()">
        <div class="name-row" style="display: flex; gap: 16px;">
          <div class="custom-input-group">
            <input
              type="text"
              formControlName="firstName"
              placeholder="First Name"
              class="custom-input"
            />
          </div>
          <div class="custom-input-group">
            <input
              type="text"
              formControlName="lastName"
              placeholder="Last Name"
              class="custom-input"
            />
          </div>
        </div>

        <!-- Hidden email field for accessibility/autocomplete -->
        <input type="hidden" formControlName="email" />

        <div class="custom-input-group">
          <input
            [type]="hidePassword ? 'password' : 'text'"
            formControlName="password"
            placeholder="Create Password"
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

        <button
          mat-flat-button
          class="submit-btn"
          type="submit"
          [disabled]="loading || signupForm.invalid"
        >
          <span *ngIf="!loading">Sign Up</span>
          <mat-spinner
            *ngIf="loading"
            diameter="24"
            color="accent"
          ></mat-spinner>
        </button>
      </form>

      <div class="legal-text">
        By signing up, you agree to our <a href="#">Terms of Service</a> and
        <a href="#">Privacy Policy</a>.
      </div>
    </div>

    <ng-template #sentState>
      <div class="step-container" style="text-align: center;">
        <div
          style="
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(252, 213, 53, 0.1);
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 0 auto 24px auto;"
        >
          <mat-icon
            style="color: #FCD535; font-size: 40px; width: 40px; height: 40px;"
            >mark_email_read</mat-icon
          >
        </div>

        <h1 class="title">Verify your email</h1>
        <p class="subtitle">
          We've sent a verification link to <br /><strong>{{
            signupForm.value.email
          }}</strong>
        </p>

        <p class="subtitle" style="font-size: 13px; margin-top: -20px;">
          Please check your inbox and click the link to verify your account
          before logging in.
        </p>

        <div class="footer-login" style="margin-top: 24px;">
          <a routerLink="/auth/login" class="back-link">Proceed to Login</a>
        </div>
      </div>
    </ng-template>
  `,
  styleUrls: ["../auth-shared.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class SignupComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  email = "";
  loading = false;
  hidePassword = true;

  signupForm = this.fb.group({
    firstName: ["", [Validators.required]],
    lastName: ["", [Validators.required]],
    email: ["", [Validators.required]],
    password: ["", [Validators.required, Validators.minLength(8)]],
  });

  emailSent = false;

  ngOnInit() {
    this.email = this.authService.authEmail();
    if (!this.email) {
      this.router.navigate(["/auth"]);
    } else {
      this.signupForm.patchValue({ email: this.email });
    }
  }

  goBack() {
    this.router.navigate(["/auth"]);
  }

  onSignup() {
    if (this.signupForm.valid) {
      this.loading = true;
      const { firstName, lastName, email, password } = this.signupForm.value;

      this.authService
        .register({
          email,
          password,
          firstName,
          lastName,
        })
        .subscribe({
          next: () => {
            this.loading = false;
            // Show email sent state instead of redirecting
            this.emailSent = true;
          },
          error: (err) => {
            this.loading = false;
            console.error(err);
            this.snackBar.open(
              "Registration failed. Please try again.",
              "Close",
              {
                duration: 3000,
                panelClass: ["snackbar-error"],
              },
            );
          },
        });
    }
  }
}
