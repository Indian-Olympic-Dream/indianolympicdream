import { Component, inject, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterModule
  ],
  template: `
    <div class="step-container centered-text">
      <!-- Loading State -->
      <ng-container *ngIf="loading">
        <mat-spinner diameter="40" color="accent" style="margin: 0 auto 24px auto;"></mat-spinner>
        <h1 class="title">Verifying...</h1>
        <p class="subtitle">Please wait while we verify your email address.</p>
      </ng-container>

      <!-- Success State -->
      <ng-container *ngIf="!loading && success">
        <div class="icon-circle success">
          <mat-icon>verified_user</mat-icon>
        </div>
        <h1 class="title">Email Verified!</h1>
        <p class="subtitle">Your account has been successfully verified.<br>You can now log in.</p>

        <button mat-flat-button class="submit-btn" routerLink="/auth/login">
          Log In
        </button>
      </ng-container>

      <!-- Error State -->
      <ng-container *ngIf="!loading && !success">
        <div class="icon-circle error">
          <mat-icon>error_outline</mat-icon>
        </div>
        <h1 class="title">Verification Failed</h1>
        <p class="subtitle">The verification link is invalid or has expired.</p>

        <button mat-flat-button class="submit-btn" routerLink="/auth/signup">
          Back to Signup
        </button>
      </ng-container>
    </div>
  `,
  styleUrls: ['../auth-shared.scss'],
  styles: [`
    .centered-text {
      text-align: center;
      align-items: center;
    }
    .icon-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(252, 213, 53, 0.1);
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 auto 24px auto;

      &.success {
        background: rgba(76, 175, 80, 0.1);
        mat-icon { color: #4CAF50; }
      }

      &.error {
        background: rgba(244, 67, 54, 0.1);
        mat-icon { color: #f44336; }
      }

      mat-icon {
        color: #FCD535;
        font-size: 40px;
        width: 40px;
        height: 40px;
      }
    }
  `],
  encapsulation: ViewEncapsulation.None
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  loading = true;
  success = false;

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading = false;
      this.success = false;
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
      },
      error: (err) => {
        this.loading = false;
        this.success = false;
        console.error(err);
      }
    });
  }
}
