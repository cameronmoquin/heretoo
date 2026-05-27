// The actual render: Markdown -> (Pandoc + LuaLaTeX) -> interior PDF,
// Ghostscript normalize (embed fonts, 300dpi, KDP-safe), read the page
// count, build a type-only cover sized from the spine math, and emit
// an EPUB side-output.
//
// KDP note: a PDF with all fonts embedded is accepted as-is. We run a
// Ghostscript /prepress pass to guarantee embedding and image
// resolution rather than forcing CMYK PDF/X-1a (which can shift photo
// colour). True PDF/X-1a is a documented future hardening step.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(__dirname, 'template.tex');

// KDP paper thickness (inches per page). Cream is 0.0025".
const PAPER_THICKNESS = { cream: 0.0025, white: 0.002252 };
const TRIM_W = 6;
const TRIM_H = 9;
const BLEED = 0.125;

async function run(cmd, args, cwd) {
  try {
    const { stdout } = await exec(cmd, args, {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
      timeout: 1000 * 60 * 8,
    });
    return stdout;
  } catch (e) {
    const detail = (e.stderr || e.stdout || e.message || '').toString();
    throw new Error(`${cmd} failed: ${detail.slice(-1500)}`);
  }
}

function parsePageCount(pdfinfoOut) {
  const m = /Pages:\s+(\d+)/.exec(pdfinfoOut);
  return m ? parseInt(m[1], 10) : null;
}

function coverTex({ title, author, totalW, totalH }) {
  // A standalone single-page cover at full wrap size with bleed.
  // Type-only for v1: front-cover title block centred in the right
  // half (the front), spine + back left blank.
  return `\\documentclass{standalone}
\\usepackage[paperwidth=${totalW}in,paperheight=${totalH}in,margin=0in]{geometry}
\\usepackage{fontspec}
\\setmainfont{Libertinus Serif}
\\IfFontExistsTF{Syne}{\\newfontfamily\\display{Syne}}{\\newfontfamily\\display{Libertinus Serif}}
\\usepackage{tikz}
\\begin{document}
\\begin{tikzpicture}[remember picture,overlay]
  \\fill[black] (current page.south west) rectangle (current page.north east);
  \\node[text=white,align=center,font=\\display\\Huge]
    at ([xshift=0.25\\paperwidth]current page.center)
    {\\textit{${escapeTex(title)}}};
  \\node[text=white,align=center,font=\\display\\Large,yshift=-1.5in]
    at ([xshift=0.25\\paperwidth]current page.center)
    {${escapeTex(author)}};
\\end{tikzpicture}
\\end{document}
`;
}

function escapeTex(s) {
  return String(s || '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

async function gsNormalize(input, output, cwd) {
  await run('gs', [
    '-sDEVICE=pdfwrite',
    '-dPDFSETTINGS=/prepress',
    '-dCompatibilityLevel=1.4',
    '-dNOPAUSE', '-dBATCH', '-dQUIET',
    '-dEmbedAllFonts=true',
    '-dSubsetFonts=true',
    `-sOutputFile=${output}`,
    input,
  ], cwd);
}

/**
 * Render a book. Returns absolute paths to the generated files plus
 * page count and spine width. Caller uploads + cleans up.
 *
 * If `prepareAssets` is given, it runs after the work dir is set up
 * but before pandoc — used to drop photo files alongside book.md so
 * `\includegraphics` resolves relative paths like `photos/{id}.jpg`.
 */
export async function renderBook({ markdown, title, author, paperColor, prepareAssets }) {
  const work = await mkdtemp(join(tmpdir(), 'memoir-'));
  try {
    // 1. Write source + template.
    await writeFile(join(work, 'book.md'), markdown, 'utf8');
    await copyFile(TEMPLATE, join(work, 'template.tex'));

    // 1b. Hook for the caller to drop image files into the work dir.
    if (typeof prepareAssets === 'function') {
      await prepareAssets(work);
    }

    // 2. Pandoc -> LuaLaTeX interior. Pandoc runs the engine enough
    //    times to resolve the table of contents.
    await run('pandoc', [
      'book.md',
      '--template=template.tex',
      '--pdf-engine=lualatex',
      '-o', 'interior_raw.pdf',
    ], work);

    // 3. Ghostscript normalize (embed fonts, 300dpi images).
    await gsNormalize('interior_raw.pdf', 'interior.pdf', work);

    // 4. Page count for spine math.
    const info = await run('pdfinfo', ['interior.pdf'], work);
    const pageCount = parsePageCount(info) ?? 0;
    const thickness = PAPER_THICKNESS[paperColor] ?? PAPER_THICKNESS.cream;
    const spine = pageCount * thickness;
    const totalW = TRIM_W * 2 + spine + BLEED * 2;
    const totalH = TRIM_H + BLEED * 2;

    // 5. Cover.
    await writeFile(
      join(work, 'cover.tex'),
      coverTex({ title, author, totalW, totalH }),
      'utf8',
    );
    await run('lualatex', ['-interaction=nonstopmode', 'cover.tex'], work)
      .catch(() => {}); // cover is non-fatal; interior is the deliverable
    let coverPath = null;
    try {
      await gsNormalize('cover.pdf', 'cover_final.pdf', work);
      coverPath = join(work, 'cover_final.pdf');
    } catch { coverPath = null; }

    // 6. EPUB side-output (free, never fatal).
    let epubPath = null;
    try {
      await run('pandoc', ['book.md', '-o', 'book.epub'], work);
      epubPath = join(work, 'book.epub');
    } catch { epubPath = null; }

    return {
      workDir: work,
      interiorPath: join(work, 'interior.pdf'),
      coverPath,
      epubPath,
      pageCount,
      spineWidth: spine,
    };
  } catch (e) {
    await rm(work, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}

export async function readArtifact(path) {
  return readFile(path);
}

export async function cleanup(workDir) {
  if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
}
