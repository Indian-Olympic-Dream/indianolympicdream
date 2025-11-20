import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, ActivatedRoute } from "@angular/router";
import { Observable } from "rxjs";
import { PayloadMediaPipe } from "../shared/payload-media.pipe";
import { StoriesService, Story } from "./stories.service";

@Component({
  selector: "app-stories",
  standalone: true,
  imports: [CommonModule, RouterModule, PayloadMediaPipe],
  templateUrl: "./stories.component.html",
  styleUrl: "./stories.component.scss",
})
export class StoriesComponent implements OnInit {
  private storyService = inject(StoriesService);
  private route = inject(ActivatedRoute);

  stories$: Observable<Story[]>;
  loading: boolean = true;
  error: any;
  currentLocale: string = "en";

  ngOnInit(): void {
    // Subscribe to query params to get the current locale
    this.route.queryParams.subscribe((params) => {
      this.currentLocale = params["locale"] || "en";
    });

    this.stories$ = this.storyService.getStories();
    this.stories$.subscribe({
      next: () => (this.loading = false),
      error: (err) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
