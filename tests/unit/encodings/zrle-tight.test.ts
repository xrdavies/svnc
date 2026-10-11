import { describe, it, expect } from 'vitest';
import { deflateSync, zlibSync } from 'fflate';
import { decodeZrleTiles } from '../../../src/rfb/encodings/zrle.js';
import { applyGradientFilter } from '../../../src/rfb/encodings/tight.js';
import { TightInflatePool, ZrleInflater, inflateRawOnce, unzlibOnce } from '../../../src/rfb/inflate.js';
import { PREFERRED_PIXEL_FORMAT } from '../../../src/rfb/pixel-format.js';
import { MemoryDisplay } from '../../../src/display/memory.js';
import type { CanvasDisplay } from '../../../src/display/canvas.js';
import { decodeJpegToRgb } from '../../../src/rfb/encodings/jpeg.js';
import { encode as encodeJpeg } from 'jpeg-js';
import { decodeCursorPseudo } from '../../../src/rfb/encodings/cursor.js';
import { parseExtendedDesktopSize } from '../../../src/rfb/encodings/extended-desktop-size.js';

function makeDisplay(w = 64, h = 64): CanvasDisplay {
  const d = new MemoryDisplay();
  d.resize(w, h);
  return d as unknown as CanvasDisplay;
}

describe('inflate pool', () => {
  it('statefully inflates across chunks', () => {
    const raw = new Uint8Array(100);
    for (let i = 0; i < raw.length; i++) raw[i] = i & 0xff;
    const compressed = deflateSync(raw);
    const pool = new TightInflatePool();
    const mid = Math.floor(compressed.length / 2);
    const a = pool.inflate(0, compressed.subarray(0, mid));
    const b = pool.inflate(0, compressed.subarray(mid));
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    expect([...out]).toEqual([...raw]);
  });

  it('unzips ZRLE members', () => {
    const raw = Uint8Array.of(1, 2, 3, 4, 5);
    const z = zlibSync(raw);
    const inf = new ZrleInflater();
    expect([...inf.inflate(z)]).toEqual([...raw]);
    expect([...unzlibOnce(z)]).toEqual([...raw]);
    expect([...inflateRawOnce(deflateSync(raw))]).toEqual([...raw]);
  });
});

describe('ZRLE', () => {
  it('decodes solid tile subencoding 1', () => {
    const d = makeDisplay(4, 4);
    const data = Uint8Array.of(1, 9, 8, 7);
    decodeZrleTiles(d, 0, 0, 4, 4, data, PREFERRED_PIXEL_FORMAT);
    const img = (d as unknown as MemoryDisplay).getImageData();
    expect(img.data[0]).toBe(9);
    expect(img.data[1]).toBe(8);
    expect(img.data[2]).toBe(7);
  });
});

describe('Tight gradient', () => {
  it('reconstructs from differences', () => {
    const w = 2;
    const h = 2;
    const abs = Uint8Array.of(10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120);
    const diff = abs.slice();
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const i = (y * w + x) * 3;
        for (let c = 0; c < 3; c++) {
          const left = x > 0 ? abs[i - 3 + c]! : 0;
          const up = y > 0 ? abs[i - w * 3 + c]! : 0;
          const upleft = x > 0 && y > 0 ? abs[i - w * 3 - 3 + c]! : 0;
          let pred = left + up - upleft;
          if (pred < 0) pred = 0;
          if (pred > 255) pred = 255;
          diff[i + c] = (abs[i + c]! - pred) & 0xff;
        }
      }
    }
    applyGradientFilter(diff, w, h);
    expect([...diff]).toEqual([...abs]);
  });
});

describe('JPEG', () => {
  it('decodes a small JPEG to RGB', async () => {
    const w = 8;
    const h = 8;
    const rgba = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = 255;
      rgba[i * 4 + 1] = 0;
      rgba[i * 4 + 2] = 0;
      rgba[i * 4 + 3] = 255;
    }
    const jpeg = encodeJpeg({ data: rgba, width: w, height: h }, 90);
    const { rgb, width, height } = await decodeJpegToRgb(new Uint8Array(jpeg.data), w, h);
    expect(width).toBe(w);
    expect(height).toBe(h);
    expect(rgb.length).toBe(w * h * 3);
    expect(rgb[0]!).toBeGreaterThan(200);
    expect(rgb[1]!).toBeLessThan(40);
  });
});

describe('Cursor + ExtendedDesktopSize', () => {
  it('decodes soft cursor mask', () => {
    const w = 2;
    const h = 2;
    const pixels = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      pixels[i * 4] = 255;
      pixels[i * 4 + 1] = 255;
      pixels[i * 4 + 2] = 255;
    }
    const mask = Uint8Array.of(0b10000000, 0b00000000);
    const payload = new Uint8Array(pixels.length + mask.length);
    payload.set(pixels, 0);
    payload.set(mask, pixels.length);
    const c = decodeCursorPseudo(0, 0, w, h, payload, PREFERRED_PIXEL_FORMAT);
    expect(c.rgba[3]).toBe(255);
    expect(c.rgba[7]).toBe(0);
  });

  it('parses ExtendedDesktopSize screens', () => {
    // U8 n + 3 pad + SCREEN(16)
    const data = new Uint8Array(4 + 16);
    data[0] = 1;
    data[7] = 7; // id in big-endian at offset 4..7
    data[12] = 3;
    data[13] = 32; // width 800
    data[14] = 2;
    data[15] = 88; // height 600
    const eds = parseExtendedDesktopSize(800, 600, 0, 0, data);
    expect(eds.screens).toHaveLength(1);
    expect(eds.screens[0]!.id).toBe(7);
    expect(eds.screens[0]!.width).toBe(800);
    expect(eds.screens[0]!.height).toBe(600);
  });
});
