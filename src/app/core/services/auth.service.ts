import { Injectable, inject, signal, computed } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap, map, catchError, of } from "rxjs";
import { Router } from "@angular/router";
import { environment } from "src/environments/environment";

// Define interfaces for payload responses
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authUrl = `${environment.payload_url}/api/users`;
  /**
   * State Management with Signals
   * undefined = Loading / Initial Check In Progress
   * null = Not Logged In
   * User = Logged In
   */
  private userSignal = signal<User | null | undefined>(undefined);

  // Read-only public signals for components to use
  public readonly user = this.userSignal.asReadonly();
  public readonly isLoading = computed(() => this.userSignal() === undefined);
  public readonly isAuthenticated = computed(() => !!this.userSignal());

  // Temporary state to hold email between steps (Enter Email -> Login/Signup)
  public readonly authEmail = signal<string>("");

  constructor() {
    // Start the session check immediately on app load
    this.checkSession().subscribe();
  }

  /**
   * Helper for AuthGuard to wait for the initial session check to complete.
   * If state is already known, returns immediately.
   * If loading, waits for the API call to finish.
   */
  waitForAuth(): Observable<boolean> {
    if (this.userSignal() !== undefined) {
      return of(!!this.userSignal());
    }
    return this.checkSession().pipe(map((user) => !!user));
  }

  /**
   * Checks if an email exists in the system.
   */
  checkEmail(email: string): Observable<boolean> {
    return this.http
      .get<{ exists: boolean }>(`${this.authUrl}/check-email`, {
        params: { email },
      })
      .pipe(
        map((res) => res.exists),
        catchError(() => of(false)), // Default to false on error to be safe, or handle error explicitly
      );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.authUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.authUrl}/reset-password`, {
      token,
      password,
    });
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.post(`${this.authUrl}/verify/${token}`, {});
  }

  /**
   * Fetches the current user from the backend.
   */
  checkSession(): Observable<User | null> {
    return this.http
      .get<{ user: User }>(`${this.authUrl}/me`, { withCredentials: true })
      .pipe(
        map((res) => res.user),
        catchError(() => of(null)),
        tap((user) => this.userSignal.set(user)), // Update state
      );
  }

  login(credentials: { email: string; password: string }): Observable<User> {
    return this.http
      .post<{
        user: User;
        message: string;
      }>(`${this.authUrl}/login`, credentials, { withCredentials: true })
      .pipe(
        map((res) => res.user),
        tap((user) => this.userSignal.set(user)),
      );
  }

  register(userData: any): Observable<User> {
    return this.http
      .post<{
        user: User;
        message: string;
      }>(`${this.authUrl}`, userData, { withCredentials: true })
      .pipe(
        map((res) => res.user),
        tap((user) => {
          // If Payload is config to auto-login on create, we update state.
          // Otherwise, you might want to redirect to login.
          if (user) this.userSignal.set(user);
        }),
      );
  }

  logout(): void {
    this.http
      .post(`${this.authUrl}/logout`, {}, { withCredentials: true })
      .subscribe(() => {
        this.userSignal.set(null);
        this.router.navigate(["/home"]);
      });
  }
}
