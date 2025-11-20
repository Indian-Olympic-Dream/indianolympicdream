import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ElementRef,
  Renderer2,
} from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { CommonModule, DatePipe } from "@angular/common";
import { StoriesService, Story } from "../stories.service";
import { Observable, Subscription } from "rxjs";
import { switchMap } from "rxjs/operators";
import { PayloadMediaPipe } from "../../shared/payload-media.pipe";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatCardModule } from "@angular/material/card";
import { BlockRendererComponent } from "../../story-blocks/block-renderer/block-renderer.component";
import { MatButtonModule } from "@angular/material/button";
import { ScrollTrackingService } from "../../shared/services/scroll-tracking.service";

@Component({
  selector: "app-story-details",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PayloadMediaPipe,
    DatePipe,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatCardModule,
    BlockRendererComponent,
  ],
  templateUrl: "./story-details.component.html",
  styleUrls: ["./story-details.component.scss"],
})
export class StoryDetailsComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private storiesService = inject(StoriesService);
  private renderer = inject(Renderer2);
  private el = inject(ElementRef);
  private scrollTrackingService = inject(ScrollTrackingService);

  story$: Observable<Story>;
  private progressSubscription: Subscription;
  currentLocale: string = "en";

  ngOnInit() {
    this.story$ = this.route.params.pipe(
      switchMap((params) => {
        const slug = params["slug"];
        return this.route.queryParams.pipe(
          switchMap((queryParams) => {
            this.currentLocale = queryParams["locale"] || "en";
            return this.storiesService.getStoryBySlug(slug, this.currentLocale);
          }),
        );
      }),
    );

    this.progressSubscription =
      this.scrollTrackingService.scrollProgress$.subscribe((progress) => {
        const progressBarEl =
          this.el.nativeElement.querySelector(".progress-bar");
        if (progressBarEl) {
          this.renderer.setStyle(progressBarEl, "width", `${progress}%`);
        }
      });
  }

  setLocale(newLocale: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { locale: newLocale },
      queryParamsHandling: "merge",
    });
  }

  ngOnDestroy() {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
  }
}
