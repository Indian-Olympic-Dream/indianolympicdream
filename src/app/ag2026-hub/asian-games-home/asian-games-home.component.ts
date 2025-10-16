import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { filter, map, startWith } from 'rxjs';

@Component({
  selector: 'app-asian-games-home',
  standalone: true,
  imports: [CommonModule, RouterModule, MatToolbarModule, MatIconModule, MatButtonModule],
  templateUrl: './asian-games-home.component.html',
  styleUrls: ['./asian-games-home.component.scss']
})
export class AsianGamesHomeComponent implements OnInit {
  pageTitle: string = '';
  isChildRoute: boolean = false;

  constructor(public router: Router, private location: Location, private activatedRoute: ActivatedRoute) {}

  ngOnInit() {
    this.router.events.pipe(
      startWith(new NavigationEnd(0, '/', '/')),
      filter(event => event instanceof NavigationEnd),
      map(() => {
        let child = this.activatedRoute.firstChild;
        this.isChildRoute = !!child && child.snapshot.url.length > 0;
        while (child?.firstChild) {
          child = child.firstChild;
        }
        return child?.snapshot.data['title'];
      })
    ).subscribe((title: string) => {
      this.pageTitle = title;
    });
  }

  goBack(): void {
    this.location.back();
  }
}
