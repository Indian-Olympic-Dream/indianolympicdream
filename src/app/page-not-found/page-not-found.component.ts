import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-not-found',
  standalone: true,
  template: `
    <div class="error-container">
      <img class="errorimage" src="assets/images/404errorpage.png" alt="404 Error" />
      <button mat-button routerLink="/home">This will take you back home</button>
    </div>
  `,
    styles: [
        `
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        img.errorimage {
          margin-top:20px;
          max-width:100%;
          border-radius: 10px;
        }
        button{
          display: block;
          margin-top:10px;
          margin-left: auto;
          margin-right: auto;
          margin-bottom: 10px;
          color: #216f79;
          font-size:2em;
        }
  `
    ],
    imports: [MatButtonModule, RouterLink]
})
export class PageNotFoundComponent {
  constructor() {}
}
