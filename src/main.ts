
import { enableProdMode, importProvidersFrom } from '@angular/core';
import { environment } from './environments/environment';
import { httpInterceptorProviders } from './app/http-interceptors/index';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { routes } from './app/app.routes'; // Updated import path for routes
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import { AppComponent } from './app/app.component';
import { jwtInterceptor as JwtInterceptor } from './app/core/interceptors/jwt.interceptor';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserModule),
    importProvidersFrom(FormsModule, ReactiveFormsModule),
    importProvidersFrom(ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production, registrationStrategy: 'registerWhenStable:30000' })),
    provideRouter(routes),
    httpInterceptorProviders,
    provideHttpClient(withInterceptors([JwtInterceptor])),
    provideAnimations()
  ]
})
  .catch(err => console.error(err));
