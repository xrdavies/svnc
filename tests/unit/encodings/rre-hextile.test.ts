import { describe, it, expect } from 'vitest';
import { decodeRre } from '../../../src/rfb/encodings/rre.js';
import { decodeHextile } from '../../../src/rfb/encodings/hextile.js';
import { PREFERRED_PIXEL_FORMAT } from '../../../src/rfb/pixel-format.js';
import { MemoryDisplay } from '../../../src/display/memory.js';
import type { CanvasDisplay } from '../../../src/display/canvas.js';

function makeDisplay(w = 64, h = 64): CanvasDisplay {
  const d = new MemoryDisplay();
  d.resize(w, h);
  return d as unknown as CanvasDisplay;
}

function pixel(r: number, g: number, b: number): Uint8Array {
  return Uint8Array.of(r, g, b, 0);
}

describe('RRE', () => {
  it('fills background and subrects', () => {
    const d = makeDisplay(8, 8);
    const parts: number[] = [];
    parts.push(0, 0, 0, 1);
    parts.push(...pixel(10, 20, 30));
    parts.push(...pixel(200, 100, 50));
    parts.push(0, 1, 0, 1, 0, 2, 0, 2);
    decodeRre(d, 0, 0, 8, 8, Uint8Array.from(parts), PREFERRED_PIXEL_FORMAT);
    const img = (d as unknown as MemoryDisplay).getImageData();
    expect(img.data[0]).toBe(10);
    expect(img.data[1]).toBe(20);
    expect(img.data[2]).toBe(30);
    const i = (1 * 8 + 1) * 4;
    expect(img.data[i]).toBe(200);
    expect(img.data[i + 1]).toBe(100);
    expect(img.data[i + 2]).toBe(50);
  });
});

describe('Hextile', () => {
  it('solid background tile', () => {
    const d = makeDisplay(16, 16);
    const data = Uint8Array.of(2, 1, 2, 3, 0);
    decodeHextile(d, 0, 0, 16, 16, data, PREFERRED_PIXEL_FORMAT);
    const img = (d as unknown as MemoryDisplay).getImageData();
    expect(img.data[0]).toBe(1);
    expect(img.data[1]).toBe(2);
    expect(img.data[2]).toBe(3);
  });
});
