/**
 * Tight encoding (type 7): fill, JPEG, basic copy / palette / gradient + zlib streams.
 */

import type { DamageRect } from '../../automation/types.js';
import type { CanvasDisplay } from '../../display/canvas.js';
import type { PixelFormat } from '../pixel-format.js';
import type { TightInflatePool } from '../inflate.js';
import { decodeJpegToRgb } from './jpeg.js';

export type TightRead = {
  read: (n: number) => Promise<Uint8Array>;
};

export async function readCompactLength(read: (n: number) => Promise<Uint8Array>): Promise<number> {
  const b0 = (await read(1))[0]!;
  let len = b0 & 0x7f;
  if (b0 & 0x80) {
    const b1 = (await read(1))[0]!;
    len |= (b1 & 0x7f) << 7;
    if (b1 & 0x80) {
      const b2 = (await read(1))[0]!;
      len |= b2 << 14;
    }
  }
  return len;
}

/**
 * Apply Tight gradient filter in-place on RGB888 differences → absolute intensities.
 */
export function applyGradientFilter(rgb: Uint8Array, w: number, h: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) {
        const left = x > 0 ? rgb[i - 3 + c]! : 0;
        const up = y > 0 ? rgb[i - w * 3 + c]! : 0;
        const upleft = x > 0 && y > 0 ? rgb[i - w * 3 - 3 + c]! : 0;
        let pred = left + up - upleft;
        if (pred < 0) pred = 0;
        if (pred > 255) pred = 255;
        rgb[i + c] = (rgb[i + c]! + pred) & 0xff;
      }
    }
  }
}

export async function decodeTightRect(
  display: CanvasDisplay,
  x: number,
  y: number,
  w: number,
  h: number,
  read: (n: number) => Promise<Uint8Array>,
  pf: PixelFormat,
  inflate: TightInflatePool,
): Promise<DamageRect> {
  const compControl = (await read(1))[0]!;
  for (let i = 0; i < 4; i++) {
    if (compControl & (1 << i)) inflate.reset(i);
  }

  // Fill
  if ((compControl & 0xf0) === 0x80) {
    const bpp = Math.min(3, pf.bitsPerPixel / 8);
    const color = await read(bpp === 4 ? 3 : bpp);
    return display.fillRect(x, y, w, h, color[0]!, color[1] ?? 0, color[2] ?? 0);
  }

  // JPEG
  if ((compControl & 0xf0) === 0x90) {
    const len = await readCompactLength(read);
    const jpeg = await read(len);
    try {
      const { rgb, width: jw, height: jh } = await decodeJpegToRgb(jpeg, w, h);
      return display.blitRgb(x, y, jw || w, jh || h, rgb, 3, 'rgb');
    } catch (err) {
      // Keep session alive; caller may re-advertise Raw after seeing this damage no-op
      console.warn('[svnc] Tight JPEG decode failed', err);
      return { x, y, width: w, height: h };
    }
  }

  let filterId = 0;
  let palette: Array<[number, number, number]> | null = null;
  if (compControl & 0x40) {
    filterId = (await read(1))[0]!;
    if (filterId === 1) {
      const paletteSize = (await read(1))[0]! + 1;
      palette = [];
      for (let i = 0; i < paletteSize; i++) {
        const c = await read(3);
        palette.push([c[0]!, c[1]!, c[2]!]);
      }
    }
  }

  let expected = w * h * 3;
  if (filterId === 1 && palette) {
    expected = palette.length === 2 ? ((w + 7) >> 3) * h : w * h;
  }

  const len = await readCompactLength(read);
  let raw = await read(len);
  const noZlib = ((compControl >> 4) & 0x0f) === 0x0a;
  if (!noZlib && len !== expected) {
    const streamId = compControl & 0x03;
    raw = inflate.inflate(streamId, raw);
  }

  if (filterId === 0) {
    return display.blitRgb(x, y, w, h, raw, 3, 'rgb');
  }

  if (filterId === 1 && palette) {
    const rgb = new Uint8Array(w * h * 3);
    if (palette.length === 2) {
      let src = 0;
      for (let row = 0; row < h; row++) {
        let bit = 0;
        let byte = 0;
        for (let col = 0; col < w; col++) {
          if (bit === 0) {
            byte = raw[src++] ?? 0;
            bit = 8;
          }
          bit--;
          const idx = (byte >> bit) & 1;
          const [r, g, b] = palette[idx]!;
          const di = (row * w + col) * 3;
          rgb[di] = r;
          rgb[di + 1] = g;
          rgb[di + 2] = b;
        }
      }
    } else {
      for (let i = 0; i < w * h; i++) {
        const idx = raw[i] ?? 0;
        const [r, g, b] = palette[idx] ?? palette[0]!;
        rgb[i * 3] = r;
        rgb[i * 3 + 1] = g;
        rgb[i * 3 + 2] = b;
      }
    }
    return display.blitRgb(x, y, w, h, rgb, 3, 'rgb');
  }

  if (filterId === 2) {
    // Gradient: differences then reconstruct
    const rgb = raw.byteLength >= w * h * 3 ? raw.slice(0, w * h * 3) : raw;
    if (rgb.byteLength < w * h * 3) {
      throw new Error(`Tight gradient data short: ${rgb.byteLength}`);
    }
    const copy = rgb.slice();
    applyGradientFilter(copy, w, h);
    return display.blitRgb(x, y, w, h, copy, 3, 'rgb');
  }

  throw new Error(`Tight filter ${filterId} not implemented`);
}
