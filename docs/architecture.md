# SVNC 架构索引

> 运行时主路径：**自研 Lean RFB**（`RfbSession` + `SVNCClient`）。  
> Wrap / `@novnc/novnc` 已非依赖；历史适配在 [`examples/archive/`](../examples/archive/)。  
> 决策背景：[build-vs-wrap-decision.md](./build-vs-wrap-decision.md)、[roadmap.md](./roadmap.md)。

## 1. 逻辑分层

```text
┌─────────────────────────────────────────────────────────┐
│  宿主页面 / AI Agent                                      │
│  screenshot → 外部识别 → click / typeText / …            │
└───────────────────────────┬─────────────────────────────┘
                            │
                    SVNCClient（门面）
              AutomationSurface + Recognition 钩子
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   RfbSession         CanvasDisplay      Human Input
   握手·认证·编码       帧缓冲·Canvas      DOM → 桌面坐标
   Pointer/Key/Clip
          │
          ▼
   WebSocket Transport  ── RFB bytes ──►  websockify / 原生 WS VNC
                                              │
                                              ▼
                                         TCP VNC Server
```

- **传输加密**不在本库 RFB 层（**D7**）：WSS 反代 / VPN / SSH，见 [peripheral-security.md](./peripheral-security.md)。
- **识别**默认在库外（**D3**）；可选 `RecognitionProvider`。

## 2. `src/` 目录对照

| 路径 | 职责 |
|------|------|
| [`src/index.ts`](../src/index.ts) | 包导出面与 `SVNC_VERSION` |
| [`src/client/SVNCClient.ts`](../src/client/SVNCClient.ts) | 对外门面；实现 `AutomationSurface`；Recognition 网关 |
| [`src/automation/types.ts`](../src/automation/types.ts) | 冻结的 Automation 契约（坐标、选项、事件名） |
| [`src/automation/errors.ts`](../src/automation/errors.ts) | `SvncError` / `SvncErrorCode` |
| [`src/rfb/session.ts`](../src/rfb/session.ts) | RFB 会话：握手、安全类型、消息循环、输入与截图 |
| [`src/rfb/transport.ts`](../src/rfb/transport.ts) | WebSocket 字节读写缓冲 |
| [`src/rfb/constants.ts`](../src/rfb/constants.ts) | 协议常量 |
| [`src/rfb/d3des.ts`](../src/rfb/d3des.ts) | VNC Auth 挑战加密 |
| [`src/rfb/ard.ts`](../src/rfb/ard.ts) | Apple Remote Desktop（type 30）：DH + MD5 + AES-128-ECB |
| [`src/rfb/pixel-format.ts`](../src/rfb/pixel-format.ts) | 像素格式协商 |
| [`src/rfb/inflate.ts`](../src/rfb/inflate.ts) | zlib 辅助（Tight / ZRLE） |
| [`src/rfb/encodings/`](../src/rfb/encodings/) | Raw 像素路径、Tight / JPEG、ZRLE、Hextile、RRE、Cursor、ExtendedDesktopSize 等 |
| [`src/display/canvas.ts`](../src/display/canvas.ts) | Canvas 显示 |
| [`src/display/memory.ts`](../src/display/memory.ts) | 内存帧缓冲辅助 |
| [`src/input/human-input.ts`](../src/input/human-input.ts) | Canvas DOM → `moveTo` / 键鼠 |
| [`src/recognition/types.ts`](../src/recognition/types.ts) | `RecognitionProvider` / `UITarget` |
| [`src/recognition/stubs.ts`](../src/recognition/stubs.ts) | `waitFor` / `clickTarget` / `NullRecognitionProvider` |
| [`src/utils/keysym.ts`](../src/utils/keysym.ts) | 键名 ↔ X11 keysym |
| [`src/utils/events.ts`](../src/utils/events.ts) | 简单 EventBus |

## 3. 数据流（简）

1. **连接**：`SVNCClient.connect` → `RfbSession.connect` → WebSocket → RFB 3.8 握手 → None 或 VNC Auth → ClientInit / ServerInit → 请求编码。
2. **帧**：服务端 FramebufferUpdate → encodings 解码写入 Display → `frame`（含 `damage`）。
3. **脚本输入**：Automation 方法 → PointerEvent / KeyEvent / ClientCutText。
4. **人工输入**：`attachHumanInput` 将 CSS 坐标映射为桌面像素后走同一套 Pointer/Key API。
5. **Agent**：`screenshot` / `toDataURL` / `toBlob` 取出画面；决策后调用输入 API；可选 Recognition 插件。

## 4. 与文档地图

| 主题 | 文档 |
|------|------|
| 快速接入 | [quick-start.md](./quick-start.md) |
| API 字段与错误码 | [automation-api.md](./automation-api.md) |
| 编码 / 认证矩阵 | [compat-matrix.md](./compat-matrix.md) |
| 已实现 vs 延后 | [lean-rfb-gaps.md](./lean-rfb-gaps.md) |
| 早期愿景与草案 | [design-proposal.md](./design-proposal.md)（执行顺序以 [roadmap.md](./roadmap.md) 为准） |
| 文档总目录 | [README.md](./README.md) |

## 5. 非目标（提醒）

- 不自研生产级 websockify
- 不做移动端缩放 / 手势（产品目标 3）
- 不做 RFB 内 VeNCrypt / RA2 / TLS（D7）
- 不绑定单一视觉模型；不内置 OCR（D3）

