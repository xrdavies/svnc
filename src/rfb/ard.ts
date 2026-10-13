/**
 * Apple Remote Desktop authentication (RFB security type 30), used by macOS Screen Sharing
 * to sign in as a macOS user. Unlike VNC Auth, the server then attaches the client to that
 * user's session instead of the login window.
 *
 * Protocol: the server sends a Diffie-Hellman generator, key length, prime and its public key.
 * The client derives the shared secret, uses MD5(secret) as an AES-128 key, and sends
 * AES-ECB(username[64] ‖ password[64]) followed by its own public key.
 */

export type ArdParams = {
  generator: number;
  prime: Uint8Array;
  serverKey: Uint8Array;
};

export type ArdResponse = {
  /** 128 bytes: encrypted username and password fields. */
  credentials: Uint8Array;
  /** Client public key, padded to the server's key length. */
  publicKey: Uint8Array;
};

type RandomFn = (n: number) => Uint8Array;

const defaultRandom: RandomFn = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export function bytesToBigInt(bytes: Uint8Array): bigint {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n;
}

export function bigIntToBytes(n: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}

/** RFC 1321 MD5 (WebCrypto has none). */
export function md5(data: Uint8Array): Uint8Array {
  const s = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const padded = new Uint8Array(((data.length + 72) >>> 6) << 6);
  padded.set(data);
  padded[data.length] = 0x80;
  const bits = data.length * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bits >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bits / 2 ** 32), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < padded.length; off += 64) {
    const m = Array.from({ length: 16 }, (_, i) => view.getUint32(off + i * 4, true));
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) [f, g] = [(b & c) | (~b & d), i];
      else if (i < 32) [f, g] = [(d & b) | (~d & c), (5 * i + 1) % 16];
      else if (i < 48) [f, g] = [b ^ c ^ d, (3 * i + 5) % 16];
      else [f, g] = [c ^ (b | ~d), (7 * i) % 16];
      const sum = (a + f + k[i]! + m[g]!) >>> 0;
      const shift = s[(i >> 4) * 4 + (i % 4)]!;
      [a, d, c] = [d, c, b];
      b = (b + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((w, i) => ov.setUint32(i * 4, w, true));
  return out;
}

/** AES-128-ECB without padding: each block is a one-block AES-CBC with a zero IV. */
export async function aesEcbEncrypt(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  if (data.length % 16 !== 0) throw new Error('AES-ECB input must be a multiple of 16 bytes');
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto is unavailable (use https/wss or localhost)');
  const k = await subtle.importKey('raw', key as BufferSource, { name: 'AES-CBC' }, false, ['encrypt']);
  const out = new Uint8Array(data.length);
  const iv = new Uint8Array(16);
  for (let off = 0; off < data.length; off += 16) {
    const block = await subtle.encrypt({ name: 'AES-CBC', iv }, k, data.subarray(off, off + 16) as BufferSource);
    out.set(new Uint8Array(block, 0, 16), off);
  }
  return out;
}

/** Writes a NUL-terminated UTF-8 string (max 63 bytes) into a 64-byte field of random filler. */
function field(value: string, random: RandomFn): Uint8Array {
  const out = random(64);
  const bytes = new TextEncoder().encode(value).subarray(0, 63);
  out.set(bytes);
  out[bytes.length] = 0;
  return out;
}

export async function ardResponse(
  params: ArdParams,
  username: string,
  password: string,
  random: RandomFn = defaultRandom,
): Promise<ArdResponse> {
  const keyLength = params.prime.length;
  const p = bytesToBigInt(params.prime);
  const privateKey = bytesToBigInt(random(keyLength)) % p;
  const publicKey = bigIntToBytes(modPow(BigInt(params.generator), privateKey, p), keyLength);
  const secret = bigIntToBytes(modPow(bytesToBigInt(params.serverKey), privateKey, p), keyLength);
  const plain = new Uint8Array(128);
  plain.set(field(username, random), 0);
  plain.set(field(password, random), 64);
  return { credentials: await aesEcbEncrypt(md5(secret), plain), publicKey };
}
