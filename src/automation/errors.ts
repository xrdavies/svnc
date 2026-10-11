/**
 * Unified SVNC error model (Phase 3; used from Phase 1 types onward).
 */

export type SvncErrorCode =
  | 'NOT_CONNECTED'
  | 'VIEW_ONLY'
  | 'OUT_OF_BOUNDS'
  | 'INVALID_STATE'
  | 'UNSUPPORTED'
  | 'TIMEOUT'
  | 'NO_RECOGNITION_PROVIDER'
  | 'AUTH_FAILED'
  | 'PROTOCOL_ERROR'
  | 'TRANSPORT_ERROR';

export class SvncError extends Error {
  readonly code: SvncErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: SvncErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SvncError';
    this.code = code;
    this.details = details;
  }
}

export function notConnected(action: string): SvncError {
  return new SvncError('NOT_CONNECTED', `Cannot ${action}: not connected to a VNC session`);
}

export function viewOnly(action: string): SvncError {
  return new SvncError('VIEW_ONLY', `Cannot ${action}: session is viewOnly`);
}

export function outOfBounds(x: number, y: number, width: number, height: number): SvncError {
  return new SvncError(
    'OUT_OF_BOUNDS',
    `Desktop coordinate (${x}, ${y}) outside ${width}x${height}`,
    { x, y, width, height },
  );
}

export function noRecognitionProvider(): SvncError {
  return new SvncError(
    'NO_RECOGNITION_PROVIDER',
    'No RecognitionProvider registered; call useRecognition() or use screenshot() + external Agent',
  );
}
