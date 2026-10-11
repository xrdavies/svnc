import { describe, expect, it } from 'vitest';
import {
  decodePixelFormat,
  encodePixelFormat,
  PREFERRED_PIXEL_FORMAT,
  pixelToRgb,
} from '../../src/rfb/pixel-format.js';

describe('pixel format', () => {
  it('round-trips preferred format', () => {
    const encoded = encodePixelFormat(PREFERRED_PIXEL_FORMAT);
    expect(encoded.byteLength).toBe(16);
    const decoded = decodePixelFormat(encoded);
    expect(decoded.bitsPerPixel).toBe(32);
    expect(decoded.redShift).toBe(0);
    expect(decoded.blueShift).toBe(16);
  });

  it('pixelToRgb extracts channels', () => {
    const pf = PREFERRED_PIXEL_FORMAT;
    // R=1,G=2,B=3 in low bytes
    const pixel = 1 | (2 << 8) | (3 << 16);
    expect(pixelToRgb(pixel, pf)).toEqual([1, 2, 3]);
  });
});
