import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private http: HttpClient) { }

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${path}`);
  }

  post<T>(path: string, body: object = {}): Observable<T> {
    return this.http.post<T>(`${path}`, body);
  }

  //... implement put and delete methods
}