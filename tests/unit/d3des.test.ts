import { describe, expect, it } from 'vitest';
import { vncEncryptChallenge, vncPasswordKey } from '../../src/rfb/d3des.js';

describe('VNC DES auth', () => {
  it('builds 8-byte bit-reversed key', () => {
    const key = vncPasswordKey('password');
    expect(key.byteLength).toBe(8);
  });

  it('encrypts 16-byte challenge deterministically', () => {
    const challenge = new Uint8Array(16);
    for (let i = 0; i < 16; i++) challenge[i] = i;
    const a = vncEncryptChallenge('secret', challenge);
    const b = vncEncryptChallenge('secret', challenge);
    expect(a.byteLength).toBe(16);
    expect([...a]).toEqual([...b]);
    // Different password → different response
    const c = vncEncryptChallenge('secret!', challenge);
    expect([...a].join(',')).not.toBe([...c].join(','));
  });

  it('matches OpenSSL DES-ECB VNC vector for password', () => {
    const challenge = Uint8Array.from({ length: 16 }, (_, i) => i);
    const out = vncEncryptChallenge('password', challenge);
    expect(Buffer.from(out).toString('hex')).toBe('b866924125c8eebb9debc1db61c538e2');
  });
});
