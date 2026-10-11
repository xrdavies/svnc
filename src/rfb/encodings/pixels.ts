/** Shared pixel helpers for rectangle encodings. */

import type { PixelFormat } from '../pixel-format.js';
import { pixelToRgb } from '../pixel-format.js';

export function bytesPerPixel(pf: PixelFormat): number {
  return pf.bitsPerPixel / 8;
}

/** CPIXEL size for TRLE/ZRLE (3 bytes when 32bpp depth≤24 true-colour). */
export function bytesPerCPixel(pf: PixelFormat): number {
  if (pf.trueColour && pf.bitsPerPixel === 32 && pf.depth <= 24) return 3;
  return bytesPerPixel(pf);
}

export function readPixel(buf: Uint8Array, offset: number, pf: PixelFormat): [number, number, number, number] {
  const bpp = bytesPerPixel(pf);
  let pixel = 0;
  if (bpp === 4) {
    pixel = pf.bigEndian
      ? (buf[offset]! << 24) | (buf[offset + 1]! << 16) | (buf[offset + 2]! << 8) | buf[offset + 3]!
      : buf[offset]! | (buf[offset + 1]! << 8) | (buf[offset + 2]! << 16) | (buf[offset + 3]! << 24);
  } else if (bpp === 2) {
    pixel = pf.bigEndian
      ? (buf[offset]! << 8) | buf[offset + 1]!
      : buf[offset]! | (buf[offset + 1]! << 8);
  } else {
    pixel = buf[offset]!;
  }
  const [r, g, b] = pixelToRgb(pixel >>> 0, pf);
  return [r, g, b, bpp];
}

export function readCPixel(buf: Uint8Array, offset: number, pf: PixelFormat): [number, number, number, number] {
  const cpp = bytesPerCPixel(pf);
  if (cpp === 3) {
    // Prefer little-endian RGB layout of PREFERRED_PIXEL_FORMAT
    if (!pf.bigEndian && pf.redShift === 0) {
      return [buf[offset]!, buf[offset + 1]!, buf[offset + 2]!, 3];
    }
    if (!pf.bigEndian && pf.blueShift === 0) {
      return [buf[offset + 2]!, buf[offset + 1]!, buf[offset]!, 3];
    }
    // Generic: treat as low 24 bits of little-endian 32bpp
    const pixel = buf[offset]! | (buf[offset + 1]! << 8) | (buf[offset + 2]! << 16);
    const [r, g, b] = pixelToRgb(pixel, pf);
    return [r, g, b, 3];
  }
  return readPixel(buf, offset, pf);
}

export function pixelToRgb888(buf: Uint8Array, offset: number, pf: PixelFormat): [number, number, number] {
  const [r, g, b] = readPixel(buf, offset, pf);
  return [r, g, b];
}
