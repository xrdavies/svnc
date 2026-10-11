/**
 * Local e2e demo — imports built lean RFB SVNCClient from dist/.
 * Serve repo root: python3 -m http.server 8080
 */
import { SVNCClient } from '../../dist/index.js';

const $ = (id) => document.getElementById(id);
const logEl = $('log');
const screen = $('screen');
const statusEl = $('status');
const preview = $('preview');

let client = null;
let frameCount = 0;
let damageCount = 0;

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  logEl.textContent += `[${ts}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log(msg);
}

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = cls || '';
}

function setConnected(on) {
  $('connect').disabled = on;
  $('disconnect').disabled = !on;
  for (const id of [
    'move',
    'click',
    'dbl',
    'right',
    'drag',
    'scroll',
    'type',
    'keyEnter',
    'shot',
  ]) {
    $(id).disabled = !on;
  }
}

function xy() {
  return { x: Number($('x').value), y: Number($('y').value) };
}

$('clearLog').onclick = () => {
  logEl.textContent = '';
};

$('connect').onclick = async () => {
  try {
    const url = $('url').value.trim();
    const password = $('password').value;
    const viewOnly = $('viewOnly').checked;
    screen.innerHTML = '';
    frameCount = 0;
    damageCount = 0;
    $('frameCount').value = '0';
    $('damageCount').value = '0';
    setStatus('connecting…');
    const inputMode = /** @type {'human'|'script'|'mixed'} */ ($('inputMode').value);
    client = await SVNCClient.connect(screen, {
      url,
      credentials: password ? { password } : undefined,
      viewOnly,
      shared: true,
      preferredEncodings: ['raw', 'tight', 'copyrect'],
      inputMode,
      enableHumanInput: true,
    });
    client.on('frame', (payload) => {
      frameCount += 1;
      $('frameCount').value = String(frameCount);
      const list = Array.isArray(payload) ? payload : payload?.damage;
      if (Array.isArray(list)) {
        damageCount += list.length;
        $('damageCount').value = String(damageCount);
      }
    });
    client.on('disconnect', (err) => {
      log(`disconnected${err ? `: ${err}` : ''}`);
      setStatus('disconnected', 'err');
      setConnected(false);
      client = null;
      window.__svncClient = null;
      window.__svncReady = false;
    });
    client.on('error', (err) => log(`error: ${err}`));
    client.on('clipboard', (text) => log(`clipboard ← ${JSON.stringify(text)}`));
    const d = client.desktop;
    log(`connected ${d.width}x${d.height} name=${JSON.stringify(d.name)} viewOnly=${client.viewOnly} inputMode=${client.inputMode}`);
    log('human input: click the canvas to focus, then mouse/wheel/keyboard are forwarded');
    setStatus(`connected ${d.width}×${d.height} · ${client.inputMode}`, 'ok');
    setConnected(true);
    // expose for headless verify scripts
    window.__svncClient = client;
    window.__svncReady = true;
  } catch (e) {
    log(`connect error: ${e?.message || e}`);
    setStatus(`error: ${e?.message || e}`, 'err');
    console.error(e);
  }
};

$('disconnect').onclick = () => {
  client?.disconnect();
  client = null;
  window.__svncClient = null;
  window.__svncReady = false;
  setConnected(false);
  setStatus('disconnected');
};

$('move').onclick = () => {
  const { x, y } = xy();
  client.moveTo(x, y);
  log(`moveTo ${x},${y}`);
};

$('click').onclick = () => {
  const { x, y } = xy();
  client.click(x, y);
  log(`click ${x},${y}`);
};

$('dbl').onclick = () => {
  const { x, y } = xy();
  client.dblclick(x, y);
  log(`dblclick ${x},${y}`);
};

$('right').onclick = () => {
  const { x, y } = xy();
  client.click(x, y, 'right');
  log(`right-click ${x},${y}`);
};

$('drag').onclick = async () => {
  const from = xy();
  const to = { x: Number($('toX').value), y: Number($('toY').value) };
  await client.drag(from, to, { steps: 12, stepDelayMs: 16 });
  log(`drag ${from.x},${from.y} → ${to.x},${to.y}`);
};

$('scroll').onclick = () => {
  const { x, y } = xy();
  client.scroll(x, y, 0, 3);
  log(`scroll at ${x},${y} dy=3`);
};

$('type').onclick = async () => {
  const text = $('text').value;
  await client.typeText(text, { delayMs: 20 });
  log(`typeText ${JSON.stringify(text)}`);
};

$('keyEnter').onclick = () => {
  client.keyPress('Enter');
  log('keyPress Enter');
};

$('shot').onclick = () => {
  const snap = client.screenshot();
  const url = client.toDataURL('image/png');
  preview.src = url;
  preview.style.display = 'block';
  log(`screenshot ${snap.width}x${snap.height} @ ${snap.timestamp}`);
  // also offer download
  const a = document.createElement('a');
  a.href = url;
  a.download = `svnc-${snap.timestamp}.png`;
  a.click();
};

log('demo ready — connect to local websockify');
window.__svncReady = false;

$('inputMode').onchange = () => {
  if (!client) return;
  const mode = /** @type {'human'|'script'|'mixed'} */ ($('inputMode').value);
  client.inputMode = mode;
  log(`inputMode → ${mode}`);
  setStatus(`connected ${client.desktop.width}×${client.desktop.height} · ${mode}`, 'ok');
};
