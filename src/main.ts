import { enableProdMode, importProvidersFrom } from "@angular/core";
import { environment } from "./environments/environment";
import { httpInterceptorProviders } from "./app/http-interceptors/index";
import { provideHttpClient } from "@angular/common/http";
import { BrowserModule, bootstrapApplication } from "@angular/platform-browser";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { routes } from "./app/app.routes";
import { provideRouter } from "@angular/router";
import { provideAnimations } from "@angular/platform-browser/animations";
import { ServiceWorkerModule } from "@angular/service-worker";
import { AppComponent } from "./app/app.component";
import { graphqlProvider } from "./app/graphql.provider";

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserModule),
    importProvidersFrom(FormsModule, ReactiveFormsModule),
    importProvidersFrom(
      ServiceWorkerModule.register("ngsw-worker.js", {
        enabled: environment.production,
        registrationStrategy: "registerWhenStable:30000",
      }),
    ),
    provideRouter(routes),
    httpInterceptorProviders,
    provideHttpClient(),
    provideAnimations(),
    graphqlProvider,
  ],
}).catch((err) => console.error(err));

