/**
 * /sitemap.xml — generated nightly (and on demand).
 *
 * Source of Truth, Milestone 11. Lists the marketing surfaces only:
 * /, /about, /the-parlor, and each published parlor essay. Authenticated
 * surfaces (the Room, family pages, letters, chat) are not indexed.
 */

import type { Config } from '@netlify/functions';
import { getPublishedEssays } from '../../lib/parlor';

const BASE = 'https://heretoo.social';

export default async () => {
  const essays = getPublishedEssays();

  const urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }> = [
    { loc: `${BASE}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${BASE}/about`, changefreq: 'monthly', priority: '0.9' },
    { loc: `${BASE}/the-parlor`, changefreq: 'weekly', priority: '0.9' },
  ];

  for (const e of essays) {
    urls.push({
      loc: `${BASE}/the-parlor/${e.slug}`,
      lastmod: (e.updatedAt ?? e.publishedAt).slice(0, 10),
      changefreq: 'monthly',
      priority: '0.8',
    });
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => {
      const parts = [`<url><loc>${u.loc}</loc>`];
      if (u.lastmod) parts.push(`<lastmod>${u.lastmod}</lastmod>`);
      if (u.changefreq) parts.push(`<changefreq>${u.changefreq}</changefreq>`);
      if (u.priority) parts.push(`<priority>${u.priority}</priority>`);
      parts.push('</url>');
      return parts.join('');
    }),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

export const config: Config = { path: '/sitemap.xml' };
