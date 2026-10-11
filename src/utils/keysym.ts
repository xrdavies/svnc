/**
 * Minimal X11 keysym map for ASCII + common keys.
 * Enough for typeText / keyPress demos; not a full keyboard layout table.
 */

const NAMED: Record<string, number> = {
  Backspace: 0xff08,
  Tab: 0xff09,
  Return: 0xff0d,
  Enter: 0xff0d,
  Escape: 0xff1b,
  Esc: 0xff1b,
  Delete: 0xffff,
  Home: 0xff50,
  End: 0xff57,
  PageUp: 0xff55,
  PageDown: 0xff56,
  Left: 0xff51,
  Up: 0xff52,
  Right: 0xff53,
  Down: 0xff54,
  ArrowLeft: 0xff51,
  ArrowUp: 0xff52,
  ArrowRight: 0xff53,
  ArrowDown: 0xff54,
  Insert: 0xff63,
  F1: 0xffbe,
  F2: 0xffbf,
  F3: 0xffc0,
  F4: 0xffc1,
  F5: 0xffc2,
  F6: 0xffc3,
  F7: 0xffc4,
  F8: 0xffc5,
  F9: 0xffc6,
  F10: 0xffc7,
  F11: 0xffc8,
  F12: 0xffc9,
  Shift: 0xffe1,
  ShiftLeft: 0xffe1,
  ShiftRight: 0xffe2,
  Control: 0xffe3,
  ControlLeft: 0xffe3,
  ControlRight: 0xffe4,
  Alt: 0xffe9,
  AltLeft: 0xffe9,
  AltRight: 0xffea,
  Meta: 0xffe7,
  MetaLeft: 0xffe7,
  MetaRight: 0xffe8,
  Super: 0xffeb,
  Space: 0x0020,
  ' ': 0x0020,
};

/** Map a DOM key name, single character, or numeric keysym to X11 keysym. */
export function toKeysym(key: string | number): number {
  if (typeof key === 'number') return key >>> 0;
  if (key.length === 1) {
    const code = key.charCodeAt(0);
    // Latin-1 maps 1:1 into keysyms for 0x20–0xff
    if (code >= 0x20 && code <= 0xff) return code;
    // Basic BMP: use unicode keysym plane 0x01000000 + codepoint (RFB extension used by many clients)
    return 0x01000000 + code;
  }
  if (Object.prototype.hasOwnProperty.call(NAMED, key)) return NAMED[key]!;
  throw new Error(`Unknown key: ${key}`);
}

/** Yield keysyms for each character of a string (Latin-1 / unicode plane). */
export function textToKeysyms(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    out.push(toKeysym(ch));
  }
  return out;
}
