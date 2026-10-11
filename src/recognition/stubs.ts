import { noRecognitionProvider, SvncError } from '../automation/errors.js';
import type { FrameSnapshot, WaitOptions } from '../automation/types.js';
import type { RecognitionProvider, UITarget } from './types.js';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitFor(
  screenshot: () => FrameSnapshot,
  provider: RecognitionProvider | null,
  query: string | RegExp | object,
  opts?: WaitOptions,
): Promise<UITarget> {
  if (!provider) throw noRecognitionProvider();
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const intervalMs = opts?.intervalMs ?? 250;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hits = await provider.find(screenshot(), query);
    if (hits.length > 0) return hits[0]!;
    await sleep(intervalMs);
  }
  throw new SvncError('TIMEOUT', `waitFor timed out after ${timeoutMs}ms`, { query: String(query) });
}

export async function clickTarget(
  screenshot: () => FrameSnapshot,
  provider: RecognitionProvider | null,
  click: (x: number, y: number) => void,
  query: string | RegExp | object,
  opts?: WaitOptions,
): Promise<void> {
  const target = await waitFor(screenshot, provider, query, opts);
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  click(cx, cy);
}

/**
 * Stub provider that never matches — documents the interface for Agents.
 * Real OCR/template/HTTP Vision stay out of core (D3).
 */
export class NullRecognitionProvider implements RecognitionProvider {
  async find(_snapshot: FrameSnapshot, _query: string | RegExp | object): Promise<UITarget[]> {
    return [];
  }
}
