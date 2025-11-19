import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ElementRef,
  Renderer2,
} from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { CommonModule, DatePipe } from "@angular/common";
import { StoriesService, Story } from "../stories.service";
import { Observable, Subscription } from "rxjs";
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
  private storiesService = inject(StoriesService);
  private renderer = inject(Renderer2);
  private el = inject(ElementRef);
  private scrollTrackingService = inject(ScrollTrackingService);

  story$: Observable<Story>;
  private progressSubscription: Subscription;

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get("slug");
    if (slug) {
      this.story$ = this.storiesService.getStoryBySlug(slug);
    }

    // Subscribe to the scroll progress updates from the shared service
    this.progressSubscription =
      this.scrollTrackingService.scrollProgress$.subscribe((progress) => {
        const progressBarEl =
          this.el.nativeElement.querySelector(".progress-bar");
        if (progressBarEl) {
          this.renderer.setStyle(progressBarEl, "width", `${progress}%`);
        }
      });
  }

  ngOnDestroy() {
    // Unsubscribe to prevent memory leaks
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
  }
}
