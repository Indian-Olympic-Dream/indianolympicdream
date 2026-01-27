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
    // In dev, proxy.conf routes /api/media to production
    // In prod, relative URLs work directly
    return `${environment.payload_url}${value}`;
  }
}
