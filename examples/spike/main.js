/**
 * Spike demo (plain ESM JS for static serve without bundler).
 * For production apps, import from the `svnc` package entry.
 *
 * This file mirrors AutomationSurface usage; when developing from repo root,
 * prefer importing built dist or using a bundler that resolves ../../src.
 */

import { SVNCClient } from '../../dist/index.js';

const logEl = document.getElementById('log');
const screen = document.getElementById('screen');
let client = null;

function log(msg) {
  logEl.textContent += `${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function setConnected(on) {
  document.getElementById('connect').disabled = on;
  document.getElementById('disconnect').disabled = !on;
  for (const id of ['shot', 'click', 'dbl', 'type']) {
    document.getElementById(id).disabled = !on;
  }
}

document.getElementById('connect').onclick = async () => {
  try {
    const url = document.getElementById('url').value;
    const password = document.getElementById('password').value;
    const backend = document.getElementById('backend').value;
    screen.innerHTML = '';
    if (backend === 'novnc') {
      log('novnc-legacy requires @novnc/novnc + bundler; use lean RFB in this static demo.');
      return;
    }
    client = await SVNCClient.connect(screen, {
      url,
      credentials: password ? { password } : undefined,
      viewOnly: false,
      shared: true,
      preferredEncodings: ['raw', 'tight', 'copyrect'],
    });
    client.on('frame', () => {
      /* optional: Agent can hook frame events here */
    });
    client.on('disconnect', () => {
      log('disconnected');
      setConnected(false);
    });
    log(`connected ${client.desktop.width}x${client.desktop.height} "${client.desktop.name}"`);
    setConnected(true);
  } catch (e) {
    log(`connect error: ${e}`);
    console.error(e);
  }
};

document.getElementById('disconnect').onclick = () => {
  client?.disconnect();
  client = null;
  setConnected(false);
};

document.getElementById('shot').onclick = () => {
  const snap = client.screenshot();
  log(`screenshot ${snap.width}x${snap.height} @ ${snap.timestamp}`);
  const a = document.createElement('a');
  a.href = client.toDataURL('image/png');
  a.download = `svnc-${snap.timestamp}.png`;
  a.click();
};

document.getElementById('click').onclick = () => {
  const x = Number(document.getElementById('x').value);
  const y = Number(document.getElementById('y').value);
  client.click(x, y);
  log(`click ${x},${y}`);
};

document.getElementById('dbl').onclick = () => {
  const x = Number(document.getElementById('x').value);
  const y = Number(document.getElementById('y').value);
  client.dblclick(x, y);
  log(`dblclick ${x},${y}`);
};

document.getElementById('type').onclick = async () => {
  const text = document.getElementById('text').value;
  await client.typeText(text, { delayMs: 10 });
  log(`typed ${JSON.stringify(text)}`);
};
