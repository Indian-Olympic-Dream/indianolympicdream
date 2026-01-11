import { Component, inject, ViewEncapsulation, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";

@Component({
  selector: "app-reset-password",
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
    <div class="step-container" *ngIf="!successState; else successTemplate">
      <h1 class="title">Set new password</h1>
      <p class="subtitle">
        Your new password must be different to previously used passwords.
      </p>

      <form [formGroup]="resetForm" (ngSubmit)="onSubmit()">
        <div class="custom-input-group">
          <input
            [type]="hidePassword ? 'password' : 'text'"
            formControlName="password"
            placeholder="New Password"
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

        <div class="custom-input-group">
          <input
            [type]="hideConfirmPassword ? 'password' : 'text'"
            formControlName="confirmPassword"
            placeholder="Confirm Password"
            class="custom-input"
          />
          <button
            type="button"
            class="visibility-toggle"
            (click)="hideConfirmPassword = !hideConfirmPassword"
          >
            <mat-icon>{{
              hideConfirmPassword ? "visibility_off" : "visibility"
            }}</mat-icon>
          </button>
        </div>

        <div
          class="error-msg"
          *ngIf="
            resetForm.errors?.['mismatch'] &&
            (resetForm.touched || resetForm.dirty)
          "
          style="color: #ff5252; font-size: 12px; margin: -12px 0 16px 16px;"
        >
          Passwords do not match
        </div>

        <button
          mat-flat-button
          class="submit-btn"
          type="submit"
          [disabled]="loading || resetForm.invalid"
        >
          <span *ngIf="!loading">Reset Password</span>
          <mat-spinner
            *ngIf="loading"
            diameter="24"
            color="accent"
          ></mat-spinner>
        </button>
      </form>

      <div class="footer-login" style="margin-top: 24px;">
        <a routerLink="/auth/login" class="back-link">Back to Login</a>
      </div>
    </div>

    <ng-template #successTemplate>
      <div class="step-container" style="text-align: center;">
        <div
          style="
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: rgba(76, 175, 80, 0.1);
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 24px auto;"
        >
          <mat-icon
            style="color: #4CAF50; font-size: 40px; width: 40px; height: 40px;"
            >check_circle</mat-icon
          >
        </div>
        <h1 class="title">Password Reset</h1>
        <p class="subtitle">
          Your password has been successfully reset. <br />Click below to log in
          properly.
        </p>

        <button mat-flat-button class="submit-btn" routerLink="/auth/login">
          Log In
        </button>
      </div>
    </ng-template>
  `,
  styleUrls: ["../auth-shared.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  resetForm = this.fb.group(
    {
      password: ["", [Validators.required, Validators.minLength(8)]],
      confirmPassword: ["", [Validators.required]],
    },
    { validators: this.passwordMatchValidator },
  );

  loading = false;
  successState = false;
  hidePassword = true;
  hideConfirmPassword = true;
  token: string | null = null;

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get("token");
    if (!this.token) {
      // Should probably redirect or show error, but for now we just warn
      this.snackBar.open("Invalid or missing reset token.", "Close", {
        duration: 5000,
        panelClass: ["snackbar-error"],
      });
    }
  }

  passwordMatchValidator(g: any) {
    return g.get("password").value === g.get("confirmPassword").value
      ? null
      : { mismatch: true };
  }

  onSubmit() {
    if (this.resetForm.valid && this.token) {
      this.loading = true;
      const password = this.resetForm.value.password!;

      this.authService.resetPassword(this.token, password).subscribe({
        next: () => {
          this.loading = false;
          this.successState = true;
        },
        error: (err) => {
          this.loading = false;
          console.error(err);
          this.snackBar.open(
            "Failed to reset password. Link may be expired.",
            "Close",
            {
              duration: 5000,
              panelClass: ["snackbar-error"],
            },
          );
        },
      });
    }
  }
}
