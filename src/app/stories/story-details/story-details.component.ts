import { Component, OnInit, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { CommonModule, JsonPipe, DatePipe } from "@angular/common";
import { StoriesService, Story } from "../stories.service";
import { Observable } from "rxjs";
import { PayloadMediaPipe } from "../../shared/payload-media.pipe";
import { RouterModule } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from "@angular/material/button";

@Component({
  selector: "app-story-details",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PayloadMediaPipe,
    JsonPipe,
    DatePipe,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatCardModule,
  ],
  templateUrl: "./story-details.component.html",
  styleUrls: ["./story-details.component.scss"],
})
export class StoryDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private storiesService = inject(StoriesService);

  story$: Observable<Story>;

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get("slug");
    if (slug) {
      this.story$ = this.storiesService.getStoryBySlug(slug);
    }
  }
}
