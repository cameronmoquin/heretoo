#!/usr/bin/env node
/**
 * After `expo export`, copy the build marker into dist/ so it's served
 * at https://heretoo.social/_build.txt for instant version verification.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const src = join(process.cwd(), 'public', '_build.txt');
const dst = join(process.cwd(), 'dist', '_build.txt');

if (!existsSync(src)) {
  console.error('public/_build.txt not found — did build-info run?');
  process.exit(1);
}

copyFileSync(src, dst);
console.log('Copied _build.txt to dist/');
