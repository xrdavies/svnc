import { describe, expect, it } from 'vitest';
import {
  notConnected,
  outOfBounds,
  SvncError,
  viewOnly,
  noRecognitionProvider,
} from '../../src/automation/errors.js';

describe('SvncError', () => {
  it('carries code', () => {
    const e = notConnected('click');
    expect(e).toBeInstanceOf(SvncError);
    expect(e.code).toBe('NOT_CONNECTED');
  });

  it('viewOnly / oob / recognition', () => {
    expect(viewOnly('typeText').code).toBe('VIEW_ONLY');
    expect(outOfBounds(9, 9, 8, 8).code).toBe('OUT_OF_BOUNDS');
    expect(noRecognitionProvider().code).toBe('NO_RECOGNITION_PROVIDER');
  });
});
