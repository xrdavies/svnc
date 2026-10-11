/**
 * WebSocket binary receive buffer with blocking-style reads for the RFB state machine.
 * Inspired by the websock buffering model; original MIT code (not copied from noVNC).
 */

export class RfbTransport {
  private ws: WebSocket | null = null;
  private buffer = new Uint8Array(0);
  private waiters: Array<() => void> = [];
  private closed = false;
  private closeReason: string | null = null;

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  get isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async connect(url: string): Promise<void> {
    if (this.ws) throw new Error('Transport already connected');
    this.closed = false;
    this.closeReason = null;
    this.buffer = new Uint8Array(0);

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(`WebSocket error connecting to ${url}`));
      };
      const onClose = () => {
        cleanup();
        reject(new Error(`WebSocket closed before open: ${url}`));
      };
      const cleanup = () => {
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
        ws.removeEventListener('close', onClose);
      };

      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onError);
      ws.addEventListener('close', onClose);
    });

    const ws = this.ws!;
    ws.addEventListener('message', (ev) => {
      const data = ev.data;
      if (!(data instanceof ArrayBuffer)) return;
      this.append(new Uint8Array(data));
    });
    ws.addEventListener('close', () => {
      this.closed = true;
      this.closeReason = 'WebSocket closed';
      this.flushWaiters();
    });
  }

  attach(ws: WebSocket): void {
    if (this.ws) throw new Error('Transport already connected');
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.closed = false;
    ws.addEventListener('message', (ev) => {
      if (ev.data instanceof ArrayBuffer) this.append(new Uint8Array(ev.data));
    });
    ws.addEventListener('close', () => {
      this.closed = true;
      this.closeReason = 'WebSocket closed';
      this.flushWaiters();
    });
  }

  private append(chunk: Uint8Array): void {
    if (chunk.byteLength === 0) return;
    const next = new Uint8Array(this.buffer.byteLength + chunk.byteLength);
    next.set(this.buffer, 0);
    next.set(chunk, this.buffer.byteLength);
    this.buffer = next;
    this.flushWaiters();
  }

  private flushWaiters(): void {
    const waiters = this.waiters.splice(0);
    for (const w of waiters) w();
  }

  /** Wait until at least `n` bytes are buffered (or socket closed). */
  async waitBytes(n: number): Promise<void> {
    while (this.buffer.byteLength < n) {
      if (this.closed) {
        throw new Error(this.closeReason ?? 'Transport closed while waiting for data');
      }
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }

  async read(n: number): Promise<Uint8Array> {
    await this.waitBytes(n);
    const out = this.buffer.subarray(0, n);
    this.buffer = this.buffer.subarray(n);
    // Copy so callers can retain without aliasing the buffer head
    return out.slice();
  }

  async readString(n: number): Promise<string> {
    const bytes = await this.read(n);
    return new TextDecoder('latin1').decode(bytes);
  }

  peekLength(): number {
    return this.buffer.byteLength;
  }

  send(data: Uint8Array | ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Cannot send: WebSocket not open');
    }
    this.ws.send(data);
  }

  close(): void {
    this.closed = true;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.flushWaiters();
  }
}

/** Helpers to build big-endian RFB messages. */
export class MessageWriter {
  private chunks: Uint8Array[] = [];

  u8(v: number): this {
    this.chunks.push(Uint8Array.of(v & 0xff));
    return this;
  }

  u16(v: number): this {
    this.chunks.push(Uint8Array.of((v >>> 8) & 0xff, v & 0xff));
    return this;
  }

  u32(v: number): this {
    this.chunks.push(
      Uint8Array.of((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff),
    );
    return this;
  }

  i32(v: number): this {
    return this.u32(v | 0);
  }

  bytes(b: Uint8Array): this {
    this.chunks.push(b);
    return this;
  }

  string(s: string): this {
    const enc = new TextEncoder();
    // RFB often uses Latin-1; for ASCII names TextEncoder is fine
    this.chunks.push(enc.encode(s));
    return this;
  }

  latin1(s: string): this {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    this.chunks.push(out);
    return this;
  }

  toUint8Array(): Uint8Array {
    let len = 0;
    for (const c of this.chunks) len += c.byteLength;
    const out = new Uint8Array(len);
    let off = 0;
    for (const c of this.chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return out;
  }
}

export function readU8(buf: Uint8Array, offset: number): number {
  return buf[offset]!;
}

export function readU16(buf: Uint8Array, offset: number): number {
  return ((buf[offset]! << 8) | buf[offset + 1]!) >>> 0;
}

export function readU32(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset]! << 24) | (buf[offset + 1]! << 16) | (buf[offset + 2]! << 8) | buf[offset + 3]!) >>>
    0
  );
}

export function readI32(buf: Uint8Array, offset: number): number {
  return readU32(buf, offset) | 0;
}
