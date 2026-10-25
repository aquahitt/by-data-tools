// README media: demo.gif, light/dark screenshots and the social preview, taken from the production build.
// Run with `npm run media` (builds first). Needs Google Chrome installed; playwright-core drives it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import gifenc from 'gifenc';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { preview } from 'vite';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const OUT = fileURLToPath(new URL('../../docs/media/', import.meta.url));
const SOCIAL = new URL('./social.html', import.meta.url).href;
const GIF_SIZE = { width: 1200, height: 740 };

mkdirSync(OUT, { recursive: true });
const server = await preview({ preview: { port: 0, open: false }, logLevel: 'warn' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chrome' });

// ---------- demo.gif ----------

const CURSOR = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 11-7 1.2 4 7.3-3 1.5-4-7.4L4 20z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

// Headless Chrome draws no pointer; a fake one shows where the clicks go.
async function installCursor(page) {
  await page.evaluate((svg) => {
    if (document.getElementById('demo-cursor')) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.innerHTML = svg;
    Object.assign(c.style, { position: 'fixed', left: '900px', top: '500px', zIndex: 99999, pointerEvents: 'none' });
    document.body.append(c);
  }, CURSOR);
}

function recorder(page) {
  const frames = [];
  let pos = { x: 900, y: 500 };
  const rec = {
    frames,
    async snap(delay) {
      // Clicks scroll fields into view; every scene fits the frame, so keep the page at the top.
      await page.evaluate(
        () =>
          new Promise((done) => {
            window.scrollTo(0, 0);
            requestAnimationFrame(() => requestAnimationFrame(done));
          }),
      );
      frames.push({ buf: await page.screenshot({ clip: { x: 0, y: 0, ...GIF_SIZE } }), delay });
    },
    hold(ms) {
      frames[frames.length - 1].delay += ms;
    },
    async moveTo(locator, steps = 7) {
      const box = await locator.boundingBox();
      const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        const xy = [pos.x + (target.x - pos.x) * e, pos.y + (target.y - pos.y) * e];
        await page.evaluate(([x, y]) => {
          const c = document.getElementById('demo-cursor');
          c.style.left = `${x}px`;
          c.style.top = `${y}px`;
        }, xy);
        await rec.snap(40);
      }
      pos = target;
    },
    async click(locator) {
      await rec.moveTo(locator);
      await locator.click();
      await page.waitForTimeout(250);
      await rec.snap(80);
    },
    async type(locator, text, perSnap = 2) {
      await locator.click();
      for (let i = 0; i < text.length; i += perSnap) {
        await page.keyboard.type(text.slice(i, i + perSnap));
        await rec.snap(70);
      }
    },
  };
  return rec;
}

// Each frame after the first marks unchanged pixels transparent, so only what moved is stored.
function encodeGif(frames) {
  const gif = GIFEncoder();
  let prev = null;
  for (const [n, f] of frames.entries()) {
    const { width, height, data } = PNG.sync.read(f.buf);
    const palette = quantize(data, 255, { format: 'rgb444' });
    const index = applyPalette(data, palette, 'rgb444');
    palette.push([255, 0, 255]);
    const transparentIndex = palette.length - 1;
    if (prev) {
      for (let p = 0, i = 0; p < index.length; p++, i += 4) {
        if (data[i] === prev[i] && data[i + 1] === prev[i + 1] && data[i + 2] === prev[i + 2]) index[p] = transparentIndex;
      }
    }
    gif.writeFrame(index, width, height, { palette, delay: f.delay, transparent: n > 0, transparentIndex, dispose: 1, repeat: 0 });
    prev = data;
  }
  gif.finish();
  return gif.bytes();
}

{
  // Taller than any page, so nothing scrolls: viewport screenshots of a scrollable page came out offset after
  // focusing a field. Frames are clipped to GIF_SIZE.
  const page = await browser.newPage({ viewport: { width: GIF_SIZE.width, height: 2000 }, colorScheme: 'light' });
  await page.goto(`${base}#/personal-number`);
  await page.waitForTimeout(800);
  await installCursor(page);
  const r = recorder(page);
  await r.snap(900);

  // A typo in the check digit is caught with its position.
  const input = page.getByRole('textbox', { name: 'Идентификационный номер' });
  await r.moveTo(input);
  await r.type(input, '7616637A246PB3');
  const check = page.getByRole('button', { name: 'Проверить', exact: true }).first();
  await r.click(check);
  r.hold(1800);

  // Fixed: valid, every group explained. locator.press() leaves the page offset in screenshots; click instead.
  await input.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await r.snap(150);
  await page.keyboard.type('0');
  await r.snap(150);
  await r.click(check);
  r.hold(2200);

  // Consistent test people.
  await r.click(page.getByRole('link', { name: 'Тестовая персона' }));
  await page.waitForTimeout(300);
  const count = page.locator('md-outlined-text-field[label^="Количество"] input');
  await r.moveTo(count);
  await count.fill('5');
  await r.snap(250);
  await r.click(page.getByRole('button', { name: 'Сгенерировать' }));
  r.hold(2600);

  // IBAN with a bank from the NBRB directory, checked from the generator.
  await r.click(page.getByRole('link', { name: 'IBAN / номер счёта' }));
  await page.waitForTimeout(300);
  await r.click(page.getByRole('button', { name: 'Сгенерировать' }));
  r.hold(600);
  await r.click(page.getByRole('button', { name: 'Проверить', exact: true }).last());
  r.hold(2700);

  writeFileSync(`${OUT}demo.gif`, encodeGif(r.frames));
  await page.close();
}

// ---------- screenshots, light and dark ----------

// Four generated numbers, one with separators and lower case, three with typical mistakes.
async function bulkList(page) {
  await page.locator('md-outlined-text-field[label="Сколько"] input').fill('4');
  await page.getByRole('button', { name: 'Сгенерировать' }).click();
  await page.waitForTimeout(200);
  const [a, b, c, d] = (await page.locator('.generated-list').innerText()).match(/7\d{6}[A-Z]\d{3}PB\d/g);
  return [
    a,
    b.toLowerCase().replace(/^(\d{7})(.)(\d{3})/, '$1-$2-$3-'),
    c.slice(0, 13) + String((Number(c[13]) + 3) % 10),
    d.replace('PB', 'BP'),
    `${a.slice(0, 7)}Z${a.slice(8)}`,
  ].join('\n');
}

for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme });
  const card = (id) => page.locator(`section[aria-labelledby="${id}"]`);
  const check = () => page.getByRole('button', { name: 'Проверить', exact: true }).first().click();

  await page.goto(`${base}#/iban`);
  await page.waitForTimeout(600);
  await page.getByRole('textbox', { name: 'IBAN или номер счёта' }).fill('BY15BLBB30137753158928775643');
  await check();
  await page.waitForTimeout(300);
  await card('iban-validate').screenshot({ path: `${OUT}iban-${scheme}.png` });

  await page.goto(`${base}#/name`);
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: /Фамилия/ }).fill('Ковалёв Сергей Иванович');
  await check();
  await page.waitForTimeout(300);
  await card('name-validate').screenshot({ path: `${OUT}name-${scheme}.png` });

  await page.goto(`${base}#/personal-number`);
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: /одному в строке/ }).fill(await bulkList(page));
  await page.getByRole('button', { name: 'Проверить список' }).click();
  await page.waitForTimeout(300);
  await card('personal-number-bulk').screenshot({ path: `${OUT}bulk-${scheme}.png` });
  await page.close();
}

// ---------- social preview: uses iban-light.png from above ----------

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await page.goto(SOCIAL);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}social-preview.png` });
  await page.close();
}

await browser.close();
await server.close();
console.log(`README media written to ${OUT}`);
