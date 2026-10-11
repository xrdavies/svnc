/** True-colour 24/32-bit pixel format helpers. */

export type PixelFormat = {
  bitsPerPixel: number;
  depth: number;
  bigEndian: boolean;
  trueColour: boolean;
  redMax: number;
  greenMax: number;
  blueMax: number;
  redShift: number;
  greenShift: number;
  blueShift: number;
};

/** Prefer 32bpp little-endian RGB888 in low 24 bits (common browser path). */
export const PREFERRED_PIXEL_FORMAT: PixelFormat = {
  bitsPerPixel: 32,
  depth: 24,
  bigEndian: false,
  trueColour: true,
  redMax: 255,
  greenMax: 255,
  blueMax: 255,
  redShift: 0,
  greenShift: 8,
  blueShift: 16,
};

export function encodePixelFormat(pf: PixelFormat): Uint8Array {
  const out = new Uint8Array(16);
  out[0] = pf.bitsPerPixel;
  out[1] = pf.depth;
  out[2] = pf.bigEndian ? 1 : 0;
  out[3] = pf.trueColour ? 1 : 0;
  out[4] = (pf.redMax >>> 8) & 0xff;
  out[5] = pf.redMax & 0xff;
  out[6] = (pf.greenMax >>> 8) & 0xff;
  out[7] = pf.greenMax & 0xff;
  out[8] = (pf.blueMax >>> 8) & 0xff;
  out[9] = pf.blueMax & 0xff;
  out[10] = pf.redShift;
  out[11] = pf.greenShift;
  out[12] = pf.blueShift;
  return out;
}

export function decodePixelFormat(buf: Uint8Array, offset = 0): PixelFormat {
  return {
    bitsPerPixel: buf[offset]!,
    depth: buf[offset + 1]!,
    bigEndian: buf[offset + 2] !== 0,
    trueColour: buf[offset + 3] !== 0,
    redMax: (buf[offset + 4]! << 8) | buf[offset + 5]!,
    greenMax: (buf[offset + 6]! << 8) | buf[offset + 7]!,
    blueMax: (buf[offset + 8]! << 8) | buf[offset + 9]!,
    redShift: buf[offset + 10]!,
    greenShift: buf[offset + 11]!,
    blueShift: buf[offset + 12]!,
  };
}

/** Unpack one pixel to RGB given server pixel format (true-colour). */
export function pixelToRgb(pixel: number, pf: PixelFormat): [number, number, number] {
  const r = ((pixel >>> pf.redShift) & pf.redMax) * (255 / (pf.redMax || 1));
  const g = ((pixel >>> pf.greenShift) & pf.greenMax) * (255 / (pf.greenMax || 1));
  const b = ((pixel >>> pf.blueShift) & pf.blueMax) * (255 / (pf.blueMax || 1));
  return [r | 0, g | 0, b | 0];
}
