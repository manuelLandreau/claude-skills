---
name: diaporama
description: Use when a product demo must be a readable, smooth video rather than a screen recording, when a filmed demo looks choppy or rushed (low frame rate, sped-up gestures, animated cursor), or when a demo mp4 is needed from a Playwright script with one screenshot per step, French captions and title cards.
---

# Diaporama

A slideshow demo: one still per step, a ring where the click lands, a caption band under the image, short fades, a 3 s black title card per part. No cursor animation, no frame-rate issues. The Playwright script is the scenario: no YAML, no runner.

`slides.mjs` (next to this file) exports four helpers:

| Helper | Does |
|---|---|
| `shot(page, caption)` | screenshot of the viewport, captioned |
| `click(page, locator, caption, opts?)` | ring where the click lands (`opts.position`, else the centre), screenshot, ring removed, then the real `locator.click(opts)` |
| `title(text)` | black title card |
| `render(out, { seconds = 3, titleSeconds = 3, fade = 0.4 })` | composes captions in a headless browser, builds the mp4 with ffmpeg (`xfade`), returns `{ out, seconds, slides }` |

Needs `playwright-core` (no new dependency: point `createRequire` at an existing install) and `ffmpeg` with `libx264`. Captions are drawn in HTML because Homebrew's ffmpeg has no `drawtext`.

## Example

```js
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const { shot, click, title, render } = await import(`${homedir()}/.claude/skills/diaporama/slides.mjs`);
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE);

const browser = await chromium.launch({ channel: 'chrome' }); // headless by default
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
title('L’agent annule l’échange');
await page.goto('https://back-office.example.com/users/42/show');
await click(page, page.getByRole('tab', { name: 'Exchanges' }), 'Fiche du membre');
await page.getByRole('row', { name: /220/ }).waitFor();
await shot(page, 'L’échange 220 est finalisé');
await click(page, page.getByRole('button', { name: 'Cancel' }), 'J’annule');
await page.getByText('Canceled').waitFor();
await shot(page, 'L’échange est annulé');
await browser.close();
console.log(await render('demo.mp4', { seconds: 3.5 }));
```

## Render

```sh
PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node demo.mjs
ffprobe -v error -show_entries format=duration -of csv=p=0 demo.mp4
ffmpeg -ss 5 -i demo.mp4 -frames:v 1 frame.png   # then look at 3 or 4 frames
```

## Traps

- Close modals, toasts, cookie banners and onboarding tours before the `shot`, unless the toast is the point of the step. Hide banners with `page.addStyleTag`; dismiss a tour off-camera, and stub its POST if dismissing it writes to the account.
- Wait for the screen to be stable: `waitFor` the text the step proves, not a timeout. `shot` already waits for fonts and freezes CSS animations.
- A ring over the text the slide proves hides it: pass `{ position: { x, y } }` to click on a quieter spot (an avatar, an icon).
- `click` screenshots *before* clicking: the caption of a click describes the intent, the next `shot` shows the result.
- Headless by default. A visible window steals the user's focus.
- One viewport size for the whole film: slides of another size are letterboxed.
- The caption band is 120 px: keep captions to one or two lines.
