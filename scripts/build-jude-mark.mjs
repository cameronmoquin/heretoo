/**
 * Rasterise the Jude-a-phone brand marks to PNG.
 *
 *   node scripts/build-jude-mark.mjs
 *
 * Why PNGs rather than SVG components: react-native-svg is not a dependency,
 * and adding it is a native module — meaning a full rebuild and a cable rather
 * than an over-the-air update. PNG assets ship inside an `eas update`, so the
 * mascot can land on a provisioned phone without touching it.
 *
 * Both marks render as solid black on transparent. The app applies tintColor,
 * so one asset serves both palettes instead of shipping a light and a dark
 * copy that then have to be kept in sync.
 *
 * Metro resolves @2x/@3x by filename convention, so a 56pt monster needs
 * 56/112/168px files named monster.png, monster@2x.png, monster@3x.png.
 */

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = join(root, 'assets', 'brand');

// Syne ExtraBold, SIL OFL, already vendored as a font dependency.
const SYNE = join(
  root,
  'node_modules',
  '@expo-google-fonts',
  'syne',
  '800ExtraBold',
  'Syne_800ExtraBold.ttf'
);

if (!existsSync(SYNE)) {
  console.error('Syne ExtraBold not found at', SYNE);
  process.exit(1);
}

/** @param {string} name @param {number[]} widths */
function render(name, widths) {
  const svg = readFileSync(join(brand, `${name}.svg`), 'utf8');

  widths.forEach((w, i) => {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: w },
      background: 'rgba(0,0,0,0)',
      font: {
        fontFiles: [SYNE],
        loadSystemFonts: false, // deterministic across machines
        defaultFontFamily: 'Syne',
      },
    });

    const png = resvg.render().asPng();
    const suffix = i === 0 ? '' : `@${i + 1}x`;
    const out = join(brand, `${name}${suffix}.png`);
    writeFileSync(out, png);
    console.log(`  ${name}${suffix}.png  ${w}px  ${(png.length / 1024).toFixed(1)} KB`);
  });
}

mkdirSync(brand, { recursive: true });

console.log('monster:');
render('jude-monster', [56, 112, 168]);

// 8.3:1 aspect. On a 375pt screen the header has ~259pt free beside a 56pt
// monster, so 230pt wide lands the cap height near the `title` step.
console.log('wordmark:');
render('jude-wordmark', [230, 460, 690]);

console.log('\ndone.');
