/** RFB / VNC protocol constants (subset used by SVNC). */

export const RFB_VERSION = 'RFB 003.008\n';

export const SecurityType = {
  Invalid: 0,
  None: 1,
  VncAuth: 2,
} as const;

export const ClientMessage = {
  SetPixelFormat: 0,
  SetEncodings: 2,
  FramebufferUpdateRequest: 3,
  KeyEvent: 4,
  PointerEvent: 5,
  ClientCutText: 6,
} as const;

export const ServerMessage = {
  FramebufferUpdate: 0,
  SetColourMapEntries: 1,
  Bell: 2,
  ServerCutText: 3,
} as const;

export const Encoding = {
  Raw: 0,
  CopyRect: 1,
  RRE: 2,
  Hextile: 5,
  Tight: 7,
  ZRLE: 16,
  DesktopSize: -223,
  LastRect: -224,
  Cursor: -239,
  ExtendedDesktopSize: -308,
} as const;

/** Pointer button bit masks (RFB). */
export const PointerButtonMask = {
  left: 1 << 0,
  middle: 1 << 1,
  right: 1 << 2,
  wheelUp: 1 << 3,
  wheelDown: 1 << 4,
  wheelLeft: 1 << 5,
  wheelRight: 1 << 6,
  back: 1 << 7,
  forward: 1 << 8,
} as const;

export type SecurityTypeId = (typeof SecurityType)[keyof typeof SecurityType];
