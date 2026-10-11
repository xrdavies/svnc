/**
 * Frozen Automation contract (Phase 1).
 * Coordinate space = remote desktop pixels (not CSS viewport).
 * Sessions used for click/typeText must be non-viewOnly (D6).
 */

import type { SvncError } from './errors.js';

/** Remote desktop pixel coordinate (not CSS viewport). */
export type DesktopPoint = {
  x: number;
  y: number;
};

export type MouseButton = 'left' | 'middle' | 'right' | 'back' | 'forward';

export type InputMode = 'human' | 'script' | 'mixed';

export type DamageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FrameSnapshot = {
  width: number;
  height: number;
  /** RGBA ImageData (browser) or compatible view. */
  imageData: ImageData;
  timestamp: number;
};

export type TypeTextOptions = {
  delayMs?: number;
  /** Prefer server cut-text + remote paste shortcut when true. */
  viaClipboard?: boolean;
};

export type WaitOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

export type ConnectOptions = {
  /** WebSocket URL that carries RFB bytes (e.g. ws://host:6080/ or native WS VNC). */
  url: string;
  credentials?: {
    username?: string;
    password?: string;
  };
  /** RFB shared-flag (default true). */
  shared?: boolean;
  /**
   * When true, input APIs throw VIEW_ONLY.
   * Automation MVP and tests must use false (D6).
   */
  viewOnly?: boolean;
  /** Preferred pixel depth request; client may negotiate. Default 24-bit true-colour. */
  preferredEncodings?: Array<'raw' | 'tight' | 'copyrect'>;
};

export type DesktopInfo = {
  width: number;
  height: number;
  name: string;
};

/**
 * Programmatic screen + input surface shared by Wrap Spike and lean RFB.
 * Implementations may throw {@link SvncError}.
 */
export interface AutomationSurface {
  readonly desktop: DesktopInfo;
  readonly connected: boolean;
  readonly viewOnly: boolean;
  inputMode: InputMode;

  screenshot(): FrameSnapshot;
  toDataURL(type?: string, quality?: number): string;
  toBlob(type?: string, quality?: number): Promise<Blob>;

  moveTo(x: number, y: number): void;
  mouseDown(button?: MouseButton): void;
  mouseUp(button?: MouseButton): void;
  click(x: number, y: number, button?: MouseButton): void;
  dblclick(x: number, y: number): void;
  drag(from: DesktopPoint, to: DesktopPoint, opts?: { steps?: number; stepDelayMs?: number }): Promise<void>;
  scroll(x: number, y: number, dx: number, dy: number): void;

  keyDown(key: string | number, code?: string): void;
  keyUp(key: string | number, code?: string): void;
  keyPress(key: string | number, code?: string): void;
  typeText(text: string, opts?: TypeTextOptions): Promise<void>;

  clipboardWrite(text: string): void;

  on(event: 'connect' | 'disconnect' | 'desktopname' | 'clipboard' | 'frame' | 'error', handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  disconnect(): void;
}

export type { SvncError };
