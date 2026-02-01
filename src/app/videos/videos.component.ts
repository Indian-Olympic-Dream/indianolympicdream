import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { VideosService } from "./videos.service";
import { Embed } from "../models/app-models";
import { EmbedBlockComponent } from "../story-blocks/embed-block/embed-block.component";
@Component({
  selector: "app-videos",
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    EmbedBlockComponent,
  ],
  templateUrl: "./videos.component.html",
  styleUrl: "./videos.component.scss",
})
export class VideosComponent implements OnInit {
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

  constructor(private videosService: VideosService) { }

  ngOnInit(): void {
    this.videosService.getEmbeds().subscribe({
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

  getPictogramUrl(sport: string): string {
    const aliases: Record<string, string> = {
      'Artistic Gymnastics': 'gymnastics-artistic',
      'Gymnastics': 'gymnastics-artistic',
      'Rhythmic Gymnastics': 'gymnastics-artistic',
      'Trampoline Gymnastics': 'gymnastics-artistic',
      'Canoe Sprint': 'canoeing-(flatwater)',
      'Canoe Slalom': 'canoeing-(flatwater)',
      'Cycling Track': 'cycling-road',
      'Cycling Road': 'cycling-road',
      'Cycling BMX Racing': 'cycling-road',
      'Cycling Mountain Bike': 'cycling-road',
      'Cycling': 'cycling-road',
      'Marathon Swimming': 'swimming',
      'Artistic Swimming': 'swimming',
      'Water Polo': 'water-polo',
      'Diving': 'diving',
      'Hockey': 'field-hockey',
      'Field Hockey': 'field-hockey',
      'Equestrian': 'equestrian-eventing',
      'Equestrianism': 'equestrian-eventing',
      'Table Tennis': 'table-tennis',
      'Weightlifting': 'weightlifting',
      'Volleyball': 'volleyball-(indoor)',
      'Beach Volleyball': 'volleyball-(indoor)',
      'Handball': 'handball',
      'Sport Climbing': 'climbing',
      'Skateboarding': 'skateboarding',
      'Surfing': 'surfing',
      'Triathlon': 'triathlon',
      'Taekwondo': 'taekwondo',
      'Rugby Sevens': 'rugby-sevens',
      'Breaking': 'breakdancing',
      'Karate': 'karate',
      'Chess': 'chess'
    };

    const mappedSport = aliases[sport] || sport;
    const formattedSport = mappedSport.replace(/ /g, '').toLowerCase();
    return `assets/images/pictograms/icons/${formattedSport}.svg`;
  }
}
