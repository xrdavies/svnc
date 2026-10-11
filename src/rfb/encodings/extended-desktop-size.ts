/**
 * ExtendedDesktopSize pseudo-encoding (−308).
 * @see https://github.com/rfbproto/rfbproto ExtendedDesktopSize
 */

export type VncScreen = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  flags: number;
};

export type ExtendedDesktopSizePayload = {
  /** New framebuffer width/height from rectangle header. */
  fbWidth: number;
  fbHeight: number;
  /** Rectangle x = reason: 0 server, 1 client request, 2 other client. */
  reason: number;
  /** Rectangle y = status when reason=1 (0 ok, else error). */
  status: number;
  screens: VncScreen[];
};

export function parseExtendedDesktopSize(
  fbWidth: number,
  fbHeight: number,
  reason: number,
  status: number,
  data: Uint8Array,
): ExtendedDesktopSizePayload {
  let o = 0;
  const n = data[o++]!;
  o += 3; // padding (rfbproto: 3 bytes after number-of-screens)
  const screens: VncScreen[] = [];
  for (let i = 0; i < n; i++) {
    const id =
      ((data[o]! << 24) | (data[o + 1]! << 16) | (data[o + 2]! << 8) | data[o + 3]!) >>> 0;
    o += 4;
    const x = (data[o]! << 8) | data[o + 1]!;
    const y = (data[o + 2]! << 8) | data[o + 3]!;
    const width = (data[o + 4]! << 8) | data[o + 5]!;
    const height = (data[o + 6]! << 8) | data[o + 7]!;
    o += 8;
    const flags =
      ((data[o]! << 24) | (data[o + 1]! << 16) | (data[o + 2]! << 8) | data[o + 3]!) >>> 0;
    o += 4;
    screens.push({ id, x, y, width, height, flags });
  }
  return { fbWidth, fbHeight, reason, status, screens };
}

export function extendedDesktopSizeByteLength(numberOfScreens: number): number {
  return 4 + numberOfScreens * 16;
}
