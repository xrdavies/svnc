/**
 * Lean RFB session: handshake (None, VNC Auth, Apple Remote Desktop), encodings (Raw/CopyRect/RRE/Hextile/ZRLE/Tight+JPEG),
 * soft cursor, ExtendedDesktopSize, input, framebuffer.
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
  DamageRect,
  DesktopInfo,
  DesktopPoint,
  FrameSnapshot,
  InputMode,
  MouseButton,
  TypeTextOptions,
} from '../automation/types.js';
import { CanvasDisplay } from '../display/canvas.js';
import { EventBus } from '../utils/events.js';
import { attachHumanInput } from '../input/human-input.js';
import { textToKeysyms, toKeysym } from '../utils/keysym.js';
import { Encoding, PointerButtonMask, RFB_VERSION, SecurityType, ClientMessage, ServerMessage } from './constants.js';
import { ardResponse } from './ard.js';
import { vncEncryptChallenge } from './d3des.js';
import { decodeCursorPseudo } from './encodings/cursor.js';
import { parseExtendedDesktopSize } from './encodings/extended-desktop-size.js';
import { decodeHextile } from './encodings/hextile.js';
import { decodeRre } from './encodings/rre.js';
import { decodeTightRect } from './encodings/tight.js';
import { decodeZrleTiles } from './encodings/zrle.js';
import { TightInflatePool, ZrleInflater } from './inflate.js';
import { decodePixelFormat, encodePixelFormat, PREFERRED_PIXEL_FORMAT, type PixelFormat, pixelToRgb } from './pixel-format.js';
import { MessageWriter, RfbTransport, readI32, readU16, readU32 } from './transport.js';

const BUTTON_TO_MASK: Record<MouseButton, number> = {
  left: PointerButtonMask.left,
  middle: PointerButtonMask.middle,
  right: PointerButtonMask.right,
  back: PointerButtonMask.back,
  forward: PointerButtonMask.forward,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type RfbSessionOptions = ConnectOptions & {
  /** Mount point for the display canvas; null = off-DOM canvas still created. */
  target?: HTMLElement | null;
  /** Inject display (tests). */
  display?: CanvasDisplay;
};

export class RfbSession implements AutomationSurface {
  private transport = new RfbTransport();
  private bus = new EventBus();
  private display: CanvasDisplay;
  private _connected = false;
  private _viewOnly: boolean;
  private _desktop: DesktopInfo = { width: 0, height: 0, name: '' };
  private serverPf: PixelFormat = PREFERRED_PIXEL_FORMAT;
  private buttonMask = 0;
  private pointerX = 0;
  private pointerY = 0;
  private running = false;
  private tightInflate = new TightInflatePool();
  private zrleInflate = new ZrleInflater();
  private screens: Array<{ id: number; x: number; y: number; width: number; height: number; flags: number }> = [];
  inputMode: InputMode = 'mixed';
  private detachHuman: (() => void) | null = null;

  constructor(private readonly opts: RfbSessionOptions) {
    this._viewOnly = opts.viewOnly === true;
    this.inputMode = opts.inputMode ?? 'mixed';
    this.display = opts.display ?? new CanvasDisplay(opts.target ?? null);
  }

  get desktop(): DesktopInfo {
    return { ...this._desktop };
  }

  /** Multi-monitor layout from ExtendedDesktopSize (empty if unused). */
  get screenLayout(): Array<{ id: number; x: number; y: number; width: number; height: number; flags: number }> {
    return this.screens.map((s) => ({ ...s }));
  }

  get connected(): boolean {
    return this._connected;
  }

  get viewOnly(): boolean {
    return this._viewOnly;
  }

  get canvas(): HTMLCanvasElement {
    return this.display.canvas;
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    this.bus.on(event, handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.bus.off(event, handler);
  }

  static async connect(opts: RfbSessionOptions): Promise<RfbSession> {
    const session = new RfbSession(opts);
    await session.open();
    return session;
  }

  async open(): Promise<void> {
    await this.transport.connect(this.opts.url);
    await this.handshake();
    this._connected = true;
    this.running = true;
    this.attachHumanInputIfNeeded();
    this.bus.emit('connect');
    void this.readLoop().catch((err) => {
      this.bus.emit('error', err);
      this.teardown(err);
    });
  }

  private attachHumanInputIfNeeded(): void {
    this.detachHuman?.();
    this.detachHuman = null;
    if (this.opts.enableHumanInput === false) return;
    if (typeof document === 'undefined') return;
    const canvas = this.display.canvas;
    if (!canvas) return;
    this.detachHuman = attachHumanInput(canvas, this);
  }

  disconnect(): void {
    this.teardown();
  }

  private teardown(err?: unknown): void {
    const was = this._connected;
    this.running = false;
    this._connected = false;
    this.detachHuman?.();
    this.detachHuman = null;
    this.transport.close();
    if (was) this.bus.emit('disconnect', err);
  }

  private async handshake(): Promise<void> {
    const serverVersion = await this.transport.readString(12);
    if (!serverVersion.startsWith('RFB ')) {
      throw new SvncError('PROTOCOL_ERROR', `Unexpected version banner: ${serverVersion}`);
    }
    this.transport.send(new TextEncoder().encode(RFB_VERSION));

    const typeCount = (await this.transport.read(1))[0]!;
    if (typeCount === 0) {
      const reasonLen = readU32(await this.transport.read(4), 0);
      const reason = await this.transport.readString(reasonLen);
      throw new SvncError('AUTH_FAILED', `Server rejected connection: ${reason}`);
    }
    const types = await this.transport.read(typeCount);
    const wantPassword = Boolean(this.opts.credentials?.password);
    const wantUser = wantPassword && Boolean(this.opts.credentials?.username);
    let chosen: number = SecurityType.None;
    const has = (t: number) => types.includes(t);
    // A macOS user sign-in lands in that user's session; VNC Auth gets the login window.
    if (wantUser && has(SecurityType.AppleRemoteDesktop)) chosen = SecurityType.AppleRemoteDesktop;
    else if (wantPassword && has(SecurityType.VncAuth)) chosen = SecurityType.VncAuth;
    else if (has(SecurityType.None) && !wantPassword) chosen = SecurityType.None;
    else if (has(SecurityType.VncAuth)) chosen = SecurityType.VncAuth;
    else if (has(SecurityType.None)) chosen = SecurityType.None;
    else {
      throw new SvncError('AUTH_FAILED', `No supported security type in [${[...types]}]`);
    }
    this.transport.send(Uint8Array.of(chosen));

    if (chosen === SecurityType.VncAuth) {
      const challenge = await this.transport.read(16);
      const password = this.opts.credentials?.password ?? '';
      const response = vncEncryptChallenge(password, challenge);
      this.transport.send(response);
    } else if (chosen === SecurityType.AppleRemoteDesktop) {
      const head = await this.transport.read(4);
      const generator = readU16(head, 0);
      const keyLength = readU16(head, 2);
      const prime = await this.transport.read(keyLength);
      const serverKey = await this.transport.read(keyLength);
      const { credentials, publicKey } = await ardResponse(
        { generator, prime, serverKey },
        this.opts.credentials?.username ?? '',
        this.opts.credentials?.password ?? '',
      );
      this.transport.send(credentials);
      this.transport.send(publicKey);
    }

    const result = readU32(await this.transport.read(4), 0);
    if (result !== 0) {
      // RFB 3.8 may send reason string
      try {
        const reasonLen = readU32(await this.transport.read(4), 0);
        const reason = await this.transport.readString(Math.min(reasonLen, 512));
        throw new SvncError('AUTH_FAILED', `SecurityResult failed: ${reason}`);
      } catch (e) {
        if (e instanceof SvncError) throw e;
        throw new SvncError('AUTH_FAILED', 'SecurityResult failed');
      }
    }

    // ClientInit
    const shared = this.opts.shared !== false ? 1 : 0;
    this.transport.send(Uint8Array.of(shared));

    // ServerInit
    const init = await this.transport.read(24);
    const width = readU16(init, 0);
    const height = readU16(init, 2);
    this.serverPf = decodePixelFormat(init, 4);
    const nameLen = readU32(init, 20);
    const nameBytes = await this.transport.read(nameLen);
    const name = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);

    this._desktop = { width, height, name };
    this.display.resize(width, height);
    this.bus.emit('desktopname', name);

    // Negotiate pixel format + encodings
    this.sendSetPixelFormat(PREFERRED_PIXEL_FORMAT);
    this.serverPf = PREFERRED_PIXEL_FORMAT;
    this.sendSetEncodings(this.chooseEncodings());
    this.sendFramebufferUpdateRequest(false, 0, 0, width, height);
  }

  private chooseEncodings(): number[] {
    const preferred =
      this.opts.preferredEncodings ??
      (['tight', 'zrle', 'hextile', 'rre', 'copyrect', 'raw'] as const);
    const map: Record<string, number> = {
      tight: Encoding.Tight,
      zrle: Encoding.ZRLE,
      hextile: Encoding.Hextile,
      rre: Encoding.RRE,
      copyrect: Encoding.CopyRect,
      raw: Encoding.Raw,
    };
    const list: number[] = [];
    for (const p of preferred) {
      const enc = map[p];
      if (enc !== undefined && !list.includes(enc)) list.push(enc);
    }
    for (const fallback of [Encoding.CopyRect, Encoding.Raw]) {
      if (!list.includes(fallback)) list.push(fallback);
    }
    // Pseudo-encodings
    list.push(Encoding.DesktopSize);
    list.push(Encoding.ExtendedDesktopSize);
    list.push(Encoding.LastRect);
    list.push(Encoding.Cursor);
    // JPEG quality mid-high now that we decode Tight JPEG
    list.push(Encoding.QualityLevel0 + 7); // quality 7 → -25
    list.push(Encoding.CompressionLevel0 - 2); // level 2
    return list;
  }

  private sendSetPixelFormat(pf: PixelFormat): void {
    const msg = new MessageWriter().u8(ClientMessage.SetPixelFormat).u8(0).u8(0).u8(0).bytes(encodePixelFormat(pf));
    this.transport.send(msg.toUint8Array());
  }

  private sendSetEncodings(encodings: number[]): void {
    const w = new MessageWriter().u8(ClientMessage.SetEncodings).u8(0).u16(encodings.length);
    for (const e of encodings) w.i32(e);
    this.transport.send(w.toUint8Array());
  }

  private sendFramebufferUpdateRequest(
    incremental: boolean,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const msg = new MessageWriter()
      .u8(ClientMessage.FramebufferUpdateRequest)
      .u8(incremental ? 1 : 0)
      .u16(x)
      .u16(y)
      .u16(w)
      .u16(h);
    this.transport.send(msg.toUint8Array());
  }

  private async readLoop(): Promise<void> {
    while (this.running) {
      const typeBuf = await this.transport.read(1);
      const type = typeBuf[0]!;
      switch (type) {
        case ServerMessage.FramebufferUpdate:
          await this.handleFramebufferUpdate();
          break;
        case ServerMessage.SetColourMapEntries:
          await this.handleColourMap();
          break;
        case ServerMessage.Bell:
          break;
        case ServerMessage.ServerCutText:
          await this.handleServerCutText();
          break;
        default:
          throw new SvncError('PROTOCOL_ERROR', `Unknown server message type ${type}`);
      }
    }
  }

  private async handleColourMap(): Promise<void> {
    await this.transport.read(1); // padding
    await this.transport.read(2); // first colour
    const n = readU16(await this.transport.read(2), 0);
    await this.transport.read(n * 6);
  }

  private async handleServerCutText(): Promise<void> {
    await this.transport.read(3); // padding
    const len = readU32(await this.transport.read(4), 0);
    const text = await this.transport.readString(len);
    this.bus.emit('clipboard', text);
  }

  private async handleFramebufferUpdate(): Promise<void> {
    await this.transport.read(1); // padding
    const rectCount = readU16(await this.transport.read(2), 0);
    const damage: DamageRect[] = [];
    for (let i = 0; i < rectCount; i++) {
      const hdr = await this.transport.read(12);
      const x = readU16(hdr, 0);
      const y = readU16(hdr, 2);
      const w = readU16(hdr, 4);
      const h = readU16(hdr, 6);
      const encoding = readI32(hdr, 8);

      if (encoding === Encoding.DesktopSize) {
        this._desktop = { ...this._desktop, width: w, height: h };
        this.display.resize(w, h);
        this.bus.emit('desktopsize', { width: w, height: h });
        continue;
      }
      if (encoding === Encoding.ExtendedDesktopSize) {
        // Payload: U8 nScreens + 3 bytes padding + n*16 SCREEN (rfbproto / noVNC)
        const nScreensBuf = await this.transport.read(1);
        const nScreens = nScreensBuf[0]!;
        await this.transport.read(3); // padding
        const rest = await this.transport.read(nScreens * 16);
        const payload = new Uint8Array(4 + rest.length);
        payload[0] = nScreens;
        payload[1] = 0;
        payload[2] = 0;
        payload[3] = 0;
        payload.set(rest, 4);
        const eds = parseExtendedDesktopSize(w, h, x, y, payload);
        this.screens = eds.screens;
        if (eds.fbWidth !== this._desktop.width || eds.fbHeight !== this._desktop.height) {
          this._desktop = { ...this._desktop, width: eds.fbWidth, height: eds.fbHeight };
          this.display.resize(eds.fbWidth, eds.fbHeight);
        }
        this.bus.emit('extendeddesktopsize', eds);
        continue;
      }
      if (encoding === Encoding.LastRect) break;

      if (encoding === Encoding.Raw) {
        damage.push(await this.decodeRaw(x, y, w, h));
      } else if (encoding === Encoding.CopyRect) {
        damage.push(await this.decodeCopyRect(x, y, w, h));
      } else if (encoding === Encoding.RRE) {
        damage.push(await this.decodeRre(x, y, w, h));
      } else if (encoding === Encoding.Hextile) {
        damage.push(await this.decodeHextile(x, y, w, h));
      } else if (encoding === Encoding.ZRLE) {
        damage.push(await this.decodeZrle(x, y, w, h));
      } else if (encoding === Encoding.Tight) {
        damage.push(await this.decodeTight(x, y, w, h));
      } else if (encoding === Encoding.Cursor) {
        await this.decodeCursor(x, y, w, h);
      } else {
        throw new SvncError('UNSUPPORTED', `Unsupported encoding ${encoding}`, { encoding });
      }
    }
    this.bus.emit('frame', { damage });
    if (this._connected) {
      this.sendFramebufferUpdateRequest(true, 0, 0, this._desktop.width, this._desktop.height);
    }
  }

  private async decodeRre(x: number, y: number, w: number, h: number): Promise<DamageRect> {
    const bpp = this.serverPf.bitsPerPixel / 8;
    const nBuf = await this.transport.read(4);
    const nSub = readU32(nBuf, 0);
    const rest = await this.transport.read(bpp + nSub * (bpp + 8));
    const data = new Uint8Array(4 + rest.length);
    data.set(nBuf, 0);
    data.set(rest, 4);
    return decodeRre(this.display, x, y, w, h, data, this.serverPf);
  }

  private async decodeHextile(x: number, y: number, w: number, h: number): Promise<DamageRect> {
    // Hextile length is not prefixed — parse tile-by-tile from stream into a buffer
    // by reading until all tiles consumed. Use streaming parser:
    return this.decodeHextileStreaming(x, y, w, h);
  }

  private async decodeHextileStreaming(x: number, y: number, w: number, h: number): Promise<DamageRect> {
    const bpp = this.serverPf.bitsPerPixel / 8;
    const chunks: Uint8Array[] = [];
    const RAW = 1;
    const BACKGROUND = 2;
    const FOREGROUND = 4;
    const ANY_SUBRECTS = 8;
    const SUBRECTS_COLOURED = 16;

    for (let ty = 0; ty < h; ty += 16) {
      const th = Math.min(16, h - ty);
      for (let tx = 0; tx < w; tx += 16) {
        const tw = Math.min(16, w - tx);
        const maskBuf = await this.transport.read(1);
        chunks.push(maskBuf);
        const mask = maskBuf[0]!;
        if (mask & RAW) {
          chunks.push(await this.transport.read(tw * th * bpp));
          continue;
        }
        if (mask & BACKGROUND) chunks.push(await this.transport.read(bpp));
        if (mask & FOREGROUND) chunks.push(await this.transport.read(bpp));
        if (mask & ANY_SUBRECTS) {
          const nBuf = await this.transport.read(1);
          chunks.push(nBuf);
          const n = nBuf[0]!;
          const coloured = (mask & SUBRECTS_COLOURED) !== 0;
          const per = coloured ? bpp + 2 : 2;
          if (n > 0) chunks.push(await this.transport.read(n * per));
        }
      }
    }
    let total = 0;
    for (const c of chunks) total += c.length;
    const data = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      data.set(c, o);
      o += c.length;
    }
    return decodeHextile(this.display, x, y, w, h, data, this.serverPf);
  }

  private async decodeZrle(x: number, y: number, w: number, h: number): Promise<DamageRect> {
    const len = readU32(await this.transport.read(4), 0);
    const zlibData = await this.transport.read(len);
    const raw = this.zrleInflate.inflate(zlibData);
    return decodeZrleTiles(this.display, x, y, w, h, raw, this.serverPf);
  }

  private async decodeCursor(hotX: number, hotY: number, w: number, h: number): Promise<void> {
    const bpp = this.serverPf.bitsPerPixel / 8;
    const pixels = w * h * bpp;
    const mask = ((w + 7) >> 3) * h;
    if (w === 0 || h === 0) {
      this.display.setSoftCursor(null);
      return;
    }
    const payload = await this.transport.read(pixels + mask);
    const cursor = decodeCursorPseudo(hotX, hotY, w, h, payload, this.serverPf);
    this.display.setSoftCursor(cursor);
    this.bus.emit('cursor', cursor);
  }

  private async decodeRaw(x: number, y: number, w: number, h: number): Promise<DamageRect> {
    const bpp = this.serverPf.bitsPerPixel / 8;
    const data = await this.transport.read(w * h * bpp);
    if (bpp === 4 && this.serverPf.redShift === 0 && this.serverPf.blueShift === 16) {
      // little-endian xRGB already matches our blit rgb order if we take bytes as B,G,R or R,G,B
      // PREFERRED: redShift 0, green 8, blue 16 → memory on LE: R G B A
      return this.display.blitRgb(x, y, w, h, data, 4, 'rgb');
    }
    // Generic unpack
    const rgb = new Uint8Array(w * h * 3);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (let i = 0; i < w * h; i++) {
      let pixel = 0;
      if (bpp === 4) pixel = view.getUint32(i * 4, !this.serverPf.bigEndian);
      else if (bpp === 2) pixel = view.getUint16(i * 2, !this.serverPf.bigEndian);
      else pixel = data[i]!;
      const [r, g, b] = pixelToRgb(pixel, this.serverPf);
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = b;
    }
    return this.display.blitRgb(x, y, w, h, rgb, 3, 'rgb');
  }

  private async decodeCopyRect(x: number, y: number, w: number, h: number): Promise<DamageRect> {
    const src = await this.transport.read(4);
    const sx = readU16(src, 0);
    const sy = readU16(src, 2);
    return this.display.copyRect(sx, sy, x, y, w, h);
  }

  /**
   * Tight encoding — basic subset: fill, JPEG skipped, basic zlib raw filters.
   * Full Tight is large; this covers common TigerVNC solid + copy-style tight streams.
   */
  private async decodeTight(x: number, y: number, w: number, h: number): Promise<DamageRect> {
    return decodeTightRect(
      this.display,
      x,
      y,
      w,
      h,
      (n) => this.transport.read(n),
      this.serverPf,
      this.tightInflate,
    );
  }

  // --- AutomationSurface input ---

  private ensureInteractive(action: string): void {
    if (!this._connected) throw notConnected(action);
    if (this._viewOnly) throw viewOnlyErr(action);
  }

  private ensureInside(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this._desktop.width || y >= this._desktop.height) {
      throw outOfBounds(x, y, this._desktop.width, this._desktop.height);
    }
  }

  private sendPointer(): void {
    const msg = new MessageWriter()
      .u8(ClientMessage.PointerEvent)
      .u8(this.buttonMask & 0xff)
      .u16(this.pointerX)
      .u16(this.pointerY);
    this.transport.send(msg.toUint8Array());
  }

  private sendKey(down: boolean, keysym: number): void {
    const msg = new MessageWriter()
      .u8(ClientMessage.KeyEvent)
      .u8(down ? 1 : 0)
      .u16(0)
      .u32(keysym >>> 0);
    this.transport.send(msg.toUint8Array());
  }

  screenshot(): FrameSnapshot {
    if (!this._connected && this._desktop.width === 0) throw notConnected('screenshot');
    const imageData = this.display.getImageData();
    return {
      width: imageData.width,
      height: imageData.height,
      imageData,
      timestamp: Date.now(),
    };
  }

  toDataURL(type?: string, quality?: number): string {
    if (!this._connected && this._desktop.width === 0) throw notConnected('toDataURL');
    return this.display.toDataURL(type, quality);
  }

  toBlob(type?: string, quality?: number): Promise<Blob> {
    if (!this._connected && this._desktop.width === 0) return Promise.reject(notConnected('toBlob'));
    return this.display.toBlob(type, quality);
  }

  moveTo(x: number, y: number): void {
    this.ensureInteractive('moveTo');
    this.ensureInside(x, y);
    this.pointerX = Math.floor(x);
    this.pointerY = Math.floor(y);
    this.display.setCursorPosition(this.pointerX, this.pointerY);
    this.sendPointer();
  }

  mouseDown(button: MouseButton = 'left'): void {
    this.ensureInteractive('mouseDown');
    this.buttonMask |= BUTTON_TO_MASK[button]!;
    this.sendPointer();
  }

  mouseUp(button: MouseButton = 'left'): void {
    this.ensureInteractive('mouseUp');
    this.buttonMask &= ~BUTTON_TO_MASK[button]!;
    this.sendPointer();
  }

  click(x: number, y: number, button: MouseButton = 'left'): void {
    this.moveTo(x, y);
    this.mouseDown(button);
    this.mouseUp(button);
  }

  dblclick(x: number, y: number): void {
    this.click(x, y, 'left');
    this.click(x, y, 'left');
  }

  async drag(
    from: DesktopPoint,
    to: DesktopPoint,
    opts?: { steps?: number; stepDelayMs?: number },
  ): Promise<void> {
    const steps = opts?.steps ?? 10;
    const delay = opts?.stepDelayMs ?? 8;
    this.moveTo(from.x, from.y);
    this.mouseDown('left');
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      this.moveTo(x, y);
      if (delay > 0) await sleep(delay);
    }
    this.mouseUp('left');
  }

  scroll(x: number, y: number, dx: number, dy: number): void {
    this.moveTo(x, y);
    const emit = (mask: number) => {
      this.buttonMask |= mask;
      this.sendPointer();
      this.buttonMask &= ~mask;
      this.sendPointer();
    };
    for (let i = 0; i < Math.abs(dy); i++) {
      emit(dy < 0 ? PointerButtonMask.wheelUp : PointerButtonMask.wheelDown);
    }
    for (let i = 0; i < Math.abs(dx); i++) {
      emit(dx < 0 ? PointerButtonMask.wheelLeft : PointerButtonMask.wheelRight);
    }
  }

  keyDown(key: string | number, _code?: string): void {
    this.ensureInteractive('keyDown');
    this.sendKey(true, toKeysym(key));
  }

  keyUp(key: string | number, _code?: string): void {
    this.ensureInteractive('keyUp');
    this.sendKey(false, toKeysym(key));
  }

  keyPress(key: string | number, code?: string): void {
    this.keyDown(key, code);
    this.keyUp(key, code);
  }

  async typeText(text: string, opts?: TypeTextOptions): Promise<void> {
    this.ensureInteractive('typeText');
    if (opts?.viaClipboard) {
      this.clipboardWrite(text);
      // Best-effort Ctrl+V (Linux/Windows); macOS may need Super+V — documented separately
      this.keyDown('Control');
      this.keyPress('v');
      this.keyUp('Control');
      return;
    }
    const delay = opts?.delayMs ?? 0;
    for (const ks of textToKeysyms(text)) {
      this.sendKey(true, ks);
      this.sendKey(false, ks);
      if (delay > 0) await sleep(delay);
    }
  }

  clipboardWrite(text: string): void {
    this.ensureInteractive('clipboardWrite');
    // ClientCutText — Latin-1 historically; send UTF-8 bytes as Latin-1-ish for ASCII
    const body = new MessageWriter().latin1(text).toUint8Array();
    const msg = new MessageWriter()
      .u8(ClientMessage.ClientCutText)
      .u8(0)
      .u8(0)
      .u8(0)
      .u32(body.byteLength)
      .bytes(body);
    this.transport.send(msg.toUint8Array());
  }
}
