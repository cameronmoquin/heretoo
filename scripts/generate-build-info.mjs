#!/usr/bin/env node
/**
 * Generates constants/build-info.ts with the current git commit,
 * branch, timestamp, and environment.
 *
 * Also writes public/_build.txt so you can curl it after deploy
 * to instantly confirm which build is live.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function safeExec(cmd, fallback = 'unknown') {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

const commit = safeExec('git rev-parse --short HEAD');
const commitFull = safeExec('git rev-parse HEAD');
const branch = safeExec('git rev-parse --abbrev-ref HEAD');
// Only count source file changes as "dirty" — ignore build artifacts etc.
const dirty = safeExec('git status --porcelain')
  .split('\n')
  .filter((l) => l.trim())
  .some((l) => /\.(ts|tsx|js|jsx|json|md|sql|toml)$/.test(l));
const buildTime = new Date().toISOString();
// This script only ever runs from `npm run build`, and that is always a
// production export — `expo export` does not emit a dev bundle. It used
// to require NETLIFY=true or NODE_ENV=production, neither of which is
// set when you deploy from your own machine with the Netlify CLI, so
// every local `npm run deploy` stamped the marker "development" and the
// one field people check to confirm a prod deploy lied to them.
const env = process.env.NODE_ENV === 'development' ? 'development' : 'production';

const content = `// AUTO-GENERATED — do not edit. Regenerated on every build.
// See scripts/generate-build-info.mjs

export const BuildInfo = {
  commit: '${commit}',
  commitFull: '${commitFull}',
  branch: '${branch}',
  dirty: ${dirty},
  buildTime: '${buildTime}',
  env: '${env}' as 'production' | 'development' | 'preview',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'not-set',
} as const;
`;

writeFileSync(join(process.cwd(), 'constants', 'build-info.ts'), content, 'utf8');

// Plain-text marker served at /_build.txt — curl after deploy to verify.
const publicDir = join(process.cwd(), 'public');
if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
const marker = `commit=${commit}\nbranch=${branch}\ndirty=${dirty}\nbuildTime=${buildTime}\nenv=${env}\n`;
writeFileSync(join(publicDir, '_build.txt'), marker, 'utf8');

console.log(`Build info: ${commit} on ${branch} @ ${buildTime}${dirty ? ' (DIRTY)' : ''}`);
