/** ZRLE encoding decoder (RFC 6143 §7.7.6) — TRLE tiles @ 64×64 inside zlib. */

import type { DamageRect } from '../../automation/types.js';
import type { CanvasDisplay } from '../../display/canvas.js';
import type { PixelFormat } from '../pixel-format.js';
import { bytesPerCPixel, readCPixel } from './pixels.js';

export function decodeZrleTiles(
  display: CanvasDisplay,
  x: number,
  y: number,
  w: number,
  h: number,
  data: Uint8Array,
  pf: PixelFormat,
): DamageRect {
  let o = 0;

  for (let ty = 0; ty < h; ty += 64) {
    const th = Math.min(64, h - ty);
    for (let tx = 0; tx < w; tx += 64) {
      const tw = Math.min(64, w - tx);
      const sub = data[o++]!;
      o = decodeTrleTile(display, x + tx, y + ty, tw, th, data, o, sub, pf);
    }
  }
  return { x, y, width: w, height: h };
}

function decodeTrleTile(
  display: CanvasDisplay,
  x: number,
  y: number,
  w: number,
  h: number,
  data: Uint8Array,
  o: number,
  sub: number,
  pf: PixelFormat,
): number {
  const cpp = bytesPerCPixel(pf);

  if (sub === 0) {
    const n = w * h * cpp;
    blitCPixels(display, x, y, w, h, data.subarray(o, o + n), pf, cpp);
    return o + n;
  }
  if (sub === 1) {
    const [r, g, b] = readCPixel(data, o, pf);
    display.fillRect(x, y, w, h, r, g, b);
    return o + cpp;
  }
  if (sub >= 2 && sub <= 16) {
    const paletteSize = sub;
    const palette: Array<[number, number, number]> = [];
    for (let i = 0; i < paletteSize; i++) {
      palette.push(readCPixel(data, o, pf).slice(0, 3) as [number, number, number]);
      o += cpp;
    }
    const bits = paletteSize === 2 ? 1 : paletteSize <= 4 ? 2 : 4;
    const rgb = new Uint8Array(w * h * 3);
    for (let row = 0; row < h; row++) {
      let bit = 0;
      let byte = 0;
      for (let col = 0; col < w; col++) {
        if (bit === 0) {
          byte = data[o++]!;
          bit = 8;
        }
        bit -= bits;
        const idx = (byte >> bit) & ((1 << bits) - 1);
        const [r, g, b] = palette[idx] ?? palette[0]!;
        const di = (row * w + col) * 3;
        rgb[di] = r;
        rgb[di + 1] = g;
        rgb[di + 2] = b;
      }
      // pad row to whole bytes
      bit = 0;
    }
    display.blitRgb(x, y, w, h, rgb, 3, 'rgb');
    return o;
  }
  if (sub === 128) {
    let pixels = 0;
    const total = w * h;
    const rgb = new Uint8Array(total * 3);
    while (pixels < total) {
      const [r, g, b] = readCPixel(data, o, pf);
      o += cpp;
      let len = 1;
      let more: number;
      do {
        more = data[o++]!;
        len += more;
      } while (more === 255);
      for (let i = 0; i < len && pixels < total; i++, pixels++) {
        const di = pixels * 3;
        rgb[di] = r;
        rgb[di + 1] = g;
        rgb[di + 2] = b;
      }
    }
    display.blitRgb(x, y, w, h, rgb, 3, 'rgb');
    return o;
  }
  if (sub >= 130 && sub <= 255) {
    const paletteSize = sub - 128;
    const palette: Array<[number, number, number]> = [];
    for (let i = 0; i < paletteSize; i++) {
      palette.push(readCPixel(data, o, pf).slice(0, 3) as [number, number, number]);
      o += cpp;
    }
    let pixels = 0;
    const total = w * h;
    const rgb = new Uint8Array(total * 3);
    while (pixels < total) {
      const idxByte = data[o++]!;
      let len = 1;
      let idx: number;
      if (idxByte & 0x80) {
        idx = idxByte & 0x7f;
        let more: number;
        do {
          more = data[o++]!;
          len += more;
        } while (more === 255);
      } else {
        idx = idxByte;
      }
      const [r, g, b] = palette[idx] ?? palette[0]!;
      for (let i = 0; i < len && pixels < total; i++, pixels++) {
        const di = pixels * 3;
        rgb[di] = r;
        rgb[di + 1] = g;
        rgb[di + 2] = b;
      }
    }
    display.blitRgb(x, y, w, h, rgb, 3, 'rgb');
    return o;
  }
  throw new Error(`ZRLE unsupported subencoding ${sub}`);
}

function blitCPixels(
  display: CanvasDisplay,
  x: number,
  y: number,
  w: number,
  h: number,
  data: Uint8Array,
  pf: PixelFormat,
  cpp: number,
): void {
  if (cpp === 3 && !pf.bigEndian && pf.redShift === 0) {
    display.blitRgb(x, y, w, h, data, 3, 'rgb');
    return;
  }
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = readCPixel(data, i * cpp, pf);
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  display.blitRgb(x, y, w, h, rgb, 3, 'rgb');
}
