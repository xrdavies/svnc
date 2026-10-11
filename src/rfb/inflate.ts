/**
 * Stateful inflate for Tight (4× raw deflate) and ZRLE (zlib).
 * Uses fflate so browser and Node share one implementation.
 */

import { Inflate, inflateSync, unzlibSync } from 'fflate';

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 0) return new Uint8Array(0);
  if (chunks.length === 1) return chunks[0]!;
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Continuous raw-deflate stream (no zlib wrapper). */
export class RawDeflateStream {
  private inflator: Inflate | null = null;
  /** Output sink referenced by the Inflate callback (must be stable across pushes). */
  private sink: Uint8Array[] = [];

  reset(): void {
    this.inflator = null;
    this.sink = [];
  }

  inflate(chunk: Uint8Array): Uint8Array {
    if (!this.inflator) {
      this.sink = [];
      this.inflator = new Inflate((data) => {
        if (data && data.length) this.sink.push(data.slice());
      });
    }
    this.sink = [];
    this.inflator.push(chunk, false);
    return concatChunks(this.sink);
  }
}

/**
 * ZRLE: one zlib stream per connection; servers usually flush each rectangle
 * so unzlibSync often works. Falls back to persistent raw-deflate after header.
 */
export class ZrleInflater {
  private stream = new RawDeflateStream();
  private needHeader = true;

  reset(): void {
    this.stream.reset();
    this.needHeader = true;
  }

  inflate(zlibData: Uint8Array): Uint8Array {
    try {
      const out = unzlibSync(zlibData);
      this.needHeader = true;
      this.stream.reset();
      return out;
    } catch {
      /* continued stream across rectangles */
    }

    let data = zlibData;
    if (this.needHeader) {
      if (data.length < 2) throw new Error('ZRLE zlib truncated header');
      let off = 2;
      if (data[1]! & 0x20) off += 4;
      data = data.subarray(off);
      this.needHeader = false;
    }
    return this.stream.inflate(data);
  }
}

/** Tight: four independent raw-deflate streams selected by control byte. */
export class TightInflatePool {
  private streams = [0, 1, 2, 3].map(() => new RawDeflateStream());

  reset(id: number): void {
    this.streams[id & 3]?.reset();
  }

  resetAll(): void {
    for (const s of this.streams) s.reset();
  }

  inflate(streamId: number, data: Uint8Array): Uint8Array {
    return this.streams[streamId & 3]!.inflate(data);
  }
}

export function inflateRawOnce(data: Uint8Array): Uint8Array {
  return inflateSync(data);
}

export function unzlibOnce(data: Uint8Array): Uint8Array {
  return unzlibSync(data);
}
