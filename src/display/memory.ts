/**
 * In-memory framebuffer for unit tests (no DOM canvas required).
 */

import type { DamageRect } from '../automation/types.js';

export class MemoryDisplay {
  private _width = 0;
  private _height = 0;
  private pixels: Uint8ClampedArray | null = null;

  get width(): number {
    return this._width;
  }
  get height(): number {
    return this._height;
  }

  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this.pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 3; i < this.pixels.length; i += 4) this.pixels[i] = 255;
  }

  blitRgb(
    x: number,
    y: number,
    w: number,
    h: number,
    src: Uint8Array,
    bytesPerPixel: number,
    order: 'rgb' | 'bgr' = 'rgb',
  ): DamageRect {
    if (!this.pixels) throw new Error('not resized');
    const stride = w * bytesPerPixel;
    for (let row = 0; row < h; row++) {
      const dy = y + row;
      if (dy < 0 || dy >= this._height) continue;
      for (let col = 0; col < w; col++) {
        const dx = x + col;
        if (dx < 0 || dx >= this._width) continue;
        const si = row * stride + col * bytesPerPixel;
        const di = (dy * this._width + dx) * 4;
        this.pixels[di] = order === 'rgb' ? src[si]! : src[si + 2]!;
        this.pixels[di + 1] = src[si + 1]!;
        this.pixels[di + 2] = order === 'rgb' ? src[si + 2]! : src[si]!;
        this.pixels[di + 3] = 255;
      }
    }
    return { x, y, width: w, height: h };
  }

  fillRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number): DamageRect {
    if (!this.pixels) throw new Error('not resized');
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const dx = x + col;
        const dy = y + row;
        if (dx < 0 || dy < 0 || dx >= this._width || dy >= this._height) continue;
        const di = (dy * this._width + dx) * 4;
        this.pixels[di] = r;
        this.pixels[di + 1] = g;
        this.pixels[di + 2] = b;
        this.pixels[di + 3] = 255;
      }
    }
    return { x, y, width: w, height: h };
  }

  copyRect(sx: number, sy: number, dx: number, dy: number, w: number, h: number): DamageRect {
    if (!this.pixels) throw new Error('not resized');
    const tmp = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const s = ((sy + row) * this._width + (sx + col)) * 4;
        const t = (row * w + col) * 4;
        tmp.set(this.pixels.subarray(s, s + 4), t);
      }
    }
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const d = ((dy + row) * this._width + (dx + col)) * 4;
        const t = (row * w + col) * 4;
        this.pixels.set(tmp.subarray(t, t + 4), d);
      }
    }
    return { x: dx, y: dy, width: w, height: h };
  }

  getImageData(): { width: number; height: number; data: Uint8ClampedArray } {
    if (!this.pixels) throw new Error('not resized');
    return { width: this._width, height: this._height, data: this.pixels.slice() };
  }
}
