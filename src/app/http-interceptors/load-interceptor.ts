import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse, HttpSentEvent, HttpHeaderResponse, HttpProgressEvent, HttpResponse, HttpUserEvent } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoaderService } from '../shared/components/loader/loader.service';
@Injectable()
export class LoadInterceptor implements HttpInterceptor {
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
        }
        return throwError(() => error);
      }),
    );
  }
  private onEnd(): void {
    this.hideLoader();
  }
  private showLoader(): void {
    // console.log('loader show');
    this.loaderService.show();
  }
  private hideLoader(): void {
    // console.log('loader hide');
    this.loaderService.hide();
  }
}
