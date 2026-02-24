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
    const mediaUrl = value.trim();
    if (!mediaUrl) return '';

    // In dev, proxy.conf routes /api/media to upstream.
    if (!/^https?:\/\//i.test(mediaUrl)) {
      return this.normalizeMediaPath(`${environment.payload_url}${mediaUrl}`);
    }

    try {
      const parsed = new URL(mediaUrl);
      const hostname = parsed.hostname.toLowerCase();
      const isLoopbackHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
      if (isLoopbackHost) {
        return this.normalizeMediaPath(`${parsed.pathname}${parsed.search}${parsed.hash}`);
      }
    } catch {
      // Keep original URL as-is if parse fails.
    }

    return mediaUrl;
  }

  private normalizeMediaPath(path: string): string {
    if (!path) return path;
    if (path.startsWith('/media/')) {
      return `/api${path}`;
    }
    return path;
  }
}
