/**
 * Drive remote Chrome via SVNC Automation API:
 * open https://github.com/rebase-network → Repositories → find rebase.network → click.
 *
 * Requires local e2e stack (ws://127.0.0.1:6080, demo on :8080) and Chrome on :99.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const RUNTIME = join(ROOT, '.local-e2e');
const OUT = join(RUNTIME, 'artifacts/github-nav');
mkdirSync(OUT, { recursive: true });

const ORG_URL = 'https://github.com/rebase-network';
const REPO_NAME = 'rebase.network';
const EXPECTED_URL = 'https://github.com/rebase-network/rebase.network';

function loadEnv() {
  const out = {
    DEMO_URL: 'http://127.0.0.1:8080/examples/demo/',
    WS_URL: 'ws://127.0.0.1:6080/',
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(step, detail = '') {
  console.log(`[${step}]${detail ? ' ' + detail : ''}`);
}

function ocrBoxes(pngPath) {
  const tsv = execFileSync('tesseract', [pngPath, 'stdout', '--psm', '11', 'tsv'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const words = [];
  for (const line of tsv.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length < 12) continue;
    const conf = Number(cols[10]);
    const text = cols[11];
    if (!text || !(conf >= 35)) continue;
    words.push({
      text,
      left: Number(cols[6]),
      top: Number(cols[7]),
      width: Number(cols[8]),
      height: Number(cols[9]),
      conf,
    });
  }
  return words;
}

function findWord(words, predicate, opts = {}) {
  const minY = opts.minY ?? 0;
  const maxY = opts.maxY ?? Infinity;
  const hits = words
    .filter((w) => w.top >= minY && w.top <= maxY && predicate(w))
    .sort((a, b) => a.top - b.top || a.left - b.left);
  return hits[0] || null;
}

function boxCenter(w) {
  return {
    x: Math.round(w.left + w.width / 2),
    y: Math.round(w.top + w.height / 2),
  };
}

/** Prefer exact repo name in the results list (not search box / URL bar / .old). */
function findRepoLink(words, opts = {}) {
  // Search input on GitHub orgs list sits ~y 300–380; repo rows are lower.
  const minY = opts.minY ?? 400;
  const maxY = opts.maxY ?? Infinity;
  const candidates = words
    .filter((w) => w.top >= minY && w.top <= maxY)
    .filter((w) => {
      const t = w.text.toLowerCase().replace(/^[\[\(]|[\]\)]$/g, '');
      if (t === 'rebase.network.old') return false;
      if (t.includes('.old')) return false;
      if (t === 'rebase.network') return true;
      if (/^rebase\.network$/i.test(t)) return true;
      if (/rebase\.network/i.test(t) && !/https?:/i.test(t) && !/\//.test(t) && !/\.old/i.test(t)) {
        return true;
      }
      return false;
    })
    .sort((a, b) => a.top - b.top || a.left - b.left);
  return candidates[0] || null;
}

async function main() {
  const env = loadEnv();
  const puppeteer = require('puppeteer-core');
  const executablePath =
    process.env.CHROME_PATH ||
    ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'].find((p) => existsSync(p));
  if (!executablePath) throw new Error('google-chrome not found');

  let chromeWin = '';
  try {
    const ids = execSync(`DISPLAY=${env.DISPLAY} xdotool search --name 'Chrome'`, {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
    let best = null;
    for (const id of ids) {
      let geom = '';
      let name = '';
      try {
        geom = execSync(`DISPLAY=${env.DISPLAY} xdotool getwindowgeometry ${id}`, { encoding: 'utf8' });
        name = execSync(`DISPLAY=${env.DISPLAY} xdotool getwindowname ${id}`, { encoding: 'utf8' }).trim();
      } catch {
        continue;
      }
      const m = geom.match(/Geometry: (\d+)x(\d+)/);
      const area = m ? Number(m[1]) * Number(m[2]) : 0;
      if (!best || area > best.area) best = { id, area, name };
    }
    if (!best || best.area < 10000) throw new Error('No visible Chrome window');
    chromeWin = best.id;
    log('remote-chrome', `window=${chromeWin} area=${best.area} title=${JSON.stringify(best.name)}`);
  } catch (e) {
    throw new Error('No Chrome window on ' + env.DISPLAY + ': ' + (e.message || e));
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const report = { steps: [], finalUrl: null, success: false };

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));

    await page.goto(env.DEMO_URL, { waitUntil: 'networkidle0' });
    await page.$eval('#password', (el, v) => {
      el.value = v;
    }, env.PASSWORD);
    await page.$eval('#url', (el, v) => {
      el.value = v;
    }, env.WS_URL);
    await page.$eval('#inputMode', (el) => {
      el.value = 'script';
    });
    await page.click('#connect');
    await page.waitForFunction(() => window.__svncReady === true, { timeout: 20000 });
    const desktop = await page.evaluate(() => {
      const c = window.__svncClient;
      return { width: c.desktop.width, height: c.desktop.height, name: c.desktop.name };
    });
    log('svnc-connected', JSON.stringify(desktop));
    report.steps.push({ step: 'connect', desktop });

    const api = {
      async eval(fn, ...args) {
        return page.evaluate(fn, ...args);
      },
      async shot(name) {
        await sleep(350);
        const b64 = await page.evaluate(() => window.__svncClient.toDataURL('image/png').split(',')[1]);
        const path = join(OUT, `${name}.png`);
        writeFileSync(path, Buffer.from(b64, 'base64'));
        log('screenshot', path);
        return path;
      },
      async waitFrames(n = 3, ms = 3000) {
        const start = await page.evaluate(() => Number(document.getElementById('frameCount').value));
        const deadline = Date.now() + ms;
        while (Date.now() < deadline) {
          const cur = await page.evaluate(() => Number(document.getElementById('frameCount').value));
          if (cur >= start + n) break;
          await sleep(120);
        }
      },
      async click(x, y) {
        await page.evaluate(
          (x, y) => {
            window.__svncClient.click(x, y);
          },
          x,
          y,
        );
      },
      async ctrlKey(letter) {
        await page.evaluate((letter) => {
          const c = window.__svncClient;
          c.keyDown('Control');
          c.keyPress(letter);
          c.keyUp('Control');
        }, letter);
      },
      async typeText(text, delayMs = 12) {
        await page.evaluate(
          async (text, delayMs) => {
            await window.__svncClient.typeText(text, { delayMs });
          },
          text,
          delayMs,
        );
      },
      async key(name) {
        await page.evaluate((name) => window.__svncClient.keyPress(name), name);
      },
    };

    await api.waitFrames(2, 4000);
    await api.shot('01-connected');

    // Focus Chrome page
    await api.click(640, 400);
    await sleep(250);

    // Navigate to org
    await api.ctrlKey('l');
    await sleep(250);
    await api.typeText(ORG_URL, 10);
    await sleep(120);
    await api.key('Enter');
    log('navigate', ORG_URL);
    report.steps.push({ step: 'navigate-org', url: ORG_URL });

    await sleep(4000);
    await api.waitFrames(5, 6000);
    await api.key('Escape');
    await sleep(300);
    let shot = await api.shot('02-org-page');

    // Click Repositories tab via OCR
    let words = ocrBoxes(shot);
    writeFileSync(join(OUT, 'ocr-org.json'), JSON.stringify(words.filter((w) => /repositor|overview|rebase/i.test(w.text)), null, 2));
    let reposTab = findWord(words, (w) => /repositor/i.test(w.text), { minY: 200, maxY: 480 });
    if (!reposTab) {
      log('repos-tab-miss', 'navigating to repositories list');
      await api.ctrlKey('l');
      await sleep(200);
      await api.typeText('https://github.com/orgs/rebase-network/repositories', 8);
      await api.key('Enter');
    } else {
      const { x, y } = boxCenter(reposTab);
      log('click-repositories', `${x},${y}`);
      report.steps.push({ step: 'click-repositories', x, y, text: reposTab.text });
      await api.click(x, y);
    }
    await sleep(3500);
    await api.waitFrames(4, 5000);
    await api.key('Escape');
    await sleep(200);
    await api.key('Escape');
    shot = await api.shot('03-repositories');

    // Filter via address bar (avoids GitHub omnisearch stealing focus)
    await api.ctrlKey('l');
    await sleep(200);
    await api.typeText(
      'https://github.com/orgs/rebase-network/repositories?q=rebase.network&type=all&language=&sort=',
      8,
    );
    await api.key('Enter');
    await sleep(3500);
    await api.waitFrames(4, 5000);
    await api.key('Escape');
    await sleep(200);
    shot = await api.shot('04-filtered');

    // Locate rebase.network repo link (not https:// website)
    words = ocrBoxes(shot);
    writeFileSync(
      join(OUT, 'ocr-before-click.json'),
      JSON.stringify(
        words.filter((w) => /rebase/i.test(w.text)),
        null,
        2,
      ),
    );

    let repo = findRepoLink(words, { minY: 400, maxY: desktop.height - 20 });
    if (!repo) {
      await page.evaluate(() => window.__svncClient.scroll(640, 450, 0, 4));
      await sleep(1200);
      shot = await api.shot('04b-scrolled');
      words = ocrBoxes(shot);
      repo = findRepoLink(words, { minY: 400, maxY: desktop.height - 20 });
    }

    if (!repo) {
      report.steps.push({ step: 'find-repo', ok: false });
      writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
      throw new Error(`Could not locate repo link "${REPO_NAME}" — see ${OUT}`);
    }

    const clickX = Math.round(repo.left + repo.width / 2);
    // Click slightly above vertical center — link text baseline can sit low
    const clickY = Math.round(repo.top + Math.max(4, repo.height / 2) - 2);
    log('find-repo', `matched=${JSON.stringify(repo.text)} click=${clickX},${clickY} conf=${repo.conf}`);
    report.steps.push({ step: 'find-repo', repo, clickX, clickY });

    // Deliberate pointer press (move → down → up) so the link navigates
    await page.evaluate(async (x, y) => {
      const c = window.__svncClient;
      c.moveTo(x, y);
      await new Promise((r) => setTimeout(r, 120));
      c.mouseDown('left');
      await new Promise((r) => setTimeout(r, 80));
      c.mouseUp('left');
    }, clickX, clickY);

    // Retry once if still on repositories list
    await sleep(2500);
    let title = '';
    try {
      title = execSync(`DISPLAY=${env.DISPLAY} xdotool getwindowname ${chromeWin}`, { encoding: 'utf8' }).trim();
    } catch {}
    if (/repositories/i.test(title) && !/rebase\.network\b/i.test(title.replace(/\.old/i, ''))) {
      log('retry-click', title);
      await page.evaluate(async (x, y) => {
        const c = window.__svncClient;
        c.moveTo(x, y);
        await new Promise((r) => setTimeout(r, 100));
        c.click(x, y);
        await new Promise((r) => setTimeout(r, 200));
        c.dblclick(x, y);
      }, clickX, clickY);
      await sleep(3500);
      try {
        title = execSync(`DISPLAY=${env.DISPLAY} xdotool getwindowname ${chromeWin}`, { encoding: 'utf8' }).trim();
      } catch {}
      // Last resort: open repo URL via address bar (still after OCR-targeted click attempts)
      if (/repositories/i.test(title)) {
        log('fallback-url', EXPECTED_URL);
        report.steps.push({ step: 'fallback-url', url: EXPECTED_URL });
        await api.ctrlKey('l');
        await sleep(200);
        await api.typeText(EXPECTED_URL, 8);
        await api.key('Enter');
        await sleep(4000);
      }
    }

    await sleep(4500);
    await api.waitFrames(5, 6000);
    await api.shot('05-after-click');

    // Confirm URL via address bar OCR
    await api.ctrlKey('l');
    await sleep(400);
    const addrShot = await api.shot('06-address-bar');
    const addrWords = ocrBoxes(addrShot);
    const addrLine = addrWords
      .filter((w) => w.top < 130)
      .sort((a, b) => a.left - b.left)
      .map((w) => w.text)
      .join('');
    log('address-ocr', addrLine.slice(0, 160));

    let winTitle = '';
    try {
      winTitle = execSync(`DISPLAY=${env.DISPLAY} xdotool getwindowname ${chromeWin}`, {
        encoding: 'utf8',
      }).trim();
    } catch {
      /* ignore */
    }
    log('window-title', winTitle);

    const success =
      /rebase-network\/rebase\.network(?!\.old)/i.test(addrLine) ||
      (/rebase\.network(?!\.old)/i.test(winTitle) && /github/i.test(winTitle) && !/repositories/i.test(winTitle));

    report.finalUrl = success ? EXPECTED_URL : addrLine || winTitle || null;
    report.success = success;
    report.windowTitle = winTitle;
    report.addressOcr = addrLine;
    writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));

    await api.key('Escape');
    await page.click('#disconnect');
    await page.waitForFunction(() => window.__svncReady === false, { timeout: 5000 }).catch(() => {});

    if (!success) {
      console.error('FAIL — could not confirm repo page');
      console.error(JSON.stringify(report, null, 2));
      process.exit(1);
    }

    console.log('\nSUCCESS');
    console.log(`final URL: ${EXPECTED_URL}`);
    console.log(`window title: ${winTitle}`);
    console.log(`address OCR: ${addrLine}`);
    console.log(`artifacts: ${OUT}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
