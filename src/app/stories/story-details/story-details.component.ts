import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ElementRef,
  PLATFORM_ID,
  Renderer2,
  ViewChild,
} from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { CommonModule, DatePipe, DOCUMENT, isPlatformBrowser } from "@angular/common";
import { Title, Meta } from "@angular/platform-browser";
import { StoriesService, Story } from "../stories.service";
import { Observable, Subscription } from "rxjs";
import { switchMap, tap } from "rxjs/operators";
import { PayloadMediaPipe } from "../../shared/payload-media.pipe";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatCardModule } from "@angular/material/card";
import { BlockRendererComponent } from "../../story-blocks/block-renderer/block-renderer.component";
import { MatButtonModule } from "@angular/material/button";
import { ScrollTrackingService } from "../../shared/services/scroll-tracking.service";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { EmbedBlockComponent } from "src/app/story-blocks/embed-block/embed-block.component";
import { SeoService } from "../../shared/services/seo.service";
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
    MatSnackBarModule,
    MatButtonToggleModule,
    EmbedBlockComponent,
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
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private scrollTrackingService = inject(ScrollTrackingService);
  private snackBar = inject(MatSnackBar);
  private titleService = inject(Title);
  private metaService = inject(Meta);
  private seoService = inject(SeoService);

  story$: Observable<Story>;
  private currentStory: Story;
  private subscriptions = new Subscription();
  currentLocale: string = "en";

  @ViewChild("exploreContent") exploreContent: ElementRef;

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
      tap((story) => {
        if (story) {
          this.currentStory = story;
          this.updateMetaTags(story);
        }
      }),
    );

    this.subscriptions.add(
      this.scrollTrackingService.scrollProgress$.subscribe((progress) => {
        const progressBarEl =
          this.el.nativeElement.querySelector(".progress-bar");
        if (progressBarEl) {
          this.renderer.setStyle(progressBarEl, "width", `${progress}%`);
        }
      }),
    );
  }

  private updateMetaTags(story: Story): void {
    const title = story.metaTitle || story.title;
    const description =
      story.metaDescription || "A story from Indian Olympic Dream";

    this.titleService.setTitle(title);
    this.metaService.updateTag({ name: "description", content: description });
    this.metaService.updateTag({ property: "og:title", content: title });
    this.metaService.updateTag({
      property: "og:description",
      content: description,
    });
    this.metaService.updateTag({ property: "og:type", content: "article" });
    this.metaService.updateTag({
      property: "og:url",
      content: this.currentAbsoluteUrl(),
    });
    this.metaService.updateTag({ name: "twitter:title", content: title });
    this.metaService.updateTag({ name: "twitter:description", content: description });
    this.metaService.updateTag({ name: "twitter:card", content: "summary_large_image" });

    if (story.socialImage?.sizes?.card?.url) {
      const imageUrl = this.seoService.absoluteUrl(story.socialImage.sizes.card.url);
      this.metaService.updateTag({ property: "og:image", content: imageUrl });
      this.metaService.updateTag({ name: "twitter:image", content: imageUrl });
    }
  }

  setLocale(newLocale: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { locale: newLocale },
      queryParamsHandling: "merge",
    });
  }

  shareStory(): void {
    if (!this.currentStory) return;

    const shareData = {
      title: this.currentStory.metaTitle || this.currentStory.title,
      text: this.currentStory.metaDescription,
      url: this.currentAbsoluteUrl(),
    };

    if (isPlatformBrowser(this.platformId) && navigator.share) {
      navigator
        .share(shareData)
        .catch((error) => console.error("Error sharing:", error));
    } else if (isPlatformBrowser(this.platformId) && navigator.clipboard) {
      navigator.clipboard
        .writeText(this.currentAbsoluteUrl())
        .then(() => {
          this.snackBar.open("Link copied to clipboard!", "Close", {
            duration: 3000,
          });
        })
        .catch(() => {
          this.legacyCopyLink();
        });
    } else {
      this.legacyCopyLink();
    }
  }

  private legacyCopyLink(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const textArea = this.renderer.createElement("textarea");
    textArea.value = this.currentAbsoluteUrl();
    this.renderer.appendChild(this.document.body, textArea);
    textArea.select();
    document.execCommand("copy");
    this.renderer.removeChild(this.document.body, textArea);
    this.snackBar.open("Link copied to clipboard!", "Close", {
      duration: 3000,
    });
  }

  scrollExplore(direction: number): void {
    const container = this.exploreContent.nativeElement;
    const scrollAmount = container.offsetWidth * 0.8; // Scroll by 80% of the container width
    container.scrollBy({ left: scrollAmount * direction, behavior: "smooth" });
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private currentAbsoluteUrl(): string {
    return this.seoService.absoluteUrl(this.router.url || "/stories");
  }
}
