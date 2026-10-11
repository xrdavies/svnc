/**
 * Public SVNC client facade — lean RFB by default (Phase 2+).
 */

import { noRecognitionProvider, SvncError } from '../automation/errors.js';
import type {
  AutomationSurface,
  ConnectOptions,
  DesktopInfo,
  DesktopPoint,
  FrameSnapshot,
  InputMode,
  MouseButton,
  TypeTextOptions,
  WaitOptions,
} from '../automation/types.js';
import type { RecognitionProvider, UITarget } from '../recognition/types.js';
import { clickTarget as clickTargetHelper, waitFor as waitForHelper } from '../recognition/stubs.js';
import { RfbSession } from '../rfb/session.js';

export type SVNCClientOptions = ConnectOptions & {
  target?: HTMLElement | null;
};

/**
 * Primary API for browser apps and Agents.
 * Implements AutomationSurface and optional Recognition gateways.
 */
export class SVNCClient implements AutomationSurface {
  private session: RfbSession;
  private recognition: RecognitionProvider | null = null;

  private constructor(session: RfbSession) {
    this.session = session;
  }

  static async connect(target: HTMLElement | null, options: ConnectOptions): Promise<SVNCClient> {
    const session = await RfbSession.connect({ ...options, target });
    return new SVNCClient(session);
  }

  /** @deprecated Use {@link SVNCClient.connect}; Wrap Spike lives under adapters/novnc-legacy. */
  static async connectLegacy(): Promise<never> {
    throw new SvncError(
      'UNSUPPORTED',
      'novnc-legacy Wrap path is deprecated; use SVNCClient.connect (lean RFB) or explicit createNovncLegacyAdapter',
    );
  }

  get desktop(): DesktopInfo {
    return this.session.desktop;
  }

  get connected(): boolean {
    return this.session.connected;
  }

  get viewOnly(): boolean {
    return this.session.viewOnly;
  }

  get canvas(): HTMLCanvasElement {
    return this.session.canvas;
  }

  get inputMode(): InputMode {
    return this.session.inputMode;
  }

  set inputMode(mode: InputMode) {
    this.session.inputMode = mode;
  }

  screenshot(): FrameSnapshot {
    return this.session.screenshot();
  }

  toDataURL(type?: string, quality?: number): string {
    return this.session.toDataURL(type, quality);
  }

  toBlob(type?: string, quality?: number): Promise<Blob> {
    return this.session.toBlob(type, quality);
  }

  moveTo(x: number, y: number): void {
    this.session.moveTo(x, y);
  }

  mouseDown(button?: MouseButton): void {
    this.session.mouseDown(button);
  }

  mouseUp(button?: MouseButton): void {
    this.session.mouseUp(button);
  }

  click(x: number, y: number, button?: MouseButton): void {
    this.session.click(x, y, button);
  }

  dblclick(x: number, y: number): void {
    this.session.dblclick(x, y);
  }

  drag(from: DesktopPoint, to: DesktopPoint, opts?: { steps?: number; stepDelayMs?: number }): Promise<void> {
    return this.session.drag(from, to, opts);
  }

  scroll(x: number, y: number, dx: number, dy: number): void {
    this.session.scroll(x, y, dx, dy);
  }

  keyDown(key: string | number, code?: string): void {
    this.session.keyDown(key, code);
  }

  keyUp(key: string | number, code?: string): void {
    this.session.keyUp(key, code);
  }

  keyPress(key: string | number, code?: string): void {
    this.session.keyPress(key, code);
  }

  typeText(text: string, opts?: TypeTextOptions): Promise<void> {
    return this.session.typeText(text, opts);
  }

  clipboardWrite(text: string): void {
    this.session.clipboardWrite(text);
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    this.session.on(event, handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.session.off(event, handler);
  }

  disconnect(): void {
    this.session.disconnect();
  }

  useRecognition(provider: RecognitionProvider): void {
    this.recognition = provider;
  }

  async find(query: string | RegExp | object): Promise<UITarget[]> {
    if (!this.recognition) throw noRecognitionProvider();
    return this.recognition.find(this.screenshot(), query);
  }

  waitFor(query: string | RegExp | object, opts?: WaitOptions): Promise<UITarget> {
    return waitForHelper(() => this.screenshot(), this.recognition, query, opts);
  }

  clickTarget(query: string | RegExp | object, opts?: WaitOptions): Promise<void> {
    return clickTargetHelper(
      () => this.screenshot(),
      this.recognition,
      (x, y) => this.click(x, y),
      query,
      opts,
    );
  }
}
