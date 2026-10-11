import { describe, expect, it } from 'vitest';
import { MessageWriter, readU16, readU32 } from '../../src/rfb/transport.js';

describe('MessageWriter / readers', () => {
  it('writes big-endian fields', () => {
    const buf = new MessageWriter().u8(3).u16(0x1234).u32(0x01020304).toUint8Array();
    expect([...buf]).toEqual([3, 0x12, 0x34, 1, 2, 3, 4]);
    expect(readU16(buf, 1)).toBe(0x1234);
    expect(readU32(buf, 3)).toBe(0x01020304);
  });
});
