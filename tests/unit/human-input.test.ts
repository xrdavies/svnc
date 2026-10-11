import { describe, expect, it } from 'vitest';
import { eventToDesktopPoint } from '../../src/input/human-input.js';

describe('eventToDesktopPoint', () => {
  it('maps CSS box to framebuffer pixels with scale', () => {
    const canvas = {
      width: 1280,
      height: 720,
      getBoundingClientRect: () => ({
        left: 100,
        top: 50,
        width: 640,
        height: 360,
        right: 740,
        bottom: 410,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      }),
    } as unknown as HTMLCanvasElement;

    // click center of CSS box → center of FB
    const mid = eventToDesktopPoint(100 + 320, 50 + 180, canvas, { width: 1280, height: 720, name: '' });
    expect(mid).toEqual({ x: 640, y: 360 });

    // top-left
    expect(eventToDesktopPoint(100, 50, canvas, { width: 1280, height: 720, name: '' })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('clamps outside the canvas CSS box', () => {
    const canvas = {
      width: 100,
      height: 100,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    } as unknown as HTMLCanvasElement;
    expect(eventToDesktopPoint(-10, -10, canvas, { width: 100, height: 100, name: '' })).toEqual({
      x: 0,
      y: 0,
    });
    expect(eventToDesktopPoint(500, 500, canvas, { width: 100, height: 100, name: '' })).toEqual({
      x: 99,
      y: 99,
    });
  });
});
