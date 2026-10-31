import { Component, input } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { SHOP_SIZE_GUIDE } from "./shop-size-guide";

@Component({
  selector: "app-shop-size-guide",
  standalone: true,
  imports: [MatIconModule],
  template: `
    <details class="size-guide" [class.size-guide--attached]="attached()">
      <summary>
        <span><mat-icon aria-hidden="true">straighten</mat-icon>View size chart</span>
        <small>All measurements in inches</small>
        <mat-icon class="size-guide__chevron" aria-hidden="true">expand_more</mat-icon>
      </summary>

      <div class="size-guide__table-wrap">
        <table>
          <caption>IOD T-shirt size measurements in inches</caption>
          <thead>
            <tr>
              <th scope="col">Size</th>
              <th scope="col">Length</th>
              <th scope="col">Shoulder</th>
              <th scope="col">Chest</th>
              <th scope="col">Chest size</th>
            </tr>
          </thead>
          <tbody>
            @for (measurement of sizeGuide; track measurement.size) {
              <tr>
                <th scope="row">{{ measurement.size }}</th>
                <td>{{ measurement.length }}</td>
                <td>{{ measurement.shoulder }}</td>
                <td>{{ measurement.chest }}</td>
                <td>{{ measurement.bodyChest }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  `,
  styleUrl: "./shop-size-guide.component.scss",
})
export class ShopSizeGuideComponent {
  readonly attached = input<boolean>(false);
  readonly sizeGuide = SHOP_SIZE_GUIDE;
}
