import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Router } from '@angular/router';

// Define interfaces for payload responses
interface User {
  id: string;
  name: string;
  email: string;
}

interface LoginResponse {
  user: User;
  token: string;
  exp: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private apiService: ApiService, private router: Router) {
    const token = this.getToken();
    if (token) {
      // Here you might want to fetch the user profile with /me endpoint
    }
  }

  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.apiService.post<LoginResponse>('/api/auth/login', credentials).pipe(
      tap(response => {
        this.setSession(response);
      })
    );
  }

  register(userData: object): Observable<any> {
    return this.apiService.post('/api/auth/register', userData);
  }

  protected(): Observable<any> {
    return this.apiService.get('/api/auth/protected');
  }

  logout() {
    this.clearSession();
  }

  private setSession(authResult: LoginResponse) {
    localStorage.setItem('jwt_token', authResult.token);
    this.currentUserSubject.next(authResult.user);
  }

  private clearSession() {
    localStorage.removeItem('jwt_token');
    this.currentUserSubject.next(null);
    this.router.navigate(['home']);
  }

  public getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  public isAuthenticated(): boolean {
    return !!this.getToken();
  }
}