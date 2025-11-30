import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScrollTrackingService {
  private scrollProgress = new BehaviorSubject<number>(0);
  public scrollProgress$ = this.scrollProgress.asObservable();

  updateProgress(progress: number): void {
    // To avoid rapid updates, we can check if the value has changed significantly
    if (Math.abs(progress - this.scrollProgress.value) > 0.1) {
      this.scrollProgress.next(progress);
    }
  }
}
