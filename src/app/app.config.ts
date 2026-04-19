import { ApplicationConfig, ErrorHandler, importProvidersFrom, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideClientHydration } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { routes } from './app.routes';
import { AppErrorHandler } from './app-error-handler';
import { httpInterceptorProviders } from './http-interceptors/index';
import { graphqlProvider } from './graphql.provider';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(routes),
        provideHttpClient(withFetch()),
        provideAnimations(),
        provideClientHydration(),
        provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000',
        }),
        importProvidersFrom(FormsModule, ReactiveFormsModule),
        { provide: ErrorHandler, useClass: AppErrorHandler },
        httpInterceptorProviders,
        graphqlProvider,
    ],
};
