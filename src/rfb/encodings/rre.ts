/** RRE encoding decoder (RFC 6143 §7.7.3). */

import type { DamageRect } from '../../automation/types.js';
import type { CanvasDisplay } from '../../display/canvas.js';
import type { PixelFormat } from '../pixel-format.js';
import { bytesPerPixel, readPixel } from './pixels.js';

export function decodeRre(
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
  const nSub =
    (data[o]! << 24) | (data[o + 1]! << 16) | (data[o + 2]! << 8) | data[o + 3]!;
  o += 4;
  const [br, bg, bb] = readPixel(data, o, pf);
  o += bpp;
  display.fillRect(x, y, w, h, br, bg, bb);
  for (let i = 0; i < nSub; i++) {
    const [r, g, b] = readPixel(data, o, pf);
    o += bpp;
    const sx = (data[o]! << 8) | data[o + 1]!;
    const sy = (data[o + 2]! << 8) | data[o + 3]!;
    const sw = (data[o + 4]! << 8) | data[o + 5]!;
    const sh = (data[o + 6]! << 8) | data[o + 7]!;
    o += 8;
    display.fillRect(x + sx, y + sy, sw, sh, r, g, b);
  }
  return { x, y, width: w, height: h };
}
