# SVNC 快速开始

> 对应实现：`SVNCClient`（[`src/client/SVNCClient.ts`](../src/client/SVNCClient.ts)）  
> 更完整的本地拓扑：[e2e-local.md](./e2e-local.md) · API 一览：[automation-api.md](./automation-api.md)

## 1. 你需要什么

1. **Node.js ≥ 18**（开发 / 构建）与现代浏览器（运行时需 **WebSocket** + **Canvas**）。
2. 一条能承载 **RFB 字节** 的 **WebSocket** 路径：
   - 经典 TCP VNC（TigerVNC / x11vnc 等）→ 前面加 [websockify](https://github.com/novnc/websockify)；或
   - 本身提供 WebSocket 的 VNC 服务。
3. 自动化输入时会话必须 **`viewOnly: false`**（决策 **D6**）。

SVNC **不**自带生产级 TCP↔WS 桥；见 [websockify-decision.md](./websockify-decision.md)。生产加密放外围（WSS / VPN / SSH），见 [peripheral-security.md](./peripheral-security.md)（**D7**）。

## 2. 安装

```bash
npm install svnc
```

从本仓库开发：

```bash
git clone https://github.com/xrdavies/svnc.git
cd svnc
npm install
npm run build
```

## 3. 最快：用仓库自带本地 e2e

在已克隆的仓库根目录：

```bash
npm run build
npm run e2e:start
```

然后浏览器打开：

| 页面 | URL |
|------|-----|
| Lite | http://127.0.0.1:8080/examples/lite/ |
| Demo | http://127.0.0.1:8080/examples/demo/ |

默认 WebSocket：`ws://127.0.0.1:6080/` · 密码：`svnc-demo`。

停止：`npm run e2e:stop`。协议与浏览器自动化验收：`npm run e2e:verify`。细节见 [e2e-local.md](./e2e-local.md)。

## 4. 最小网页接入

在页面里提供一个挂载点（例如 `<div id="screen"></div>`），连接后 canvas 会画到该元素内（或由会话自建 canvas）：

```ts
import { SVNCClient } from 'svnc';

const mount = document.getElementById('screen');

const client = await SVNCClient.connect(mount, {
  url: 'ws://127.0.0.1:6080/',
  credentials: { password: 'svnc-demo' }, // 若服务端要求 VNC Auth
  viewOnly: false, // Agent / 脚本注入输入时必须为 false（D6）
  inputMode: 'mixed', // 'human' | 'script' | 'mixed'；默认 mixed
});

console.log(client.desktop); // { width, height, name }

// Agent：截图后自行分析（D3：核心不内置 OCR/视觉）
const snap = client.screenshot();
const dataUrl = client.toDataURL('image/png');

// 桌面像素坐标（不是 CSS 视口）
client.click(120, 80);
await client.typeText('hello');

client.on('frame', (payload) => {
  // payload: { damage: DamageRect[] }
});

client.disconnect();
```

打包场景也可直接引用构建产物，例如 Demo / Lite：`import { SVNCClient } from '../../dist/index.js'`（需先 `npm run build`）。

## 5. 人工键鼠

- `inputMode` 为 `human` 或 `mixed`，且非 `viewOnly` 时，会把 canvas 上的 DOM 鼠标/键盘转到 RFB（[`attachHumanInput`](../src/input/human-input.ts)）。
- `script`：只允许 Automation API，忽略画布人工输入（适合无人值守 Agent）。
- 点一下画布以获取键盘焦点后再打字。

## 6. Agent 推荐闭环

```text
connect (viewOnly: false)
  → screenshot() / toDataURL() / toBlob()
  → 外部模型或规则做识别与决策
  → click / drag / scroll / typeText / keyPress
  → 等 frame（或 sleep）→ 再截图
```

可选：`useRecognition(provider)` + `find` / `waitFor` / `clickTarget`（需你实现 [`RecognitionProvider`](../src/recognition/types.ts)）。默认产品路径是 **截图 API + 外部 Agent**（**D3**），见 [automation-api.md](./automation-api.md)。

示例：[`examples/agent-screenshot/`](../examples/agent-screenshot/)、[`examples/agent-github-nav/`](../examples/agent-github-nav/)。

## 7. 下一步

- API 细节与错误码 → [automation-api.md](./automation-api.md)
- 模块结构 → [architecture.md](./architecture.md)
- 安全嵌入清单 → [security.md](./security.md)
- 文档总目录 → [README.md](./README.md)

