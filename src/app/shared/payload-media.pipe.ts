import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

@Pipe({
  name: 'payloadMedia',
  standalone: true,
})
export class PayloadMediaPipe implements PipeTransform {
  transform(value: string | undefined): string {
    if (!value) {
      return '';
    }
    return `${environment.payload_url}${value}`;
  }
}
