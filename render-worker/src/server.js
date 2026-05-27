// HereToo memoir render worker — HTTP entrypoint.
//
// POST /render { render_id, project_id }  (header: x-render-secret)
//   Validates the shared secret, ACKs with 202 immediately, then
//   processes the render in the background (Render keeps the process
//   alive, unlike a serverless function). On completion it uploads
//   the PDFs/EPUB to the private books bucket and flips the
//   memoir_book_renders row to 'done' or 'failed'.
//
// GET /health  -> 200 for platform health checks.

import express from 'express';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { supabase, BOOKS_BUCKET } from './supabase.js';
import {
  fetchProject, fetchAuthorName, fetchResponses, fetchAssets,
  assetLocalPath, buildMarkdown,
} from './assemble.js';
import { renderBook, readArtifact, cleanup } from './latex.js';

const ASSETS_BUCKET = 'memoir-assets';

const PORT = process.env.PORT || 8080;
const RENDER_SECRET = process.env.MEMOIR_RENDER_SECRET;

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.status(200).send('ok'));

app.post('/render', async (req, res) => {
  if (!RENDER_SECRET || req.get('x-render-secret') !== RENDER_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const { render_id: renderId, project_id: projectId } = req.body || {};
  if (!renderId || !projectId) {
    return res.status(400).json({ error: 'render_id and project_id required' });
  }

  // ACK immediately; the heavy work continues after the response.
  res.status(202).json({ accepted: true, render_id: renderId });

  processRender(renderId, projectId).catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error('[render] fatal', renderId, e?.message);
    await markFailed(renderId, e?.message || 'unknown error');
  });
});

async function processRender(renderId, projectId) {
  await supabase
    .from('memoir_book_renders')
    .update({ status: 'rendering' })
    .eq('id', renderId);

  const project = await fetchProject(projectId);
  const [authorName, responses, assets] = await Promise.all([
    fetchAuthorName(project.author_id),
    fetchResponses(projectId),
    fetchAssets(projectId),
  ]);

  if (!responses.length && !assets.length) {
    await markFailed(renderId, 'Nothing to print yet — write at least one answer or add a photo before rendering.');
    return;
  }

  const markdown = buildMarkdown({ project, authorName, responses, assets });
  const result = await renderBook({
    markdown,
    title: project.title || 'My Life, So Far',
    author: authorName,
    paperColor: project.paper_color || 'cream',
    // Download each photo to {workDir}/photos/{id}.{ext} so the
    // markdown image refs resolve when LuaLaTeX runs.
    prepareAssets: async (workDir) => {
      if (!assets.length) return;
      await mkdir(join(workDir, 'photos'), { recursive: true });
      for (const a of assets) {
        try {
          const { data, error } = await supabase.storage
            .from(ASSETS_BUCKET)
            .download(a.storage_path);
          if (error || !data) {
            // eslint-disable-next-line no-console
            console.warn('[render] asset download failed', a.id, error?.message);
            continue;
          }
          const buf = Buffer.from(await data.arrayBuffer());
          await writeFile(join(workDir, assetLocalPath(a)), buf);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[render] asset write failed', a.id, e?.message);
        }
      }
    },
  });

  try {
    const base = `${projectId}/${renderId}`;
    const interior = await readArtifact(result.interiorPath);
    const interiorPath = `${base}/interior.pdf`;
    await upload(interiorPath, interior, 'application/pdf');

    let coverPath = null;
    if (result.coverPath) {
      const cover = await readArtifact(result.coverPath);
      coverPath = `${base}/cover.pdf`;
      await upload(coverPath, cover, 'application/pdf');
    }

    let epubPath = null;
    if (result.epubPath) {
      const epub = await readArtifact(result.epubPath);
      epubPath = `${base}/book.epub`;
      await upload(epubPath, epub, 'application/epub+zip');
    }

    await supabase
      .from('memoir_book_renders')
      .update({
        status: 'done',
        page_count: result.pageCount,
        spine_width_in: result.spineWidth,
        interior_pdf_path: interiorPath,
        cover_pdf_path: coverPath,
        epub_path: epubPath,
        output_mode: project.output_mode || 'kdp',
        trim_size: project.trim_size || '6x9',
        validation_passed: true,
        error: null,
      })
      .eq('id', renderId);

    // eslint-disable-next-line no-console
    console.log('[render] done', renderId, `${result.pageCount}pp`);
  } finally {
    await cleanup(result.workDir);
  }
}

async function upload(path, bytes, contentType) {
  const { error } = await supabase.storage
    .from(BOOKS_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

async function markFailed(renderId, message) {
  await supabase
    .from('memoir_book_renders')
    .update({ status: 'failed', error: String(message).slice(0, 2000) })
    .eq('id', renderId)
    .catch(() => {});
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[render] worker listening on ${PORT}`);
});
