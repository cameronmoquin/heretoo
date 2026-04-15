#!/usr/bin/env node
/**
 * Pre-deploy validation.
 * Fails fast with readable errors if anything is wrong.
 */

import { execSync } from 'node:child_process';

const PRODUCTION_BRANCH = 'master';
const args = process.argv.slice(2);
const force = args.includes('--force');

function run(cmd) { return execSync(cmd, { encoding: 'utf8' }).trim(); }
function fail(msg) {
  console.error(`\n  FAIL: ${msg}\n`);
  process.exit(1);
}
function ok(msg) { console.log(`  OK   ${msg}`); }

console.log('\nPre-deploy checks');
console.log('─────────────────────────────────');

// 1. Working tree clean
const dirty = run('git status --porcelain');
if (dirty.length > 0) {
  if (force) {
    console.log('  WARN working tree dirty (--force override)');
  } else {
    fail(
      `working tree is dirty. Commit or stash, or use --force:\n\n${dirty}\n`
    );
  }
} else {
  ok('working tree clean');
}

// 2. On production branch
const branch = run('git rev-parse --abbrev-ref HEAD');
if (branch !== PRODUCTION_BRANCH) {
  if (force) {
    console.log(`  WARN on branch "${branch}", expected "${PRODUCTION_BRANCH}" (--force override)`);
  } else {
    fail(
      `on branch "${branch}", expected "${PRODUCTION_BRANCH}".\n` +
      `     Production deploys must come from ${PRODUCTION_BRANCH}.\n` +
      `     Run: git checkout ${PRODUCTION_BRANCH}`
    );
  }
} else {
  ok(`on branch "${PRODUCTION_BRANCH}"`);
}

// 3. Up to date with remote
try {
  run('git fetch origin');
  const local = run(`git rev-parse ${branch}`);
  const remote = run(`git rev-parse origin/${branch}`).trim();
  if (local !== remote) {
    if (force) {
      console.log('  WARN branch out of sync with remote (--force override)');
    } else {
      fail(
        `branch is out of sync with origin/${branch}.\n` +
        `     Run: git pull origin ${branch}`
      );
    }
  } else {
    ok(`in sync with origin/${branch}`);
  }
} catch (e) {
  console.log(`  WARN could not check remote sync (${e.message})`);
}

// 4. TypeScript passes
try {
  run('npx tsc --noEmit');
  ok('TypeScript compiles');
} catch {
  fail('TypeScript errors. Fix before deploying.');
}

console.log('─────────────────────────────────');
console.log('All checks passed.\n');
