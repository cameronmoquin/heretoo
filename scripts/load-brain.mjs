/**
 * load-brain — upsert brain/*.md into the brain_entries table.
 *
 * The brain dir is gitignored (the repo is public; the works are
 * unpublished). This loader is the bridge from the local distillations
 * to the platform's private store. Service role from .env.
 *
 * Run: node scripts/load-brain.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BRAIN_DIR = new URL('../brain/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^(\w[\w_]*):\s*(.*)$/);
      if (kv) fm[kv[1]] = kv[2].trim();
    }
  }
  return fm;
}

const files = readdirSync(BRAIN_DIR).filter((f) => f.endsWith('.md'));
let ok = 0;
for (const f of files) {
  const raw = readFileSync(join(BRAIN_DIR, f), 'utf8');
  const fm = parseFrontmatter(raw);
  const slug = fm.slug || f.replace(/\.md$/, '');
  const row = {
    slug,
    title: fm.title || slug,
    form: fm.form || null,
    status: fm.status || null,
    master: fm.master || null,
    words_read: fm.words_read ? parseInt(String(fm.words_read).replace(/\D/g, ''), 10) || null : null,
    content_md: raw,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('brain_entries').upsert(row);
  if (error) {
    console.error('FAIL', slug, error.message);
  } else {
    ok++;
    console.log('ok  ', slug, `(${raw.length} chars)`);
  }
}
console.log(`\n${ok}/${files.length} entries loaded.`);
