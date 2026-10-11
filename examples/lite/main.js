/**
 * SVNC Lite — minimal connect + display + human input (no Automation panel).
 */
import { SVNCClient } from '../../dist/index.js';

const screen = document.getElementById('screen');
const statusEl = document.getElementById('status');
const connectBtn = document.getElementById('connect');
const disconnectBtn = document.getElementById('disconnect');

let client = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function setConnected(on) {
  connectBtn.disabled = on;
  disconnectBtn.disabled = !on;
}

connectBtn.addEventListener('click', async () => {
  if (client) return;
  const url = document.getElementById('url').value.trim();
  const password = document.getElementById('password').value;
  setStatus('connecting…');
  try {
    client = await SVNCClient.connect(screen, {
      url,
      credentials: password ? { password } : undefined,
      viewOnly: false,
      inputMode: 'mixed',
    });
    setConnected(true);
    const d = client.desktop;
    setStatus(
      d ? `connected ${d.width}×${d.height}` : 'connected',
    );
    client.on('disconnect', () => {
      client = null;
      setConnected(false);
      setStatus('disconnected');
    });
  } catch (err) {
    client = null;
    setConnected(false);
    setStatus(`error: ${err?.message || err}`);
  }
});

disconnectBtn.addEventListener('click', () => {
  client?.disconnect();
  client = null;
  setConnected(false);
  setStatus('disconnected');
});
