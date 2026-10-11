import type { FrameSnapshot } from '../automation/types.js';

export type UITarget = {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  text?: string;
  confidence?: number;
};

/**
 * Pluggable UI recognition (Phase 4).
 * Default product path (D3): Agents call screenshot() themselves — providers are optional.
 */
export interface RecognitionProvider {
  find(snapshot: FrameSnapshot, query: string | RegExp | object): Promise<UITarget[]>;
}
