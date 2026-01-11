import { Component, inject, ViewEncapsulation } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { RouterModule } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";

@Component({
  selector: "app-forgot-password",
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
      <h1 class="title">Reset Password</h1>
      <p class="subtitle">
        Enter your email and we'll send you a link to reset your password.
      </p>

      <form [formGroup]="forgotForm" (ngSubmit)="onSubmit()">
        <div class="custom-input-group">
          <input
            type="email"
            formControlName="email"
            placeholder="Email Address"
            class="custom-input"
          />
        </div>

        <button
          mat-flat-button
          class="submit-btn"
          type="submit"
          [disabled]="loading || forgotForm.invalid"
        >
          <span *ngIf="!loading">Send Reset Link</span>
          <mat-spinner
            *ngIf="loading"
            diameter="24"
            color="accent"
          ></mat-spinner>
        </button>
      </form>

      <div class="footer-login" style="margin-top: 24px;">
        <a routerLink="/auth" class="back-link">Back to Login</a>
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

        <h1 class="title">Check your email</h1>
        <p class="subtitle">
          We've sent a password reset link to <br /><strong>{{
            forgotForm.value.email
          }}</strong>
        </p>

        <button mat-flat-button class="submit-btn" (click)="emailSent = false">
          Resend Email
        </button>

        <div class="footer-login" style="margin-top: 24px;">
          <a routerLink="/auth" class="back-link">Back to Login</a>
        </div>
      </div>
    </ng-template>
  `,
  styleUrls: ["../auth-shared.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  forgotForm = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
  });

  loading = false;
  emailSent = false;

  onSubmit() {
    if (this.forgotForm.valid) {
      this.loading = true;
      const email = this.forgotForm.value.email!;

      this.authService.forgotPassword(email).subscribe({
        next: () => {
          this.loading = false;
          this.emailSent = true;
        },
        error: (err) => {
          this.loading = false;
          console.error(err);
          // UX Decision: Don't reveal if email exists or not, but for now we show a generic message
          this.snackBar.open(
            "If an account exists, an email has been sent.",
            "Close",
            { duration: 3000 },
          );
          this.emailSent = true; // Show success anyway for security
        },
      });
    }
  }
}
