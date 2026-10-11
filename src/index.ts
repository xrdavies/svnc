/**
 * SVNC public entry (skeleton).
 * Phase 1 will export Session / Automation APIs; see docs/roadmap.md.
 */

export const SVNC_VERSION = '0.0.0';

export type DesktopPoint = {
  /** Remote desktop X in pixels (not CSS viewport). */
  x: number;
  /** Remote desktop Y in pixels (not CSS viewport). */
  y: number;
};

// Placeholder — real client lands in Phase 1 / Phase 2.
export function createClientPlaceholder(): { version: string } {
  return { version: SVNC_VERSION };
}
