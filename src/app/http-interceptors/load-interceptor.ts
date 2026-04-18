import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse, HttpSentEvent, HttpHeaderResponse, HttpProgressEvent, HttpResponse, HttpUserEvent } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoaderService } from '../shared/components/loader/loader.service';
@Injectable()
export class LoadInterceptor implements HttpInterceptor {
  private router = inject(Router);
  constructor(
    private loaderService: LoaderService,
  ) { }
  intercept(req: HttpRequest<any>,
    next: HttpHandler): Observable<HttpSentEvent | HttpHeaderResponse | HttpProgressEvent | HttpResponse<any> | HttpUserEvent<any>> {
    this.showLoader();
    return next.handle(req).pipe(
      tap((event: HttpEvent<any>) => {
        if (event instanceof HttpResponse) {
          this.onEnd();
        }
      }),
      catchError((error) => {
        this.onEnd();
        if (error instanceof HttpErrorResponse) {
          console.error('HTTP request failed', {
            url: req.urlWithParams,
            method: req.method,
            status: error.status,
            statusText: error.statusText,
            message: error.message,
          });
          // 502: Bad Gateway, 503: Service Unavailable, 504: Gateway Timeout
          if (error.status === 502 || error.status === 503 || error.status === 504 || error.status === 0) {
            this.router.navigate(['internal-error']);
          }
        }
        return throwError(() => error);
      }),
    );
  }
  private onEnd(): void {
    this.hideLoader();
  }
  private showLoader(): void {
    this.loaderService.show();
  }
  private hideLoader(): void {
    this.loaderService.hide();
  }
}
