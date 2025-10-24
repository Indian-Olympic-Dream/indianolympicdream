import { HttpInterceptorFn } from '@angular/common/http';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('jwt_token');

  if (token) {
    const modifiedReq = req.clone({
      setHeaders: {
        Authorization: `${token}`
      }
    });
    return next(modifiedReq);
  }

  return next(req);
};
