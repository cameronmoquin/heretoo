/**
 * /sitemap.xml — generated nightly (and on demand).
 *
 * Source of Truth, Milestone 11. Lists the marketing surfaces only:
 * / and /about. Authenticated surfaces (the Room, family pages,
 * letters, chat) stay out of the index.
 *
 * AND THE STUDY GUIDE'S HUBS. This file used to list three URLs and
 * none of them was /fsot/, while the guide's own 84-URL sitemap was the
 * single discovery path into all 85 of its pages — no internal link
 * either, because web.output "single" ships a React shell with no <a>
 * tags at all. Sitemap-only URLs that nothing links to are the case
 * Google reports as "Discovered – currently not indexed", which is
 * exactly what the guide was. The hubs belong here; the deep pages stay
 * in /fsot/sitemap.xml, which robots.txt already declares.
 */

import type { Config } from '@netlify/functions';

const BASE = 'https://heretoo.social';

export default async () => {
  const urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }> = [
    { loc: `${BASE}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${BASE}/about`, changefreq: 'monthly', priority: '0.9' },
    { loc: `${BASE}/advertise`, changefreq: 'monthly', priority: '0.6' },
    // The study guide. Hubs only — /fsot/sitemap.xml carries the 84
    // deep pages and is declared separately in robots.txt.
    { loc: `${BASE}/fsot/`, changefreq: 'weekly', priority: '0.9' },
    { loc: `${BASE}/fsot/guide/`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${BASE}/fsot/listen/`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${BASE}/fsot/omst/`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${BASE}/fsot/plan.html`, changefreq: 'monthly', priority: '0.7' },
  ];

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
