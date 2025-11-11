import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
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
  stories$: Observable<Story[]>;
  loading: boolean = true;
  error: any;

  ngOnInit(): void {
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
