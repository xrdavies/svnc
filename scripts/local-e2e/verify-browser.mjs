/**
 * Drive the demo page with Chrome (puppeteer-core) and exercise SVNCClient APIs.
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const RUNTIME = join(ROOT, '.local-e2e');
const OUT = join(RUNTIME, 'artifacts');
mkdirSync(OUT, { recursive: true });

function loadEnv() {
  const out = {
    DEMO_URL: 'http://127.0.0.1:8080/examples/demo/',
    PASSWORD: 'svnc-demo',
    DISPLAY: ':99',
  };
  const envPath = join(RUNTIME, 'env.txt');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

async function main() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    console.error('puppeteer-core missing; run: npm i -D puppeteer-core');
    process.exit(2);
  }

  const env = loadEnv();
  const executablePath =
    process.env.CHROME_PATH ||
    ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'].find((p) => existsSync(p));
  if (!executablePath) {
    fail('chrome', 'google-chrome not found');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[page]', msg.text());
    });
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));

    await page.goto(env.DEMO_URL, { waitUntil: 'networkidle0' });
    pass('demo_load', env.DEMO_URL);

    await page.$eval('#password', (el, v) => {
      el.value = v;
    }, env.PASSWORD);

    await page.click('#connect');

    await page.waitForFunction(() => window.__svncReady === true, { timeout: 15000 });
    const desktop = await page.evaluate(() => {
      const c = window.__svncClient;
      return { width: c.desktop.width, height: c.desktop.height, name: c.desktop.name, viewOnly: c.viewOnly };
    });
    pass('svnc_connect', JSON.stringify(desktop));
    if (desktop.viewOnly) fail('viewOnly', 'expected false');
    else pass('non_viewOnly', 'false');

    // Wait for at least one frame
    await page.waitForFunction(() => Number(document.getElementById('frameCount').value) >= 1, {
      timeout: 10000,
    });
    const frames = await page.$eval('#frameCount', (el) => el.value);
    pass('frame_events', `count=${frames}`);

    // Screenshot API
    const shot = await page.evaluate(async () => {
      const c = window.__svncClient;
      const snap = c.screenshot();
      const dataUrl = c.toDataURL('image/png');
      return { width: snap.width, height: snap.height, dataUrlLen: dataUrl.length, prefix: dataUrl.slice(0, 30) };
    });
    if (shot.width > 0 && shot.dataUrlLen > 100 && shot.prefix.startsWith('data:image/png')) {
      pass('screenshot', `${shot.width}x${shot.height} dataUrlLen=${shot.dataUrlLen}`);
      // save png bytes
      const b64 = await page.evaluate(() => window.__svncClient.toDataURL('image/png').split(',')[1]);
      writeFileSync(join(OUT, 'screenshot.png'), Buffer.from(b64, 'base64'));
    } else {
      fail('screenshot', JSON.stringify(shot));
    }

    // Sample a center pixel color (root was #336699)
    const pixel = await page.evaluate(() => {
      const c = window.__svncClient;
      const snap = c.screenshot();
      const { width, height, imageData } = snap;
      const x = Math.floor(width / 2);
      const y = Math.floor(height / 2);
      const i = (y * width + x) * 4;
      return { x, y, r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2], a: imageData.data[i + 3] };
    });
    // #336699 -> r=51 g=102 b=153 — allow some tolerance after encoding
    const near =
      Math.abs(pixel.r - 51) < 40 && Math.abs(pixel.g - 102) < 40 && Math.abs(pixel.b - 153) < 40;
    if (near) pass('framebuffer_color', JSON.stringify(pixel));
    else fail('framebuffer_color', `expected near #336699 got ${JSON.stringify(pixel)}`);

    // moveTo + click — verify X pointer via xdotool on DISPLAY
    await page.evaluate(async () => {
      const c = window.__svncClient;
      c.moveTo(320, 240);
      c.click(320, 240);
    });
    pass('click_api', '320,240');
    await new Promise((r) => setTimeout(r, 300));

    try {
      const loc = execSync(`DISPLAY=${env.DISPLAY} xdotool getmouselocation --shell`, {
        encoding: 'utf8',
      });
      const mx = Number((loc.match(/^X=(\d+)/m) || [])[1]);
      const my = Number((loc.match(/^Y=(\d+)/m) || [])[1]);
      if (Math.abs(mx - 320) <= 5 && Math.abs(my - 240) <= 5) {
        pass('x11_pointer_follows_click', `X=${mx} Y=${my}`);
      } else {
        fail('x11_pointer_follows_click', `expected ~320,240 got X=${mx} Y=${my} raw=${loc.trim()}`);
      }
    } catch (e) {
      fail('x11_pointer_follows_click', String(e.message || e));
    }

    // typeText
    await page.evaluate(async () => {
      await window.__svncClient.typeText('Svnc', { delayMs: 5 });
    });
    pass('typeText_api', 'Svnc');

    // drag
    await page.evaluate(async () => {
      await window.__svncClient.drag({ x: 100, y: 100 }, { x: 220, y: 180 }, { steps: 8, stepDelayMs: 5 });
    });
    pass('drag_api', '100,100 -> 220,180');
    await new Promise((r) => setTimeout(r, 300));

    try {
      const loc2 = execSync(`DISPLAY=${env.DISPLAY} xdotool getmouselocation --shell`, {
        encoding: 'utf8',
      });
      const mx = Number((loc2.match(/^X=(\d+)/m) || [])[1]);
      const my = Number((loc2.match(/^Y=(\d+)/m) || [])[1]);
      if (Math.abs(mx - 220) <= 8 && Math.abs(my - 180) <= 8) {
        pass('x11_pointer_after_drag', `X=${mx} Y=${my}`);
      } else {
        fail('x11_pointer_after_drag', `expected ~220,180 got X=${mx} Y=${my}`);
      }
    } catch (e) {
      fail('x11_pointer_after_drag', String(e.message || e));
    }

    // scroll (best-effort — just ensure no throw)
    await page.evaluate(() => {
      window.__svncClient.scroll(200, 200, 0, 2);
    });
    pass('scroll_api', 'dy=2');

    // page screenshot of demo UI
    await page.screenshot({ path: join(OUT, 'demo-ui.png'), fullPage: true });
    pass('demo_ui_screenshot', join(OUT, 'demo-ui.png'));

    await page.click('#disconnect');
    await page.waitForFunction(() => window.__svncReady === false, { timeout: 5000 });
    pass('disconnect', 'ok');
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    passed: results.filter((r) => r.ok).length,
    failed: failed.length,
    results,
  };
  writeFileSync(join(OUT, 'browser-verify.json'), JSON.stringify(summary, null, 2));
  console.log(`\nBrowser verify: ${summary.passed}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
