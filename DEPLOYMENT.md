# Deployment

This is an observable deploy process, not a magical one. Every deploy can be verified in under one minute.

## Source of truth

- **Production branch:** `master`
- **Work branch:** `develop`
- **Production URL:** https://heretoo.social
- **Fallback URL:** https://heretoo.netlify.app
- **Hosting:** Netlify (project `heretoo`, ID `70a40b9c-a63d-49ea-ae60-f6500bf94804`)

Production deploys only come from `master`. Never deploy from `develop` or any feature branch.

## The flow

### 1. Work on develop

```bash
git checkout develop
# make changes, commit
git commit -am "fix: whatever"
git push origin develop
```

### 2. Merge to master when ready to release

```bash
# Open PR on GitHub: https://github.com/cameronmoquin/heretoo/compare/master...develop
# Review the diff. Merge.
git checkout master
git pull origin master
```

### 3. Deploy

From `master` with a clean working tree:

```bash
npm run deploy
```

This runs `predeploy-check` (branch, clean, synced, typecheck) then `build` then `netlify deploy --prod`.

### 4. Verify (under 60 seconds)

```bash
# Option 1: curl the build marker
npm run verify
# Prints the deployed commit, branch, buildTime.

# Option 2: visit /version in the app
# https://heretoo.social/version

# Option 3: look at the badge in the bottom-right corner of the app
# Every screen shows the commit hash.
```

Compare the commit hash against `git rev-parse --short HEAD` on your machine. Match = new build is live. No match = cache somewhere.

## Scripts

| Script | What it does |
|---|---|
| `npm run start` | Expo dev server |
| `npm run web` | Expo dev server (web only) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | Alias for typecheck |
| `npm run clean` | Remove `dist/`, `.expo/`, `node_modules/.cache` |
| `npm run build-info` | Generate `constants/build-info.ts` + `public/_build.txt` |
| `npm run build` | build-info + expo export + copy marker → `dist/` |
| `npm run predeploy` | Validate branch, clean tree, remote sync, typecheck |
| `npm run predeploy:force` | Same but warns instead of failing |
| `npm run deploy` | predeploy + build + netlify deploy --prod |
| `npm run deploy:force` | predeploy:force + build + netlify deploy --prod |
| `npm run deploy:force-clean` | clean + npm install + predeploy:force + build + deploy |
| `npm run verify` | curl the deployed `/_build.txt` marker |

## When changes do not appear after deploy

Go through these in order.

### 1. Check what is actually deployed

```bash
npm run verify
```

If the `commit` shown does not match your local `git rev-parse --short HEAD`, the new build did not deploy. Go to step 2.

If it DOES match, the new build IS live and the issue is a cache below it. Go to step 3.

### 2. The build did not deploy

```bash
# Confirm you are on master and up to date
git status
git rev-parse --short HEAD

# Check if deploy succeeded
netlify status

# Deploy logs (open in browser)
netlify open:admin
```

Run `npm run deploy:force-clean` — wipes everything, reinstalls, rebuilds, redeploys.

### 3. Browser cache

Open DevTools (F12) → Network tab → check "Disable cache" → hard refresh (Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac).

For stubborn cache:
- Close all tabs of heretoo.social
- Browser Settings → Clear browsing data → Cached images and files
- Try incognito/private window

### 4. CDN cache

Netlify's CDN respects the headers we set in `netlify.toml`. `index.html` and `_build.txt` are `max-age=0, must-revalidate` so they should never be stale. JS bundles have content hashes, so `main-abc123.js` and `main-def456.js` are different URLs — no cache collision is possible.

If you suspect CDN cache:
```bash
netlify api purgeCache
```

### 5. Service worker

There is no service worker in this app right now. If one is added later, document how to unregister it here.

### 6. TanStack Query cache

Client-side query cache. Lives in memory. Gone on page reload. If data looks stale but the build is correct, it is likely this — just refresh the page.

### 7. Supabase data stale

If the deployed build is correct but showing wrong data, it is Supabase-side. Check:
```bash
# Confirm you are pointing at the right project
curl -s https://heretoo.social/_build.txt | grep supabaseUrl
```

## Build identification

Every deploy puts a commit hash into three places:

1. **`/_build.txt`** — plain text, served at root. `curl https://heretoo.social/_build.txt`
2. **`/version`** — full debug panel. Includes Supabase URL, runtime info, live connectivity test.
3. **Bottom-right badge** — tiny monospace commit hash on every screen. Tap to open `/version`.

The badge shows `dirty` if the build was made with uncommitted changes. That should never be true for production.

## Cache header policy

Configured in `netlify.toml`.

| Path | Cache | Why |
|---|---|---|
| `/index.html` | no-cache | Must always fetch — references specific JS bundle |
| `/_build.txt` | no-cache | Used to verify deploy — must be fresh |
| `/_expo/static/js/web/*` | 1 year immutable | Content-hashed filenames — safe to cache forever |
| `/_expo/static/css/*` | 1 year immutable | Same |
| `/assets/*` | 1 day | Fonts, images — updates occasionally |

## Pre-deploy validation

`npm run predeploy` fails if:

1. Working tree is dirty (commit or stash)
2. Not on `master` branch
3. Branch is out of sync with `origin/master`
4. TypeScript does not compile

Use `--force` to override, but only when you know why.

## Emergency: rollback

```bash
# Find the previous good deploy
netlify open:admin
# Click "Deploys" tab. Click the last-known-good one. Click "Publish deploy".
```

Or via CLI:

```bash
netlify rollback
```

## Running migrations

Database migrations are separate from frontend deploys. They live in `supabase/migrations/`.

To apply a new migration:
1. Go to https://supabase.com/dashboard/project/evryruyibfibaplzurik/sql/new
2. Paste the SQL from the migration file
3. Run

The migration order matters. Never run an older migration after a newer one.
