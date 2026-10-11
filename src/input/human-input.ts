/**
 * Forward DOM mouse/keyboard events from the display canvas to RFB APIs.
 * Coordinates are mapped from CSS box → framebuffer (desktop) pixels.
 * Active when inputMode is `human` or `mixed`, and the session is not viewOnly.
 */

import type { DesktopInfo, InputMode, MouseButton } from '../automation/types.js';

export type HumanInputSession = {
  readonly connected: boolean;
  readonly viewOnly: boolean;
  inputMode: InputMode;
  readonly desktop: DesktopInfo;
  moveTo(x: number, y: number): void;
  mouseDown(button?: MouseButton): void;
  mouseUp(button?: MouseButton): void;
  scroll(x: number, y: number, dx: number, dy: number): void;
  keyDown(key: string | number, code?: string): void;
  keyUp(key: string | number, code?: string): void;
};

const DOM_BUTTON: Record<number, MouseButton> = {
  0: 'left',
  1: 'middle',
  2: 'right',
  3: 'back',
  4: 'forward',
};

/** Map a mouse event position on the canvas to clamped desktop pixels. */
export function eventToDesktopPoint(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  desktop: DesktopInfo,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const cssW = rect.width || canvas.width || 1;
  const cssH = rect.height || canvas.height || 1;
  const fbW = canvas.width || desktop.width || 1;
  const fbH = canvas.height || desktop.height || 1;
  let x = Math.floor(((clientX - rect.left) * fbW) / cssW);
  let y = Math.floor(((clientY - rect.top) * fbH) / cssH);
  const maxX = Math.max(0, (desktop.width || fbW) - 1);
  const maxY = Math.max(0, (desktop.height || fbH) - 1);
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x > maxX) x = maxX;
  if (y > maxY) y = maxY;
  return { x, y };
}

function humanAllowed(session: HumanInputSession): boolean {
  return (
    session.connected &&
    !session.viewOnly &&
    (session.inputMode === 'human' || session.inputMode === 'mixed')
  );
}

/**
 * Attach listeners to `canvas`. Returns a disposer (also called on disconnect).
 */
export function attachHumanInput(canvas: HTMLCanvasElement, session: HumanInputSession): () => void {
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Remote desktop');
  if (!canvas.style.outline) canvas.style.outline = 'none';
  if (!canvas.style.cursor) canvas.style.cursor = 'default';
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';

  let disposed = false;
  let dragging = false;
  const pressed = new Set<MouseButton>();

  const onMove = (ev: MouseEvent) => {
    if (disposed || !humanAllowed(session)) return;
    if (!dragging && ev.target !== canvas && !pressed.size) return;
    const { x, y } = eventToDesktopPoint(ev.clientX, ev.clientY, canvas, session.desktop);
    try {
      session.moveTo(x, y);
    } catch {
      /* ignore OOB / disconnect races */
    }
  };

  const onDown = (ev: MouseEvent) => {
    if (disposed || !humanAllowed(session)) return;
    const btn = DOM_BUTTON[ev.button];
    if (!btn) return;
    ev.preventDefault();
    canvas.focus({ preventScroll: true });
    dragging = true;
    const { x, y } = eventToDesktopPoint(ev.clientX, ev.clientY, canvas, session.desktop);
    try {
      session.moveTo(x, y);
      session.mouseDown(btn);
      pressed.add(btn);
    } catch {
      /* ignore */
    }
  };

  const onUp = (ev: MouseEvent) => {
    if (disposed) return;
    const btn = DOM_BUTTON[ev.button];
    if (!btn) return;
    if (!pressed.has(btn) && !dragging) return;
    if (humanAllowed(session)) {
      const { x, y } = eventToDesktopPoint(ev.clientX, ev.clientY, canvas, session.desktop);
      try {
        session.moveTo(x, y);
        session.mouseUp(btn);
      } catch {
        /* ignore */
      }
    }
    pressed.delete(btn);
    if (!pressed.size) dragging = false;
  };

  const onLeave = () => {
    // Keep pointer position; do not force-release (matches common VNC UX while dragging
    // continues via document listeners). No-op placeholder for clarity.
  };

  const onWheel = (ev: WheelEvent) => {
    if (disposed || !humanAllowed(session)) return;
    ev.preventDefault();
    const { x, y } = eventToDesktopPoint(ev.clientX, ev.clientY, canvas, session.desktop);
    const stepsY = Math.min(8, Math.max(1, Math.round(Math.abs(ev.deltaY) / 40) || 1));
    const stepsX = Math.min(8, Math.max(1, Math.round(Math.abs(ev.deltaX) / 40) || 1));
    const dy = ev.deltaY === 0 ? 0 : ev.deltaY > 0 ? stepsY : -stepsY;
    const dx = ev.deltaX === 0 ? 0 : ev.deltaX > 0 ? stepsX : -stepsX;
    try {
      session.scroll(x, y, dx, dy);
    } catch {
      /* ignore */
    }
  };

  const onContextMenu = (ev: Event) => {
    if (!humanAllowed(session)) return;
    ev.preventDefault();
  };

  const onKeyDown = (ev: KeyboardEvent) => {
    if (disposed || !humanAllowed(session)) return;
    if (ev.target !== canvas) return;
    // Let browser keep F5 / Ctrl+L etc. only when modifiers target chrome — block when focused on canvas
    ev.preventDefault();
    ev.stopPropagation();
    try {
      session.keyDown(ev.key, ev.code);
    } catch {
      /* unknown key */
    }
  };

  const onKeyUp = (ev: KeyboardEvent) => {
    if (disposed || !humanAllowed(session)) return;
    if (ev.target !== canvas) return;
    ev.preventDefault();
    ev.stopPropagation();
    try {
      session.keyUp(ev.key, ev.code);
    } catch {
      /* unknown key */
    }
  };

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('keyup', onKeyUp);
  // Capture mouseup/move on document so drag continues outside the canvas
  document.addEventListener('mouseup', onUp);
  document.addEventListener('mousemove', onMove);

  return () => {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mouseleave', onLeave);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);
    canvas.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('mousemove', onMove);
    for (const btn of pressed) {
      try {
        if (session.connected && !session.viewOnly) session.mouseUp(btn);
      } catch {
        /* ignore */
      }
    }
    pressed.clear();
    dragging = false;
  };
}
