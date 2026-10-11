# Clipboard path for `typeText` / `clipboardWrite`

## RFB mechanism

- **Client → Server:** `ClientCutText` (SVNC `clipboardWrite`)
- **Server → Client:** `ServerCutText` (emitted as `clipboard` event)
- **Paste into focused remote app:** usually a **remote OS shortcut** after cut-text is set

## `typeText` modes

| Mode | Behavior | When to use |
|------|----------|-------------|
| Default (`viaClipboard: false`) | Series of RFB `KeyEvent` keysyms | Short ASCII / Latin-1 |
| `viaClipboard: true` | `clipboardWrite` + Ctrl+V | Longer strings; fewer key events |

## OS differences (known issues)

| Remote OS | Typical paste | Notes |
|-----------|---------------|-------|
| Windows | Ctrl+V | Works for many apps |
| Linux (X11) | Ctrl+V | Depends on toolkit; some use Shift+Insert |
| macOS | Super/Cmd+V | SVNC’s current `viaClipboard` helper sends **Ctrl+V** — may need a future `pasteChord` option |

IME / CJK composition is **not** handled by per-keysym typing; prefer clipboard paste for non-Latin text.

## Security

Clipboard APIs can exfiltrate or inject secrets. Agents should treat cut-text as sensitive and avoid logging full payloads.
