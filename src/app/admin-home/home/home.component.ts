import { Component } from '@angular/core';
import { AuthService } from 'src/app/core/services/auth.service';
@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  constructor(private authService: AuthService) {
    this.getProtectedData();
  }

  getProtectedData() {
    this.authService.protected().subscribe({
      next: (data) => {
        console.log('Protected data:', data);
      },
      error: (err) => {
        console.error('Error fetching protected data:', err);
      }
    });
  }
}
