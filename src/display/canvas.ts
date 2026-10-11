/**
 * Canvas-backed framebuffer for browser (and jsdom when ImageData/canvas exist).
 */

import type { DamageRect } from '../automation/types.js';

export class CanvasDisplay {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private _width = 0;
  private _height = 0;
  /** RGBA pixel buffer mirroring the canvas. */
  private pixels: Uint8ClampedArray | null = null;

  constructor(target?: HTMLElement | null) {
    if (typeof document === 'undefined') {
      // Headless / unit-test path: create a minimal stub canvas if possible
      throw new Error('CanvasDisplay requires a DOM document; use createOffscreenDisplay in tests');
    }
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.imageRendering = 'pixelated';
    if (target) target.appendChild(canvas);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
  }

  /** Construct from an existing canvas (tests / custom hosts). */
  static fromCanvas(canvas: HTMLCanvasElement): CanvasDisplay {
    const d = Object.create(CanvasDisplay.prototype) as CanvasDisplay;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas context unavailable');
    (d as unknown as { canvas: HTMLCanvasElement }).canvas = canvas;
    (d as unknown as { ctx: CanvasRenderingContext2D }).ctx = ctx;
    (d as unknown as { _width: number })._width = canvas.width;
    (d as unknown as { _height: number })._height = canvas.height;
    (d as unknown as { pixels: Uint8ClampedArray | null }).pixels = null;
    return d;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.pixels = new Uint8ClampedArray(width * height * 4);
    this.pixels.fill(0);
    // opaque black
    for (let i = 3; i < this.pixels.length; i += 4) this.pixels[i] = 255;
    this.ctx.putImageData(new ImageData(this.pixels as unknown as ImageDataArray, width, height), 0, 0);
  }

  /** Blit true-colour RGB888 (or BGR) packed pixels into the framebuffer. */
  blitRgb(
    x: number,
    y: number,
    w: number,
    h: number,
    src: Uint8Array,
    bytesPerPixel: number,
    order: 'rgb' | 'bgr' = 'rgb',
  ): DamageRect {
    if (!this.pixels) throw new Error('Display not resized');
    const stride = w * bytesPerPixel;
    for (let row = 0; row < h; row++) {
      const dy = y + row;
      if (dy < 0 || dy >= this._height) continue;
      for (let col = 0; col < w; col++) {
        const dx = x + col;
        if (dx < 0 || dx >= this._width) continue;
        const si = row * stride + col * bytesPerPixel;
        const di = (dy * this._width + dx) * 4;
        const r = order === 'rgb' ? src[si]! : src[si + 2]!;
        const g = src[si + 1]!;
        const b = order === 'rgb' ? src[si + 2]! : src[si]!;
        this.pixels[di] = r;
        this.pixels[di + 1] = g;
        this.pixels[di + 2] = b;
        this.pixels[di + 3] = 255;
      }
    }
    this.flushRect(x, y, w, h);
    return { x, y, width: w, height: h };
  }

  fillRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number): DamageRect {
    if (!this.pixels) throw new Error('Display not resized');
    for (let row = 0; row < h; row++) {
      const dy = y + row;
      if (dy < 0 || dy >= this._height) continue;
      for (let col = 0; col < w; col++) {
        const dx = x + col;
        if (dx < 0 || dx >= this._width) continue;
        const di = (dy * this._width + dx) * 4;
        this.pixels[di] = r;
        this.pixels[di + 1] = g;
        this.pixels[di + 2] = b;
        this.pixels[di + 3] = 255;
      }
    }
    this.flushRect(x, y, w, h);
    return { x, y, width: w, height: h };
  }

  copyRect(sx: number, sy: number, dx: number, dy: number, w: number, h: number): DamageRect {
    if (!this.pixels) throw new Error('Display not resized');
    const tmp = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const s = ((sy + row) * this._width + (sx + col)) * 4;
        const t = (row * w + col) * 4;
        tmp[t] = this.pixels[s]!;
        tmp[t + 1] = this.pixels[s + 1]!;
        tmp[t + 2] = this.pixels[s + 2]!;
        tmp[t + 3] = this.pixels[s + 3]!;
      }
    }
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const d = ((dy + row) * this._width + (dx + col)) * 4;
        const t = (row * w + col) * 4;
        this.pixels[d] = tmp[t]!;
        this.pixels[d + 1] = tmp[t + 1]!;
        this.pixels[d + 2] = tmp[t + 2]!;
        this.pixels[d + 3] = tmp[t + 3]!;
      }
    }
    this.flushRect(dx, dy, w, h);
    return { x: dx, y: dy, width: w, height: h };
  }

  private flushRect(x: number, y: number, w: number, h: number): void {
    if (!this.pixels) return;
    // Clamp to canvas
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this._width, x + w);
    const y1 = Math.min(this._height, y + h);
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw <= 0 || ch <= 0) return;
    const slice = new Uint8ClampedArray(cw * ch * 4);
    for (let row = 0; row < ch; row++) {
      const src = ((y0 + row) * this._width + x0) * 4;
      slice.set(this.pixels.subarray(src, src + cw * 4), row * cw * 4);
    }
    this.ctx.putImageData(new ImageData(slice as unknown as ImageDataArray, cw, ch), x0, y0);
  }

  getImageData(): ImageData {
    if (!this.pixels) throw new Error('Display not resized');
    return new ImageData(this.pixels.slice() as unknown as ImageDataArray, this._width, this._height);
  }

  toDataURL(type?: string, quality?: number): string {
    return this.canvas.toDataURL(type, quality);
  }

  toBlob(type?: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        type,
        quality,
      );
    });
  }
}
