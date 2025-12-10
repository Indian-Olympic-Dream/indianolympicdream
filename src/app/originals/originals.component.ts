import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { Observable } from "rxjs";
import { OriginalsService } from "./originals.service";
import { Podcast } from "../models/app-models";
import { EmbedBlockComponent } from "../story-blocks/embed-block/embed-block.component";

@Component({
  selector: "app-originals",
  standalone: true,
  imports: [CommonModule, RouterModule, EmbedBlockComponent],
  templateUrl: "./originals.component.html",
  styleUrl: "./originals.component.scss",
})
export class OriginalsComponent implements OnInit {
  podcasts$: Observable<Podcast[]>;

  constructor(private originalsService: OriginalsService) {}

  ngOnInit(): void {
    this.podcasts$ = this.originalsService.getPodcasts();
  }
}
