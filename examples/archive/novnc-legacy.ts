/**
 * ARCHIVED — Phase 1 Wrap Spike around `@novnc/novnc`.
 * Not imported by the `svnc` package. Install `@novnc/novnc` yourself if you revive this.
 * Default path: lean `RfbSession` / `SVNCClient`.
 */

import {
  notConnected,
  outOfBounds,
  SvncError,
  viewOnly as viewOnlyErr,
} from '../automation/errors.js';
import type {
  AutomationSurface,
  ConnectOptions,
  DesktopInfo,
  DesktopPoint,
  FrameSnapshot,
  InputMode,
  MouseButton,
  TypeTextOptions,
} from '../automation/types.js';
import { EventBus } from '../utils/events.js';
import { textToKeysyms, toKeysym } from '../utils/keysym.js';

/** Minimal structural typing so we do not hard-depend on noVNC types at compile time. */
type NovncRfb = {
  viewOnly: boolean;
  scaleViewport: boolean;
  clipViewport: boolean;
  _fbWidth?: number;
  _fbHeight?: number;
  _display?: {
    getImageData: () => ImageData;
    toDataURL: (type?: string, quality?: number) => string;
    toBlob: (callback: (b: Blob | null) => void, type?: string, quality?: number) => void;
  };
  _sock?: { s: unknown };
  sendKey: (keysym: number, code: string | null, down?: boolean) => void;
  clipboardPasteFrom: (text: string) => void;
  disconnect: () => void;
  addEventListener: (type: string, fn: (e: Event) => void) => void;
  removeEventListener: (type: string, fn: (e: Event) => void) => void;
};

export type NovncLegacyOptions = ConnectOptions & {
  target: HTMLElement;
  /**
   * Dynamic import of RFB constructor from `@novnc/novnc/lib/rfb.js` (or CDN).
   * Injected so the core package does not require `@novnc/novnc` at runtime after Phase 2.
   */
  loadRfb: () => Promise<new (target: HTMLElement, url: string, options?: object) => NovncRfb>;
};

const BUTTON_BITS: Record<MouseButton, number> = {
  left: 1 << 0,
  middle: 1 << 1,
  right: 1 << 2,
  back: 1 << 7,
  forward: 1 << 8,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Wrap an noVNC RFB instance as AutomationSurface.
 * Pointer injection uses undocumented `_sendMouse` / `RFB.messages.pointerEvent` when present.
 */
export class NovncLegacyAdapter implements AutomationSurface {
  private rfb: NovncRfb | null = null;
  private bus = new EventBus();
  private _connected = false;
  private _viewOnly: boolean;
  private buttonMask = 0;
  private pointerX = 0;
  private pointerY = 0;
  private _desktop: DesktopInfo = { width: 0, height: 0, name: '' };
  inputMode: InputMode = 'mixed';

  constructor(private readonly opts: NovncLegacyOptions) {
    this._viewOnly = opts.viewOnly === true;
  }

  get desktop(): DesktopInfo {
    return { ...this._desktop };
  }

  get connected(): boolean {
    return this._connected;
  }

  get viewOnly(): boolean {
    return this._viewOnly;
  }

  static async connect(opts: NovncLegacyOptions): Promise<NovncLegacyAdapter> {
    const adapter = new NovncLegacyAdapter(opts);
    await adapter.open();
    return adapter;
  }

  async open(): Promise<void> {
    const RFB = await this.opts.loadRfb();
    const rfb = new RFB(this.opts.target, this.opts.url, {
      credentials: this.opts.credentials,
      shared: this.opts.shared !== false,
    });
    rfb.viewOnly = this._viewOnly;
    // Spike rule: desktop coordinates == framebuffer pixels
    rfb.scaleViewport = false;

    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onDisconnect = () => {
        cleanup();
        reject(new SvncError('TRANSPORT_ERROR', 'noVNC disconnected before connect'));
      };
      const cleanup = () => {
        rfb.removeEventListener('connect', onConnect);
        rfb.removeEventListener('disconnect', onDisconnect);
      };
      rfb.addEventListener('connect', onConnect);
      rfb.addEventListener('disconnect', onDisconnect);
    });

    this.rfb = rfb;
    this._connected = true;
    this._desktop = {
      width: rfb._fbWidth ?? 0,
      height: rfb._fbHeight ?? 0,
      name: '',
    };
    rfb.addEventListener('desktopname', ((e: Event & { detail?: { name?: string } }) => {
      this._desktop = { ...this._desktop, name: e.detail?.name ?? '' };
      this.bus.emit('desktopname', this._desktop.name);
    }) as (e: Event) => void);
    rfb.addEventListener('clipboard', ((e: Event & { detail?: { text?: string } }) => {
      this.bus.emit('clipboard', e.detail?.text ?? '');
    }) as (e: Event) => void);
    rfb.addEventListener('disconnect', () => {
      this._connected = false;
      this.bus.emit('disconnect');
    });
    this.bus.emit('connect');
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    this.bus.on(event, handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.bus.off(event, handler);
  }

  disconnect(): void {
    this.rfb?.disconnect();
    this.rfb = null;
    this._connected = false;
  }

  private ensureInteractive(action: string): void {
    if (!this._connected || !this.rfb) throw notConnected(action);
    if (this._viewOnly) throw viewOnlyErr(action);
  }

  private ensureInside(x: number, y: number): void {
    const { width, height } = this._desktop;
    if (width > 0 && height > 0 && (x < 0 || y < 0 || x >= width || y >= height)) {
      throw outOfBounds(x, y, width, height);
    }
  }

  /**
   * Isolated private-API pointer send.
   * Tries `_sendMouse` then `RFB.messages.pointerEvent` on the sock.
   */
  private sendMouse(x: number, y: number, mask: number): void {
    const rfb = this.rfb as NovncRfb & {
      _sendMouse?: (x: number, y: number, mask: number) => void;
      constructor?: { messages?: { pointerEvent?: (sock: unknown, x: number, y: number, mask: number) => void } };
    };
    if (typeof rfb._sendMouse === 'function') {
      rfb._sendMouse(x, y, mask);
      return;
    }
    const pointerEvent = rfb.constructor?.messages?.pointerEvent;
    if (pointerEvent && rfb._sock) {
      pointerEvent(rfb._sock, x, y, mask);
      return;
    }
    throw new SvncError(
      'UNSUPPORTED',
      'noVNC build exposes neither _sendMouse nor RFB.messages.pointerEvent — cannot inject pointer',
    );
  }

  screenshot(): FrameSnapshot {
    if (!this.rfb?._display) throw notConnected('screenshot');
    const imageData = this.rfb._display.getImageData();
    return {
      width: imageData.width,
      height: imageData.height,
      imageData,
      timestamp: Date.now(),
    };
  }

  toDataURL(type?: string, quality?: number): string {
    if (!this.rfb?._display) throw notConnected('toDataURL');
    return this.rfb._display.toDataURL(type, quality);
  }

  toBlob(type?: string, quality?: number): Promise<Blob> {
    if (!this.rfb?._display) return Promise.reject(notConnected('toBlob'));
    return new Promise((resolve, reject) => {
      this.rfb!._display!.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality);
    });
  }

  moveTo(x: number, y: number): void {
    this.ensureInteractive('moveTo');
    this.ensureInside(x, y);
    this.pointerX = Math.floor(x);
    this.pointerY = Math.floor(y);
    this.sendMouse(this.pointerX, this.pointerY, this.buttonMask);
  }

  mouseDown(button: MouseButton = 'left'): void {
    this.ensureInteractive('mouseDown');
    this.buttonMask |= BUTTON_BITS[button]!;
    this.sendMouse(this.pointerX, this.pointerY, this.buttonMask);
  }

  mouseUp(button: MouseButton = 'left'): void {
    this.ensureInteractive('mouseUp');
    this.buttonMask &= ~BUTTON_BITS[button]!;
    this.sendMouse(this.pointerX, this.pointerY, this.buttonMask);
  }

  click(x: number, y: number, button: MouseButton = 'left'): void {
    this.moveTo(x, y);
    this.mouseDown(button);
    this.mouseUp(button);
  }

  dblclick(x: number, y: number): void {
    this.click(x, y);
    this.click(x, y);
  }

  async drag(from: DesktopPoint, to: DesktopPoint, opts?: { steps?: number; stepDelayMs?: number }): Promise<void> {
    const steps = opts?.steps ?? 10;
    const delay = opts?.stepDelayMs ?? 8;
    this.moveTo(from.x, from.y);
    this.mouseDown('left');
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.moveTo(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      if (delay) await sleep(delay);
    }
    this.mouseUp('left');
  }

  scroll(x: number, y: number, dx: number, dy: number): void {
    this.moveTo(x, y);
    const wheelUp = 1 << 3;
    const wheelDown = 1 << 4;
    const wheelLeft = 1 << 5;
    const wheelRight = 1 << 6;
    for (let i = 0; i < Math.abs(dy); i++) {
      const bit = dy < 0 ? wheelUp : wheelDown;
      this.sendMouse(this.pointerX, this.pointerY, this.buttonMask | bit);
      this.sendMouse(this.pointerX, this.pointerY, this.buttonMask);
    }
    for (let i = 0; i < Math.abs(dx); i++) {
      const bit = dx < 0 ? wheelLeft : wheelRight;
      this.sendMouse(this.pointerX, this.pointerY, this.buttonMask | bit);
      this.sendMouse(this.pointerX, this.pointerY, this.buttonMask);
    }
  }

  keyDown(key: string | number): void {
    this.ensureInteractive('keyDown');
    this.rfb!.sendKey(toKeysym(key), null, true);
  }

  keyUp(key: string | number): void {
    this.ensureInteractive('keyUp');
    this.rfb!.sendKey(toKeysym(key), null, false);
  }

  keyPress(key: string | number): void {
    this.keyDown(key);
    this.keyUp(key);
  }

  async typeText(text: string, opts?: TypeTextOptions): Promise<void> {
    this.ensureInteractive('typeText');
    if (opts?.viaClipboard) {
      this.clipboardWrite(text);
      this.keyDown('Control');
      this.keyPress('v');
      this.keyUp('Control');
      return;
    }
    const delay = opts?.delayMs ?? 0;
    for (const ks of textToKeysyms(text)) {
      this.rfb!.sendKey(ks, null, true);
      this.rfb!.sendKey(ks, null, false);
      if (delay) await sleep(delay);
    }
  }

  clipboardWrite(text: string): void {
    this.ensureInteractive('clipboardWrite');
    this.rfb!.clipboardPasteFrom(text);
  }
}

/** Explicit factory — keeps deprecated Wrap path discoverable without being the default. */
export async function createNovncLegacyAdapter(opts: NovncLegacyOptions): Promise<NovncLegacyAdapter> {
  return NovncLegacyAdapter.connect(opts);
}
