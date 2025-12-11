import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { ExploreService } from "./explore.service";
import { Embed } from "../models/app-models";
import { EmbedBlockComponent } from "../story-blocks/embed-block/embed-block.component";
@Component({
  selector: "app-explore",
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    EmbedBlockComponent,
  ],
  templateUrl: "./explore.component.html",
  styleUrl: "./explore.component.scss",
})
export class ExploreComponent implements OnInit {
  allEmbeds: Embed[] = [];
  filteredEmbeds: Embed[] = [];
  loading = true;

  sports = [
    "All",
    "Hockey",
    "Boxing",
    "Swimming",
    "Shooting",
    "Athletics",
    "Wrestling",
    "Weightlifting",
  ];
  selectedSport = "All";

  constructor(private exploreService: ExploreService) {}

  ngOnInit(): void {
    this.exploreService.getEmbeds().subscribe({
      next: (embeds) => {
        this.allEmbeds = embeds;
        this.filteredEmbeds = embeds;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  filterBySport(sport: string): void {
    this.selectedSport = sport;
    if (sport === "All") {
      this.filteredEmbeds = this.allEmbeds;
    } else {
      this.filteredEmbeds = this.allEmbeds.filter((embed) =>
        embed.tags.some((t) => t.name === sport),
      );
    }
  }
}
