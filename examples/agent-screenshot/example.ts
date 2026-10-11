/**
 * Sketch: external AI Agent loop using only screenshot + input APIs (D3).
 * Not executed in CI — no live VNC server assumed.
 */

import { SVNCClient, type FrameSnapshot } from '../../src/index.js';

/** Replace with your multimodal / CV stack. */
async function agentDecide(snapshot: FrameSnapshot): Promise<
  | { type: 'click'; x: number; y: number }
  | { type: 'type'; text: string }
  | { type: 'done' }
> {
  // Example heuristic placeholder: always "done"
  void snapshot;
  return { type: 'done' };
}

export async function runAgentLoop(wsUrl: string, password?: string): Promise<void> {
  const client = await SVNCClient.connect(null, {
    url: wsUrl,
    credentials: password ? { password } : undefined,
    viewOnly: false,
  });

  client.on('frame', async () => {
    // Prefer event-driven observation over sleep polling when possible
  });

  try {
    for (let step = 0; step < 20; step++) {
      const snap = client.screenshot();
      const action = await agentDecide(snap);
      if (action.type === 'done') break;
      if (action.type === 'click') client.click(action.x, action.y);
      if (action.type === 'type') await client.typeText(action.text);
    }
  } finally {
    client.disconnect();
  }
}
