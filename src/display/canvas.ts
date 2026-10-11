/**
 * Canvas-backed framebuffer for browser (and jsdom when ImageData/canvas exist).
 */

import type { DamageRect } from '../automation/types.js';
import type { SoftCursor } from '../rfb/encodings/cursor.js';

export class CanvasDisplay {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private _width = 0;
  private _height = 0;
  /** RGBA pixel buffer mirroring the canvas (without soft cursor). */
  private pixels: Uint8ClampedArray | null = null;
  private softCursor: SoftCursor | null = null;
  private cursorX = 0;
  private cursorY = 0;
  private showSoftCursor = true;

  constructor(target?: HTMLElement | null) {
    if (typeof document === 'undefined') {
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
    (d as unknown as { softCursor: SoftCursor | null }).softCursor = null;
    (d as unknown as { cursorX: number }).cursorX = 0;
    (d as unknown as { cursorY: number }).cursorY = 0;
    (d as unknown as { showSoftCursor: boolean }).showSoftCursor = true;
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
    for (let i = 3; i < this.pixels.length; i += 4) this.pixels[i] = 255;
    this.ctx.putImageData(new ImageData(this.pixels as unknown as ImageDataArray, width, height), 0, 0);
  }

  setSoftCursor(cursor: SoftCursor | null): void {
    this.softCursor = cursor;
    this.repaintCursorRegion();
  }

  setSoftCursorEnabled(enabled: boolean): void {
    this.showSoftCursor = enabled;
    this.repaintFull();
  }

  /** Update local soft-cursor hotspot position (desktop coords). */
  setCursorPosition(x: number, y: number): void {
    const prev = this.cursorDamage();
    this.cursorX = x;
    this.cursorY = y;
    this.flushRect(prev.x, prev.y, prev.width, prev.height);
    this.paintSoftCursor();
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

  private cursorDamage(): DamageRect {
    if (!this.softCursor) return { x: 0, y: 0, width: 0, height: 0 };
    const x = this.cursorX - this.softCursor.hotspotX;
    const y = this.cursorY - this.softCursor.hotspotY;
    return { x, y, width: this.softCursor.width, height: this.softCursor.height };
  }

  private paintSoftCursor(): void {
    if (!this.showSoftCursor || !this.softCursor || !this.pixels) return;
    const c = this.softCursor;
    const ox = this.cursorX - c.hotspotX;
    const oy = this.cursorY - c.hotspotY;
    for (let row = 0; row < c.height; row++) {
      const dy = oy + row;
      if (dy < 0 || dy >= this._height) continue;
      for (let col = 0; col < c.width; col++) {
        const dx = ox + col;
        if (dx < 0 || dx >= this._width) continue;
        const si = (row * c.width + col) * 4;
        const a = c.rgba[si + 3]!;
        if (!a) continue;
        // Composite over framebuffer into visible canvas only (FB buffer stays clean)
        const di = (dy * this._width + dx) * 4;
        const srcR = c.rgba[si]!;
        const srcG = c.rgba[si + 1]!;
        const srcB = c.rgba[si + 2]!;
        const alpha = a / 255;
        const inv = 1 - alpha;
        const fr = this.pixels[di]!;
        const fg = this.pixels[di + 1]!;
        const fb = this.pixels[di + 2]!;
        this.ctx.fillStyle = `rgb(${(srcR * alpha + fr * inv) | 0},${(srcG * alpha + fg * inv) | 0},${(srcB * alpha + fb * inv) | 0})`;
        this.ctx.fillRect(dx, dy, 1, 1);
      }
    }
  }

  private repaintCursorRegion(): void {
    const d = this.cursorDamage();
    if (d.width > 0) this.flushRect(d.x, d.y, d.width, d.height);
  }

  private repaintFull(): void {
    if (this._width > 0) this.flushRect(0, 0, this._width, this._height);
  }

  private flushRect(x: number, y: number, w: number, h: number): void {
    if (!this.pixels) return;
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
    // Soft cursor may overlap this rect
    this.paintSoftCursor();
  }

  /** Screenshot / Agent path — framebuffer without soft cursor overlay. */
  getImageData(): ImageData {
    if (!this.pixels) throw new Error('Display not resized');
    return new ImageData(this.pixels.slice() as unknown as ImageDataArray, this._width, this._height);
  }

  toDataURL(type?: string, quality?: number): string {
    // Export clean FB (no soft cursor) for Agent consistency
    if (!this.pixels || !this.canvas) {
      if (!this.canvas) throw new Error('canvas unavailable');
      return this.canvas.toDataURL(type, quality);
    }
    try {
      const tmp = document.createElement('canvas');
      tmp.width = this._width;
      tmp.height = this._height;
      const tctx = tmp.getContext('2d');
      if (!tctx) return this.canvas.toDataURL(type, quality);
      tctx.putImageData(
        new ImageData(this.pixels.slice() as unknown as ImageDataArray, this._width, this._height),
        0,
        0,
      );
      return tmp.toDataURL(type, quality);
    } catch {
      return this.canvas.toDataURL(type, quality);
    }
  }

  toBlob(type?: string, quality?: number): Promise<Blob> {
    if (!this.pixels) {
      return new Promise((resolve, reject) => {
        this.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality);
      });
    }
    const tmp = document.createElement('canvas');
    tmp.width = this._width;
    tmp.height = this._height;
    const tctx = tmp.getContext('2d');
    if (!tctx) return Promise.reject(new Error('toBlob context failed'));
    tctx.putImageData(
      new ImageData(this.pixels.slice() as unknown as ImageDataArray, this._width, this._height),
      0,
      0,
    );
    return new Promise((resolve, reject) => {
      tmp.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality);
    });
  }
}
