import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-ag2026-hub',
  standalone: true,
  imports: [MatCardModule, RouterModule],
  templateUrl: './ag2026-hub.component.html',
  styleUrls: ['./ag2026-hub.component.scss']
})
export class Ag2026HubComponent {}

