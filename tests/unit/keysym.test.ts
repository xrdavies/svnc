import { describe, expect, it } from 'vitest';
import { textToKeysyms, toKeysym } from '../../src/utils/keysym.js';

describe('toKeysym', () => {
  it('maps ASCII characters', () => {
    expect(toKeysym('a')).toBe(0x61);
    expect(toKeysym('A')).toBe(0x41);
    expect(toKeysym(' ')).toBe(0x20);
  });

  it('maps named keys', () => {
    expect(toKeysym('Enter')).toBe(0xff0d);
    expect(toKeysym('Backspace')).toBe(0xff08);
    expect(toKeysym('Control')).toBe(0xffe3);
  });

  it('passes through numeric keysyms', () => {
    expect(toKeysym(0xff0d)).toBe(0xff0d);
  });

  it('maps text to keysym list', () => {
    expect(textToKeysyms('Hi')).toEqual([0x48, 0x69]);
  });
});
