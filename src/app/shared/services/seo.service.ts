import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

interface ResolvedSeo {
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);

  private readonly siteName = 'Indian Olympic Dream';
  private readonly defaultDescription =
    "Track India's Olympic journey across current contenders, competition calendar, legacy history, athletes, originals, and stories.";
  private readonly defaultImagePath = '/assets/images/social/iod-share-card.png';
  private readonly fallbackOrigin = 'https://indianolympicdream.com';
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.applyRouteSeo();
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.applyRouteSeo());
  }

  absoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      return pathOrUrl;
    }

    const origin = this.document.location?.origin || this.fallbackOrigin;
    const normalized = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return new URL(normalized, origin).toString();
  }

  defaultShareImageUrl(): string {
    return this.absoluteUrl(this.defaultImagePath);
  }

  applyRouteSeo(): void {
    const leaf = this.getLeafRoute(this.activatedRoute);
    const path = leaf.routeConfig?.path || '';
    const currentUrl = this.router.url || '/';
    const cleanPath = currentUrl.split('?')[0] || '/';
    const seo = this.resolveSeo(path, cleanPath, leaf.snapshot.params);
    const absoluteUrl = this.absoluteUrl(cleanPath);
    const imageUrl = this.absoluteUrl(seo.image || this.defaultImagePath);

    this.titleService.setTitle(seo.title);
    this.metaService.updateTag({ name: 'title', content: seo.title });
    this.metaService.updateTag({ name: 'description', content: seo.description });
    this.metaService.updateTag({ property: 'og:site_name', content: this.siteName });
    this.metaService.updateTag({ property: 'og:type', content: seo.type || 'website' });
    this.metaService.updateTag({ property: 'og:title', content: seo.title });
    this.metaService.updateTag({ property: 'og:description', content: seo.description });
    this.metaService.updateTag({ property: 'og:url', content: absoluteUrl });
    this.metaService.updateTag({ property: 'og:image', content: imageUrl });
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:url', content: absoluteUrl });
    this.metaService.updateTag({ name: 'twitter:title', content: seo.title });
    this.metaService.updateTag({ name: 'twitter:description', content: seo.description });
    this.metaService.updateTag({ name: 'twitter:image', content: imageUrl });
    this.metaService.updateTag({
      name: 'robots',
      content: seo.noindex ? 'noindex, nofollow' : 'index, follow',
    });
    this.ensureCanonicalLink(absoluteUrl);
  }

  private resolveSeo(path: string, cleanPath: string, params: Record<string, string>): ResolvedSeo {
    if (path === '**') {
      return {
        title: `Page Not Found | ${this.siteName}`,
        description: 'The page you requested is not available. Explore the current Olympic calendar, legacy archive, and athlete watchlists instead.',
        noindex: true,
      };
    }

    if (cleanPath === '/internal-error') {
      return {
        title: `Unable to Load Page | ${this.siteName}`,
        description: 'This page could not be loaded. Try again shortly or return to a stable section of Indian Olympic Dream.',
        noindex: true,
      };
    }

    if (cleanPath === '/' || cleanPath === '/home' || cleanPath === '/sports') {
      return {
        title: `${this.siteName} | India's Olympic Sports Home`,
        description:
          "Track India's Olympic ecosystem with sport hubs, LA28 contender tiers, current calendar, legacy editions, and editorial originals.",
      };
    }

    if (cleanPath === '/calendar') {
      return {
        title: `Calendar | ${this.siteName}`,
        description:
          "Follow India's Olympic sports calendar with live now, this week, this month, and sport-specific competition tracking.",
      };
    }

    if (path === 'calendar/:slug') {
      const eventLabel = this.humanize(params['slug']);
      return {
        title: `${eventLabel} | Calendar | ${this.siteName}`,
        description: `Open the official context for ${eventLabel} inside the Indian Olympic Dream calendar.`,
      };
    }

    if (cleanPath === '/athletes') {
      return {
        title: `Athletes | ${this.siteName}`,
        description:
          "Explore India's medal hopes, outside chances, qualification watch, and retired Olympic athletes across sport filters.",
      };
    }

    if (cleanPath === '/originals') {
      return {
        title: `Originals | ${this.siteName}`,
        description:
          'Watch Indian Olympic Dream originals, on-ground reports, podcasts, and Olympic sports documentaries in one place.',
      };
    }

    if (cleanPath === '/stories') {
      return {
        title: `Stories | ${this.siteName}`,
        description: 'Read deep stories from Indian Olympic sports, athletes, coaches, and the long road to the Games.',
      };
    }

    if (path === ':slug' && cleanPath.startsWith('/stories/')) {
      const storyLabel = this.humanize(params['slug']);
      return {
        title: `${storyLabel} | Stories | ${this.siteName}`,
        description: `Read ${storyLabel} on Indian Olympic Dream.`,
        type: 'article',
      };
    }

    if (cleanPath === '/history') {
      return {
        title: `History | ${this.siteName}`,
        description:
          "Explore India's Olympic legacy through editions, medal moments, heartbreaks, and sport-by-sport historical summaries.",
      };
    }

    if (path === 'sport/:sportname') {
      const sportLabel = this.humanize(params['sportname']);
      return {
        title: `${sportLabel} | ${this.siteName}`,
        description: `Track ${sportLabel} across India's Olympic history, active athletes, and current pathway inside Indian Olympic Dream.`,
      };
    }

    if (path === ':slug' && cleanPath.startsWith('/history/')) {
      const editionLabel = this.humanize(params['slug']);
      return {
        title: `${editionLabel} | History | ${this.siteName}`,
        description: `Open ${editionLabel} and review India's Olympic performance, stories, participants, and sport results.`,
      };
    }

    return {
      title: `${this.siteName} | India's Olympic Sports Home`,
      description: this.defaultDescription,
    };
  }

  private getLeafRoute(route: ActivatedRoute): ActivatedRoute {
    let current = route;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }

  private humanize(value?: string): string {
    if (!value) return this.siteName;
    return decodeURIComponent(value)
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private ensureCanonicalLink(url: string): void {
    const head = this.document.head;
    if (!head) return;

    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
