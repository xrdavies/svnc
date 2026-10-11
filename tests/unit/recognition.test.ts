import { describe, expect, it } from 'vitest';
import { SvncError } from '../../src/automation/errors.js';
import type { FrameSnapshot } from '../../src/automation/types.js';
import { clickTarget, NullRecognitionProvider, waitFor } from '../../src/recognition/stubs.js';
import type { UITarget } from '../../src/recognition/types.js';

function fakeSnap(): FrameSnapshot {
  return {
    width: 10,
    height: 10,
    imageData: { data: new Uint8ClampedArray(10 * 10 * 4), width: 10, height: 10, colorSpace: 'srgb' } as ImageData,
    timestamp: 1,
  };
}

describe('recognition stubs', () => {
  it('waitFor throws without provider', async () => {
    await expect(waitFor(fakeSnap, null, 'x')).rejects.toMatchObject({ code: 'NO_RECOGNITION_PROVIDER' });
  });

  it('waitFor returns first hit', async () => {
    const target: UITarget = { x: 1, y: 2, width: 3, height: 4 };
    const provider = {
      async find() {
        return [target];
      },
    };
    await expect(waitFor(fakeSnap, provider, 'btn')).resolves.toEqual(target);
  });

  it('clickTarget clicks center', async () => {
    const clicks: Array<[number, number]> = [];
    const provider = {
      async find() {
        return [{ x: 10, y: 20, width: 10, height: 10 }];
      },
    };
    await clickTarget(fakeSnap, provider, (x, y) => clicks.push([x, y]), 'q');
    expect(clicks[0]).toEqual([15, 25]);
  });

  it('NullRecognitionProvider times out', async () => {
    await expect(
      waitFor(fakeSnap, new NullRecognitionProvider(), 'x', { timeoutMs: 30, intervalMs: 10 }),
    ).rejects.toBeInstanceOf(SvncError);
  });
});
