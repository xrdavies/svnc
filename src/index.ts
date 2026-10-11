/**
 * SVNC — Simple VNC client with Agent-friendly screenshot + input APIs.
 * Default (only) runtime path: lean RFB over WebSocket.
 * Historical Wrap Spike lives under examples/archive/novnc-legacy.ts (not shipped).
 */

export const SVNC_VERSION = '0.1.0';

export { SVNCClient } from './client/SVNCClient.js';
export type { SVNCClientOptions } from './client/SVNCClient.js';

export type {
  AutomationSurface,
  ConnectOptions,
  DamageRect,
  DesktopInfo,
  DesktopPoint,
  FrameSnapshot,
  InputMode,
  MouseButton,
  TypeTextOptions,
  WaitOptions,
} from './automation/types.js';

export { SvncError } from './automation/errors.js';
export type { SvncErrorCode } from './automation/errors.js';

export { RfbSession } from './rfb/session.js';
export type { RfbSessionOptions } from './rfb/session.js';

export { CanvasDisplay } from './display/canvas.js';

export type { RecognitionProvider, UITarget } from './recognition/types.js';
export { NullRecognitionProvider, waitFor, clickTarget } from './recognition/stubs.js';

export { toKeysym, textToKeysyms } from './utils/keysym.js';

export { attachHumanInput, eventToDesktopPoint } from './input/human-input.js';
export type { HumanInputSession } from './input/human-input.js';
