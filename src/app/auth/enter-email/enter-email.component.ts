import { Component, inject, ViewEncapsulation } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { Router } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";

@Component({
  selector: "app-enter-email",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="step-container">
      <h1 class="title">Welcome</h1>
      <p class="subtitle">Enter your email to continue to IOD Sports.</p>

      <form [formGroup]="emailForm" (ngSubmit)="onSubmit()">
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
          [disabled]="loading || emailForm.invalid"
        >
          <span *ngIf="!loading">Continue</span>
          <mat-spinner
            *ngIf="loading"
            diameter="24"
            color="accent"
          ></mat-spinner>
        </button>
      </form>

      <div class="divider">
        <span class="line"></span>
        <span class="text">or continue with</span>
        <span class="line"></span>
      </div>

      <div class="social-buttons">
        <button
          mat-icon-button
          class="social-btn"
          (click)="socialLogin('google')"
        >
          <img src="assets/images/oauth/google.svg" alt="Google" />
        </button>
        <button
          mat-icon-button
          class="social-btn"
          (click)="socialLogin('twitter')"
        >
          <img src="assets/images/oauth/x.svg" alt="X" />
        </button>
        <button
          mat-icon-button
          class="social-btn"
          (click)="socialLogin('reddit')"
        >
          <img src="assets/images/oauth/reddit.svg" alt="Reddit" />
        </button>
      </div>

      <div class="legal-text">
        By continuing, you agree to our <a href="#">Terms of Service</a> and
        <a href="#">Privacy Policy</a>.
      </div>
    </div>
  `,
  styleUrls: ["../auth-shared.scss"], // Use shared styles
  encapsulation: ViewEncapsulation.None,
})
export class EnterEmailComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  emailForm = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
  });

  loading = false;

  onSubmit() {
    if (this.emailForm.valid) {
      this.loading = true;
      const email = this.emailForm.value.email!;

      this.authService.checkEmail(email).subscribe({
        next: (exists) => {
          this.loading = false;
          this.authService.authEmail.set(email); // Save email to state

          if (exists) {
            this.router.navigate(["/auth/login"]);
          } else {
            this.router.navigate(["/auth/signup"]);
          }
        },
        error: (err) => {
          this.loading = false;
          console.error(err);
          this.snackBar.open(
            "Something went wrong. Please try again.",
            "Close",
            { duration: 3000 },
          );
        },
      });
    }
  }

  socialLogin(provider: string) {
    console.log(`Login with ${provider}`);
    // TODO: Implement Social Auth
  }
}
