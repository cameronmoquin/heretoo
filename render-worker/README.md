# HereToo Memoir Render Worker

Turns a memoir project into KDP-ready files: an interior PDF (the book),
a type-only cover PDF, and an EPUB. Runs as a long-lived container so it
can take minutes per render (Netlify functions can't).

**Pipeline:** Markdown (assembled from saved answers) → Pandoc →
LuaLaTeX (`memoir.cls`, KDP 6×9 + bleed) → Ghostscript `/prepress`
normalize (fonts embedded, 300dpi) → upload to the private
`memoir-books` Supabase bucket → flip `memoir_book_renders` to `done`.

## Deploy on Render.com

1. Make sure migrations **049** (book storage bucket + render status)
   is applied on Supabase.
2. In Render: **New → Blueprint**, point at `render-worker/render.yaml`
   (or **New → Web Service** from a Docker repo).
3. Set these env vars in the Render dashboard:
   - `SUPABASE_URL` — your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — service role (server-only)
   - `MEMOIR_RENDER_SECRET` — a long random string; **must match** the
     same var set on Netlify
4. Deploy. First build is slow (TeX Live + fonts). `GET /health` should
   return `ok`.
5. Copy the service URL (e.g. `https://heretoo-memoir-render.onrender.com`)
   into Netlify as `MEMOIR_RENDER_WORKER_URL`.

## Contract

`POST /render` with header `x-render-secret: <secret>` and body
`{ "render_id": "...", "project_id": "..." }`. Responds `202` instantly,
then processes in the background and updates the `memoir_book_renders`
row. The Netlify function `/api/memoir-render` is what calls this.

## First-render gotchas (honest list)

- **Fonts.** The image pulls Source Serif 4 / Inter / Syne from Google
  Fonts at build time. If a face fails to download, the template falls
  back to Libertinus (installed), so a render still succeeds — it just
  won't be on-brand. Check `fc-list | grep -i source` in the container
  if the body font looks wrong.
- **Page count / spine.** Cover spine width is `pages × 0.0025in`
  (cream). If you switch to white paper, the worker reads
  `project.paper_color` and uses `0.002252in`.
- **PDF/X-1a.** v1 ships a Ghostscript `/prepress` PDF (fonts embedded,
  KDP-accepted) rather than strict CMYK PDF/X-1a, to avoid shifting
  photo colour. Hardening to true PDF/X-1a is a future step.
- **The real test.** Order one physical proof. Amazon KDP is the
  cheapest path (~$4); FedEx Office or Staples will do a one-off
  perfect-bound proof for around $20. The interior PDF is a standard
  6×9 paperback file — any printer that handles PDFs with embedded
  fonts will accept it. See `/memoir/print` in the app for the
  consumer-facing comparison.

## Local smoke test

```
docker build -t memoir-render .
docker run -p 8080:8080 \
  -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e MEMOIR_RENDER_SECRET=dev memoir-render
curl localhost:8080/health
```
