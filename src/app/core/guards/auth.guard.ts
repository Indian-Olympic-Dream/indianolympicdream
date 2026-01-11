import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";
import { map } from "rxjs/operators";

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. If we are still loading, wait for the API
  if (authService.isLoading()) {
    return authService
      .waitForAuth()
      .pipe(
        map(
          (isAuthenticated) =>
            isAuthenticated || router.createUrlTree(["/home"]),
        ),
      );
  }

  // 2. If loaded, check immediately
  if (authService.isAuthenticated()) {
    return true;
  }

  // 3. Not authenticated
  return router.createUrlTree(["/home"]);
};
