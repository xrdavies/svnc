# Automation API 概览

> 权威类型：[`src/automation/types.ts`](../src/automation/types.ts)  
> 门面实现：[`src/client/SVNCClient.ts`](../src/client/SVNCClient.ts)  
> 错误：[`src/automation/errors.ts`](../src/automation/errors.ts)  
> 公开导出：[`src/index.ts`](../src/index.ts)

坐标空间一律为 **远端桌面像素**（framebuffer），不是 CSS 视口。会话若要执行 `click` / `typeText` 等，必须 **`viewOnly: false`**（**D6**）。

## 入口

```ts
import {
  SVNCClient,
  SvncError,
  NullRecognitionProvider,
  attachHumanInput,
  eventToDesktopPoint,
  toKeysym,
  textToKeysyms,
} from '@xrdavies/svnc';
import type {
  AutomationSurface,
  ConnectOptions,
  FrameSnapshot,
  RecognitionProvider,
  UITarget,
} from '@xrdavies/svnc';
```

### `SVNCClient.connect`

```ts
static connect(target: HTMLElement | null, options: ConnectOptions): Promise<SVNCClient>
```

- `target`：可选挂载点；为 `null` 时仍可建立会话（显示 canvas 由实现持有，可通过 `client.canvas` 取到）。
- 返回已完成 RFB 握手的客户端；失败抛出 `SvncError`（如 `AUTH_FAILED`、`PROTOCOL_ERROR`、`TRANSPORT_ERROR`）。

## `ConnectOptions`

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | `string` | 承载 RFB 字节的 WebSocket URL（如 `ws://host:6080/`） |
| `credentials` | `{ username?, password? }` | 可选；同时有 `username` 与 `password` 且服务端提供时优先 Apple Remote Desktop（type 30，macOS 用户登录）；仅 `password` 时协商 VNC Auth |
| `shared` | `boolean` | RFB shared-flag，默认 `true` |
| `viewOnly` | `boolean` | `true` 时输入类 API 抛 `VIEW_ONLY`；自动化须 `false`（D6） |
| `preferredEncodings` | `Array<'raw' \| 'tight' \| 'zrle' \| 'hextile' \| 'rre' \| 'copyrect'>` | 向服务端声明偏好；实际以协商为准 |
| `inputMode` | `'human' \| 'script' \| 'mixed'` | 谁可驱动输入；默认 `mixed` |
| `enableHumanInput` | `boolean` | 为 `false` 时即使有 target 也不挂 DOM 监听；默认 `true` |

## `AutomationSurface`（`SVNCClient` 实现）

### 只读状态

| 成员 | 说明 |
|------|------|
| `desktop` | `{ width, height, name }` |
| `connected` | 是否仍连接 |
| `viewOnly` | 是否只读会话 |
| `inputMode` | 可读写；切换人工/脚本仲裁 |
| `canvas`（仅 `SVNCClient`） | 显示用 `HTMLCanvasElement` |

### 截图

| 方法 | 说明 |
|------|------|
| `screenshot()` | 返回 `FrameSnapshot`：`width` / `height` / `imageData`（RGBA `ImageData`）/ `timestamp` |
| `toDataURL(type?, quality?)` | Canvas `toDataURL` |
| `toBlob(type?, quality?)` | `Promise<Blob>` |

**D3：** 核心不内置 OCR / HTTP Vision；Agent 应自行消费截图。

### 鼠标（桌面坐标）

| 方法 | 说明 |
|------|------|
| `moveTo(x, y)` | 移动指针 |
| `mouseDown(button?)` / `mouseUp(button?)` | `button`：`'left' \| 'middle' \| 'right' \| 'back' \| 'forward'`，默认 left |
| `click(x, y, button?)` | 移动并单击 |
| `dblclick(x, y)` | 双击 |
| `drag(from, to, opts?)` | `opts.steps` / `opts.stepDelayMs`；异步 |
| `scroll(x, y, dx, dy)` | 在 `(x,y)` 处滚轮（符号约定见实现） |

越界坐标抛 `OUT_OF_BOUNDS`；未连接抛 `NOT_CONNECTED`。

### 键盘与文本

| 方法 | 说明 |
|------|------|
| `keyDown` / `keyUp` / `keyPress` | 参数为 DOM 键名、单字符或数值 keysym；见 [`toKeysym`](../src/utils/keysym.ts) |
| `typeText(text, opts?)` | `opts.delayMs`；`opts.viaClipboard: true` 时走剪贴板 + Ctrl+V（见 [clipboard.md](./clipboard.md)） |

常用具名键：`Enter` / `Return`、`Tab`、`Escape`、方向键、`F1`–`F12`、修饰键等（完整表见 `src/utils/keysym.ts` 的 `NAMED`）。

### 剪贴板

| 方法 | 说明 |
|------|------|
| `clipboardWrite(text)` | 客户端 → 服务端 `ClientCutText` |

服务端 → 客户端的 cut-text 通过事件 `clipboard` 抛出。

### 事件

```ts
client.on(event, handler);
client.off(event, handler);
```

`AutomationSurface` 类型声明的事件名：

| 事件 | 典型 payload | 说明 |
|------|----------------|------|
| `connect` | — | 握手完成 |
| `disconnect` | 可选错误 | 连接结束 |
| `desktopname` | `string` | 桌面名 |
| `clipboard` | `string` | 服务端 cut-text |
| `frame` | `{ damage: DamageRect[] }` | 帧/脏区更新 |
| `error` | `unknown` | 读循环等错误 |

实现上 `RfbSession` 还会发出 `desktopsize`、`extendeddesktopsize`、`cursor` 等；需要时可同样 `on` 订阅（类型声明未全部收窄）。

### 生命周期

`disconnect()` — 关闭传输并卸下人工输入监听。

## Recognition（可选）

默认无 Provider。注册后才可 `find` / `waitFor` / `clickTarget`：

```ts
client.useRecognition(provider); // RecognitionProvider
const hits = await client.find(query);          // UITarget[]
const one = await client.waitFor(query, { timeoutMs?, intervalMs? });
await client.clickTarget(query, opts);          // 点中第一个命中中心
```

```ts
interface RecognitionProvider {
  find(snapshot: FrameSnapshot, query: string | RegExp | object): Promise<UITarget[]>;
}

type UITarget = {
  x: number; y: number; width: number; height: number;
  label?: string; text?: string; confidence?: number;
};
```

未注册时上述方法抛 `NO_RECOGNITION_PROVIDER`。内置 [`NullRecognitionProvider`](../src/recognition/stubs.ts) 永远返回空数组，仅作接口示例。

## `SvncErrorCode`

| Code | 典型场景 |
|------|----------|
| `NOT_CONNECTED` | 未连接却调用输入/截图侧写 |
| `VIEW_ONLY` | `viewOnly` 会话调用输入 |
| `OUT_OF_BOUNDS` | 坐标超出桌面 |
| `INVALID_STATE` | 非法状态 |
| `UNSUPPORTED` | 能力不支持 |
| `TIMEOUT` | `waitFor` 超时 |
| `NO_RECOGNITION_PROVIDER` | 未 `useRecognition` |
| `AUTH_FAILED` | 认证失败 |
| `PROTOCOL_ERROR` | RFB 协议异常 |
| `TRANSPORT_ERROR` | WebSocket / IO |

```ts
try {
  await SVNCClient.connect(el, opts);
} catch (e) {
  if (e instanceof SvncError) console.error(e.code, e.message, e.details);
}
```

## `inputMode` 行为摘要

| 模式 | Automation API | Canvas DOM 人工输入 |
|------|----------------|---------------------|
| `script` | ✅ | ❌ |
| `human` | ✅ | ✅（非 viewOnly） |
| `mixed` | ✅ | ✅（非 viewOnly） |

## 低层导出（进阶）

| 导出 | 用途 |
|------|------|
| `RfbSession` | 不经 `SVNCClient` 直接驱动会话 |
| `CanvasDisplay` | 显示缓冲 |
| `attachHumanInput` / `eventToDesktopPoint` | 自定义挂载人工输入 |
| `toKeysym` / `textToKeysyms` | 键名 ↔ keysym |

架构与目录对照见 [architecture.md](./architecture.md)。

