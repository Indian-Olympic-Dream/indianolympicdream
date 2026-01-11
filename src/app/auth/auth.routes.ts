import { Routes } from "@angular/router";
import { AuthLayoutComponent } from "./auth-layout/auth-layout.component";
import { EnterEmailComponent } from "./enter-email/enter-email.component";
import { LoginComponent } from "./login/login.component";
import { SignupComponent } from "./signup/signup.component";
import { ForgotPasswordComponent } from "./forgot-password/forgot-password.component";
import { ResetPasswordComponent } from "./reset-password/reset-password.component";
import { VerifyEmailComponent } from "./verify-email/verify-email.component";

export const AUTH_ROUTES: Routes = [
  {
    path: "",
    component: AuthLayoutComponent,
    children: [
      { path: "", component: EnterEmailComponent },
      { path: "login", component: LoginComponent },
      { path: "signup", component: SignupComponent },
      { path: "forgot-password", component: ForgotPasswordComponent },
      { path: "reset-password", component: ResetPasswordComponent },
      { path: "verify-email", component: VerifyEmailComponent },
      { path: "**", redirectTo: "" },
    ],
  },
];
