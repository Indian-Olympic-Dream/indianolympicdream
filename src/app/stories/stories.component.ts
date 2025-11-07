import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { Story, StoryService } from './stories.service';
@Component({
    selector: 'app-stories',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './stories.component.html',
    styleUrl: './stories.component.scss'
})
export class StoriesComponent implements OnInit {
    private storyService = inject(StoryService);
    public stories$!: Observable<Story[]>;

    ngOnInit(): void {
        this.stories$ = this.storyService.getStories();
    }

}
