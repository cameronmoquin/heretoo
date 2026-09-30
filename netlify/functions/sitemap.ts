/**
 * /sitemap.xml — generated on demand.
 *
 * Lists the public surfaces only. Authenticated surfaces (the feed,
 * clubs, messages) stay out of the index. Add a public page here
 * when one exists; robots.txt already declares this file.
 */

import type { Config } from '@netlify/functions';
import { SITE_URL } from '../../constants/site';

const BASE = SITE_URL;

export default async () => {
  const urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }> = [
    { loc: `${BASE}/`, changefreq: 'weekly', priority: '1.0' },
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
