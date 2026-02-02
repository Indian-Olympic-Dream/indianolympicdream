import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PayloadService, Product } from '../services/payload.service';
import { Observable } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, RouterModule],
  templateUrl: './store.component.html',
  styleUrl: './store.component.scss'
})
export class StoreComponent {
  private payloadService = inject(PayloadService);
  products$: Observable<Product[]> = this.payloadService.getProducts();

  getOptimizedImageUrl(product: Product): string {
    const url = this.payloadService.getMediaUrl(product.images?.[0]?.image);
    return url || 'assets/images/placeholder_poster.jpg';
  }
}
