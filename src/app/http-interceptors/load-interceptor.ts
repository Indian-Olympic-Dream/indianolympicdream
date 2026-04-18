import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse, HttpSentEvent, HttpHeaderResponse, HttpProgressEvent, HttpResponse, HttpUserEvent } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoaderService } from '../shared/components/loader/loader.service';
@Injectable()
export class LoadInterceptor implements HttpInterceptor {
  constructor(
    private loaderService: LoaderService,
    private router: Router
  ) { }
  intercept(req: HttpRequest<any>,
    next: HttpHandler): Observable<HttpSentEvent | HttpHeaderResponse | HttpProgressEvent | HttpResponse<any> | HttpUserEvent<any>> {

    const idToken = localStorage.getItem('token');
    // console.log('interceptor visited!!');
    // if (idToken) {
    //     const cloned = req.clone({
    //         headers: req.headers.set('Authorization',
    //             'Bearer ' + idToken)
    //     });
    this.showLoader();
    return next.handle(req)
      .pipe(
        tap(
          (event: HttpEvent<any>) => {
            // console.log(event);
            if (event instanceof HttpResponse) {
              // do stuff with response if you want
              // const jwt = event.headers.get('jwttoken');
              this.onEnd();
              // console.log(jwt);
              //  if (jwt) {
              //    localStorage.setItem('token', jwt);
              //  }
            }
          },
          (error => {
            if (error instanceof HttpErrorResponse && error.status >= 500) {
              this.onEnd();
              this.router.navigate(['internal-error']);
            } else {
              this.onEnd();
              return throwError(error);
            }
          })));
    // } else {
    //     return next.handle(req);
    //  }
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
