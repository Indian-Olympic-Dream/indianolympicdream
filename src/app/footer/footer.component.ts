import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import packageJson from '../../../package.json';

@Component({
    selector: 'app-footer',
    standalone: true,
    imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
    currentYear = new Date().getFullYear();
    contactEmail = 'contact@iodsports.com';
    releaseLabel = `V${packageJson.version}`;

    socialLinks = [
        { name: 'Instagram', icon: 'photo_camera', url: 'https://www.instagram.com/iod_sports' },
        { name: 'Twitter', icon: 'alternate_email', url: 'https://x.com/olympic_indian' },
        { name: 'YouTube', icon: 'smart_display', url: 'https://www.youtube.com/@IODSportsPod' },
        { name: 'Spotify', icon: 'podcasts', url: 'https://open.spotify.com/show/7IkzLKPdBDi6oIsh9psFEn' }
    ];
}
