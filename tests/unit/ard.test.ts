import { createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { aesEcbEncrypt, ardResponse, bigIntToBytes, bytesToBigInt, md5, modPow } from '../../src/rfb/ard.js';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const text = (s: string) => new TextEncoder().encode(s);

describe('ARD primitives', () => {
  it('md5 matches RFC 1321 and node', () => {
    expect(hex(md5(text('')))).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(hex(md5(text('abc')))).toBe('900150983cd24fb0d6963f7d28e17f72');
    for (const n of [55, 56, 63, 64, 65, 200]) {
      const data = randomBytes(n);
      expect(hex(md5(data))).toBe(createHash('md5').update(data).digest('hex'));
    }
  });

  it('aesEcbEncrypt matches FIPS-197 and has no padding', async () => {
    const key = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
    const block = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    const out = await aesEcbEncrypt(key, new Uint8Array([...block, ...block]));
    expect(out.length).toBe(32);
    expect(hex(out.subarray(0, 16))).toBe('69c4e0d86a7b0430d8cdb78070b4c55a');
    expect(hex(out.subarray(16))).toBe('69c4e0d86a7b0430d8cdb78070b4c55a');
    await expect(aesEcbEncrypt(key, new Uint8Array(15))).rejects.toThrow();
  });

  it('bigint helpers round-trip', () => {
    const b = Uint8Array.of(0, 1, 2, 255);
    expect(hex(bigIntToBytes(bytesToBigInt(b), 4))).toBe('000102ff');
    expect(modPow(4n, 13n, 497n)).toBe(445n);
  });
});

describe('ardResponse', () => {
  it('lets the server recover user name and password', async () => {
    const prime = Buffer.from(
      'ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a63a3620ffffffffffffffff',
      'hex',
    );
    const p = bytesToBigInt(prime);
    const serverPrivate = bytesToBigInt(randomBytes(prime.length)) % p;
    const serverKey = bigIntToBytes(modPow(2n, serverPrivate, p), prime.length);
    const res = await ardResponse({ generator: 2, prime, serverKey }, 'frozen', 'pässwörd');
    expect(res.credentials.length).toBe(128);
    expect(res.publicKey.length).toBe(prime.length);

    const secret = bigIntToBytes(modPow(bytesToBigInt(res.publicKey), serverPrivate, p), prime.length);
    const key = createHash('md5').update(secret).digest();
    const d = createDecipheriv('aes-128-ecb', key, null).setAutoPadding(false);
    const plain = Buffer.concat([d.update(res.credentials), d.final()]);
    const cstr = (b: Buffer) => b.subarray(0, b.indexOf(0)).toString('utf8');
    expect(cstr(plain.subarray(0, 64))).toBe('frozen');
    expect(cstr(plain.subarray(64))).toBe('pässwörd');
  });
});
