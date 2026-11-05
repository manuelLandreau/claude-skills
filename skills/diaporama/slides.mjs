import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BAND = 120;
const RING = 64;
let frames = [];
let browserType;

export async function shot(page, caption) {
  browserType ??= page.context().browser()?.browserType();
  await page.evaluate(() => document.fonts.ready);
  frames.push({ png: await page.screenshot({ animations: 'disabled' }), caption });
}

export async function click(page, locator, caption, options = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`click: ${locator} has no box`);
  await page.evaluate(({ x, y, size }) => {
    const ring = document.createElement('div');
    ring.id = '__diaporama_ring';
    ring.style.cssText = `position:fixed;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;
      border:6px solid #ff2d55;border-radius:50%;background:rgba(255,45,85,.18);box-shadow:0 0 0 3px #fff;
      z-index:2147483647;pointer-events:none;box-sizing:border-box`;
    document.documentElement.appendChild(ring);
  }, { x: box.x + (options.position?.x ?? box.width / 2), y: box.y + (options.position?.y ?? box.height / 2), size: RING });
  await shot(page, caption);
  await page.evaluate(() => document.getElementById('__diaporama_ring')?.remove());
  await locator.click(options);
}

export function title(text) {
  frames.push({ title: text });
}

export async function render(out, { seconds = 3, titleSeconds = 3, fade = 0.4 } = {}) {
  if (!frames.length) throw new Error('render: nothing captured');
  if (!browserType) throw new Error('render: at least one shot() is needed');
  const dir = mkdtempSync(join(tmpdir(), 'diaporama-'));
  // A separate browser: the caller usually closed its own before rendering, and ffmpeg here has no drawtext.
  const browser = await browserType.launch().catch(() => browserType.launch({ channel: 'chrome' }));
  const page = await browser.newPage();
  const files = [];
  let width, height;
  for (const [i, f] of frames.entries()) {
    await page.setContent(`<body style="margin:0;background:#000"><img style="display:block"><div id="t"></div></body>`);
    if (f.png) {
      await page.$eval('img', (img, src) => new Promise((ok) => { img.onload = ok; img.src = src; }), `data:image/png;base64,${f.png.toString('base64')}`);
      ({ width, height } = await page.$eval('img', (img) => ({ width: img.naturalWidth, height: img.naturalHeight })));
      height += BAND;
    }
    width ??= 1440;
    height ??= 900 + BAND;
    await page.setViewportSize({ width, height });
    await page.$eval('#t', (el, { f, band }) => {
      el.textContent = f.title ?? f.caption ?? '';
      el.style.cssText = f.title
        ? 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:0 10%;text-align:center;font:600 48px/1.3 system-ui;color:#fff;background:#000'
        : `height:${band}px;display:flex;align-items:center;justify-content:center;padding:0 48px;text-align:center;font:600 34px/1.3 system-ui;color:#fff;background:#111`;
      if (f.title) document.querySelector('img').remove();
    }, { f: { title: f.title, caption: f.caption }, band: BAND });
    const file = join(dir, `${String(i).padStart(3, '0')}.png`);
    writeFileSync(file, await page.screenshot());
    files.push({ file, d: f.title ? titleSeconds : seconds });
  }
  await browser.close();

  const W = width - (width % 2);
  const H = height - (height % 2);
  const inputs = files.flatMap(({ file, d }) => ['-loop', '1', '-t', String(d), '-i', file]);
  const norm = files.map((_, i) =>
    `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,format=yuv420p[v${i}]`);
  const chain = [];
  let prev = 'v0';
  let length = files[0].d;
  for (let i = 1; i < files.length; i++) {
    const offset = length - fade;
    chain.push(`[${prev}][v${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}[x${i}]`);
    prev = `x${i}`;
    length = offset + files[i].d;
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', [...norm, ...chain].join(';'),
    '-map', `[${prev}]`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25', '-movflags', '+faststart', out], { stdio: 'inherit' });
  frames = [];
  return { out, seconds: length, slides: files.length, dir };
}
