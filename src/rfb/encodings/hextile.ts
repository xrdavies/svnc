/** Hextile encoding decoder (RFC 6143 §7.7.4). */

import type { DamageRect } from '../../automation/types.js';
import type { CanvasDisplay } from '../../display/canvas.js';
import type { PixelFormat } from '../pixel-format.js';
import { bytesPerPixel, readPixel } from './pixels.js';

const RAW = 1;
const BACKGROUND = 2;
const FOREGROUND = 4;
const ANY_SUBRECTS = 8;
const SUBRECTS_COLOURED = 16;

export function decodeHextile(
  display: CanvasDisplay,
  x: number,
  y: number,
  w: number,
  h: number,
  data: Uint8Array,
  pf: PixelFormat,
): DamageRect {
  const bpp = bytesPerPixel(pf);
  let o = 0;
  let bg: [number, number, number] = [0, 0, 0];
  let fg: [number, number, number] = [0, 0, 0];
  let bgValid = false;
  let fgValid = false;

  for (let ty = 0; ty < h; ty += 16) {
    const th = Math.min(16, h - ty);
    for (let tx = 0; tx < w; tx += 16) {
      const tw = Math.min(16, w - tx);
      const mask = data[o++]!;
      if (mask & RAW) {
        const pixels = tw * th * bpp;
        const raw = data.subarray(o, o + pixels);
        o += pixels;
        blitRawTile(display, x + tx, y + ty, tw, th, raw, pf);
        bgValid = false;
        fgValid = false;
        continue;
      }
      if (mask & BACKGROUND) {
        const [r, g, b] = readPixel(data, o, pf);
        o += bpp;
        bg = [r, g, b];
        bgValid = true;
      }
      if (!bgValid) throw new Error('Hextile: background unspecified');
      display.fillRect(x + tx, y + ty, tw, th, bg[0], bg[1], bg[2]);

      if (mask & FOREGROUND) {
        const [r, g, b] = readPixel(data, o, pf);
        o += bpp;
        fg = [r, g, b];
        fgValid = true;
      }

      if (mask & ANY_SUBRECTS) {
        const n = data[o++]!;
        const coloured = (mask & SUBRECTS_COLOURED) !== 0;
        for (let i = 0; i < n; i++) {
          let r = fg[0];
          let g = fg[1];
          let b = fg[2];
          if (coloured) {
            [r, g, b] = readPixel(data, o, pf);
            o += bpp;
            fgValid = false;
          } else if (!fgValid) {
            throw new Error('Hextile: foreground unspecified');
          }
          const xy = data[o++]!;
          const wh = data[o++]!;
          const sx = (xy >> 4) & 0xf;
          const sy = xy & 0xf;
          const sw = ((wh >> 4) & 0xf) + 1;
          const sh = (wh & 0xf) + 1;
          display.fillRect(x + tx + sx, y + ty + sy, sw, sh, r, g, b);
        }
      }
    }
  }
  return { x, y, width: w, height: h };
}

function blitRawTile(
  display: CanvasDisplay,
  x: number,
  y: number,
  w: number,
  h: number,
  data: Uint8Array,
  pf: PixelFormat,
): void {
  const bpp = bytesPerPixel(pf);
  if (bpp === 4 && !pf.bigEndian && pf.redShift === 0 && pf.blueShift === 16) {
    display.blitRgb(x, y, w, h, data, 4, 'rgb');
    return;
  }
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = readPixel(data, i * bpp, pf);
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  display.blitRgb(x, y, w, h, rgb, 3, 'rgb');
}
