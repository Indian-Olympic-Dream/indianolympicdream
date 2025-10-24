import { Component, inject, ViewEncapsulation } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './login-dialog.component.html',
  styleUrl: './login-dialog.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class LoginDialogComponent {
  private dialogRef = inject(MatDialogRef<LoginDialogComponent>);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  hidePassword = true;

  onCancel(): void {
    this.dialogRef.close();
  }

  onLogin(): void {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      if (email && password) {
        this.authService.login({ email, password }).subscribe({
          next: () => {
            this.router.navigate(['/sub-home']);
            this.dialogRef.close(true);
          },
          error: (err) => {
            console.error('Login error:', err);
            this.snackBar.open('Login failed. Please check your credentials.', 'Close', {
              duration: 3000,
              panelClass: ['snackbar-error']
            });
          }
        });
      }
    }
  }

  loginWithGoogle(): void {
    // Implement Google login
  }

  loginWithTwitter(): void {
    // Implement Twitter login
  }

  loginWithReddit(): void {
    // Implement Reddit login
  }
}
