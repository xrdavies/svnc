/**
 * Headless RFB-over-WebSocket smoke test (no DOM/canvas).
 * Verifies: WS connect, RFB version, security (VNC Auth), ServerInit, FBU raw/tight bytes.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vncEncryptChallenge } from '../../dist/rfb/d3des.js';
import { WebSocket } from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const envPath = join(ROOT, '.local-e2e/env.txt');

function loadEnv() {
  const out = {
    WS_URL: process.env.WS_URL || 'ws://127.0.0.1:6080/',
    PASSWORD: process.env.PASSWORD || 'svnc-demo',
  };
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

class Buf {
  constructor() {
    this.buf = new Uint8Array(0);
    this.waiters = [];
  }
  append(u8) {
    const n = new Uint8Array(this.buf.length + u8.length);
    n.set(this.buf);
    n.set(u8, this.buf.length);
    this.buf = n;
    for (const w of this.waiters.splice(0)) w();
  }
  async read(n) {
    while (this.buf.length < n) {
      await new Promise((r) => this.waiters.push(r));
    }
    const out = this.buf.slice(0, n);
    this.buf = this.buf.slice(n);
    return out;
  }
  async readStr(n) {
    return new TextDecoder().decode(await this.read(n));
  }
}

function u16(b, o) {
  return (b[o] << 8) | b[o + 1];
}
function u32(b, o) {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
function i32(b, o) {
  return (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
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
  const env = loadEnv();
  const url = env.WS_URL;
  const password = env.PASSWORD;
  console.log(`Connecting ${url} …`);

  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  const buf = new Buf();

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('WS open timeout')), 5000);
    ws.addEventListener('open', () => {
      clearTimeout(t);
      resolve();
    });
    ws.addEventListener('error', () => {
      clearTimeout(t);
      reject(new Error('WS error'));
    });
  });
  pass('websocket_open', url);

  ws.addEventListener('message', (ev) => {
    if (ev.data instanceof ArrayBuffer) buf.append(new Uint8Array(ev.data));
  });

  const send = (u8) => ws.send(u8);

  const ver = await buf.readStr(12);
  if (!ver.startsWith('RFB ')) throw new Error('bad version ' + ver);
  pass('rfb_version', ver.trim());
  send(new TextEncoder().encode('RFB 003.008\n'));

  const nTypes = (await buf.read(1))[0];
  const types = [...(await buf.read(nTypes))];
  pass('security_types', types.join(','));
  if (!types.includes(2)) throw new Error('VNC Auth (2) not offered');
  send(Uint8Array.of(2));

  const challenge = await buf.read(16);
  const response = vncEncryptChallenge(password, challenge);
  send(response);

  const result = u32(await buf.read(4), 0);
  if (result !== 0) throw new Error('auth failed result=' + result);
  pass('vnc_auth', 'ok');

  send(Uint8Array.of(1)); // shared
  const init = await buf.read(24);
  const width = u16(init, 0);
  const height = u16(init, 2);
  const nameLen = u32(init, 20);
  const name = new TextDecoder().decode(await buf.read(nameLen));
  pass('server_init', `${width}x${height} name=${JSON.stringify(name)}`);

  // SetEncodings: Tight, Raw, CopyRect
  const enc = new Uint8Array(4 + 3 * 4);
  enc[0] = 2; // SetEncodings
  enc[2] = 0;
  enc[3] = 3;
  const encs = [7, 0, 1]; // Tight, Raw, CopyRect
  for (let i = 0; i < encs.length; i++) {
    const v = encs[i];
    const o = 4 + i * 4;
    enc[o] = (v >> 24) & 0xff;
    enc[o + 1] = (v >> 16) & 0xff;
    enc[o + 2] = (v >> 8) & 0xff;
    enc[o + 3] = v & 0xff;
  }
  send(enc);

  // FramebufferUpdateRequest full
  const req = new Uint8Array(10);
  req[0] = 3;
  req[1] = 0;
  req[2] = 0;
  req[3] = 0;
  req[4] = 0;
  req[5] = 0;
  req[6] = (width >> 8) & 0xff;
  req[7] = width & 0xff;
  req[8] = (height >> 8) & 0xff;
  req[9] = height & 0xff;
  send(req);

  // Wait for FramebufferUpdate
  const deadline = Date.now() + 8000;
  let gotFbu = false;
  let encodingSeen = null;
  while (Date.now() < deadline && !gotFbu) {
    const type = (await buf.read(1))[0];
    if (type === 0) {
      await buf.read(1);
      const rects = u16(await buf.read(2), 0);
      for (let i = 0; i < rects; i++) {
        const hdr = await buf.read(12);
        const w = u16(hdr, 4);
        const h = u16(hdr, 6);
        const encoding = i32(hdr, 8);
        encodingSeen = encoding;
        if (encoding === 0) {
          // Raw — bpp unknown; assume 32 after we didn't set PF; x11vnc often 32
          // Read pixel format from server init was at offset 4 — bitsPerPixel at init[4]
          const bpp = init[4] / 8;
          const nbytes = w * h * bpp;
          await buf.read(nbytes);
          gotFbu = true;
          pass('framebuffer_update', `Raw ${w}x${h} bpp=${init[4]}`);
        } else if (encoding === 7) {
          // Tight — consume conservatively by reading remaining with timeout is hard;
          // mark pass if we at least got the header
          gotFbu = true;
          pass('framebuffer_update', `Tight header ${w}x${h} (payload not fully parsed in smoke)`);
          // Don't try to parse tight fully — leave connection
          break;
        } else if (encoding === 1) {
          await buf.read(4); // srcx srcy
          gotFbu = true;
          pass('framebuffer_update', `CopyRect ${w}x${h}`);
        } else {
          fail('framebuffer_update', `unexpected encoding ${encoding}`);
          gotFbu = true;
          break;
        }
      }
      break;
    } else if (type === 1) {
      await buf.read(1);
      await buf.read(2);
      const n = u16(await buf.read(2), 0);
      await buf.read(n * 6);
    } else if (type === 2) {
      // Bell
    } else if (type === 3) {
      await buf.read(3);
      const len = u32(await buf.read(4), 0);
      await buf.read(len);
    } else {
      fail('server_message', `unknown type ${type}`);
      break;
    }
  }
  if (!gotFbu) fail('framebuffer_update', 'timeout waiting for FBU');

  // PointerEvent click at 100,100
  const pe = new Uint8Array(6);
  pe[0] = 5;
  pe[1] = 1; // left down
  pe[2] = 0;
  pe[3] = 100;
  pe[4] = 0;
  pe[5] = 100;
  send(pe);
  pe[1] = 0;
  send(pe);
  pass('pointer_event_sent', 'click 100,100');

  // KeyEvent 'a'
  const ke = new Uint8Array(8);
  ke[0] = 4;
  ke[1] = 1;
  ke[2] = 0;
  ke[3] = 0;
  const keysym = 0x0061;
  ke[4] = (keysym >> 24) & 0xff;
  ke[5] = (keysym >> 16) & 0xff;
  ke[6] = (keysym >> 8) & 0xff;
  ke[7] = keysym & 0xff;
  send(ke);
  ke[1] = 0;
  send(ke);
  pass('key_event_sent', 'keysym a');

  ws.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\nProtocol verify: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
