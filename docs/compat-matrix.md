# SVNC 首期兼容矩阵（stub）

> 状态：Phase 0 已关闭决策后的**建议必过**拓扑  
> 日期：2026-10-12（Asia/Shanghai）  
> 依据：[roadmap.md](./roadmap.md) D1–D6、[websockify-decision.md](./websockify-decision.md)

## 1. 必过拓扑（Phase 1 / Phase 2 验收基准）

| 维度 | 首期选择 | 说明 |
|------|----------|------|
| **Server** | **TigerVNC** | 参考实现；文档与 Demo 默认 |
| **Auth** | **None** 与 **VNC Auth**（密码） | 握手最小集；其它（VeNCrypt / RA2 等）延后 |
| **Encoding** | **Raw**（第一优先）；下一步 **Tight** | 见 D2；ZRLE 不进首期第二优先 |
| **传输** | **websockify**（WS↔TCP）或 Server **原生 WebSocket** | 不自研生产级桥 |
| **会话** | **非 viewOnly** | 自动化 `click` / `typeText` 必须可注入输入（D6） |
| **客户端视口** | Demo **禁用** scaleViewport（或等价缩放） | 坐标 = 远端桌面像素 |

### 推荐本地组合

```text
TigerVNC (display)  --TCP RFB-->  websockify  --WebSocket-->  SVNC (browser)
         Auth: none 或 VNC Auth
         Encodings: Raw（必过）; Tight（Phase 2 扩展）
```

## 2. 编码优先级

| 优先级 | Encoding | 阶段 |
|--------|----------|------|
| 1 | Raw | Phase 1 Spike / Phase 2 骨架必过 |
| 2 | **Tight** | Phase 2 扩展（D2 已定） |
| — | ZRLE / H.264 / 其它 | Backlog，无用户故事不加 |

## 3. 认证范围

| Security | 首期 | 备注 |
|----------|------|------|
| None (1) | ✅ | 本地 Demo / CI |
| VNC Authentication (2) | ✅ | 密码路径必过 |
| VeNCrypt / RA2 / 其它 | ❌ | 后续按矩阵扩 |

## 4. Server 候选（非首期必过）

| Server | 态度 |
|--------|------|
| TigerVNC | **必过** |
| x11vnc | 可选对照（有余力再测） |
| LibVNC / RealVNC / 其它 | 明确需求后再加行 |

## 5. 自动化约束

- 跑 `click` / `typeText` 的测试与 Spike **必须使用非 viewOnly** 会话。
- `screenshot` / 只读观察可用 viewOnly，但不作为 Automation MVP 验收路径。

## 6. 变更规则

新增「必过」行需更新本表并在 PR/提交说明中引用；不得在 Spike 中悄悄扩大为「支持一切 VNC」。

## 7. 本仓库已跑通的本地拓扑

| Server | Auth | Encoding | Bridge | 文档 |
|--------|------|----------|--------|------|
| **x11vnc** + Xvfb | VNC Auth (`svnc-demo`) | Raw（客户端优先）；Tight 已实现含 palette | websockify `:6080`→`:5901` | [e2e-local.md](./e2e-local.md) |

TigerVNC 仍为矩阵「必过」目标；本 box 无 root/无 TigerVNC 包时以 x11vnc 对照验收。

