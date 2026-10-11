/** Soft-cursor state from Cursor pseudo-encoding (−239). */

import type { PixelFormat } from '../pixel-format.js';
import { bytesPerPixel, readPixel } from './pixels.js';

export type SoftCursor = {
  hotspotX: number;
  hotspotY: number;
  width: number;
  height: number;
  /** RGBA pixels (mask applied; transparent where mask bit clear). */
  rgba: Uint8ClampedArray;
};

export function decodeCursorPseudo(
  hotspotX: number,
  hotspotY: number,
  w: number,
  h: number,
  payload: Uint8Array,
  pf: PixelFormat,
): SoftCursor {
  const bpp = bytesPerPixel(pf);
  const pixelsLen = w * h * bpp;
  const maskLen = ((w + 7) >> 3) * h;
  const pixels = payload.subarray(0, pixelsLen);
  const mask = payload.subarray(pixelsLen, pixelsLen + maskLen);
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const pi = row * w + col;
      const [r, g, b] = readPixel(pixels, pi * bpp, pf);
      const maskByte = mask[row * ((w + 7) >> 3) + (col >> 3)] ?? 0;
      const bit = (maskByte >> (7 - (col & 7))) & 1;
      const di = pi * 4;
      rgba[di] = r;
      rgba[di + 1] = g;
      rgba[di + 2] = b;
      rgba[di + 3] = bit ? 255 : 0;
    }
  }
  return { hotspotX, hotspotY, width: w, height: h, rgba };
}
