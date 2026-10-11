# SVNC 文档索引

> 仓库：[xrdavies/svnc](https://github.com/xrdavies/svnc) · 包：`svnc@0.1.0` · 许可证：MIT  
> 日期：2026-10-12（Asia/Shanghai）

按读者分组。实现以 [`src/`](../src/) 与导出面 [`src/index.ts`](../src/index.ts) 为准；本文不另发明 API。

## 新手上路

| 文档 | 说明 |
|------|------|
| [快速开始](./quick-start.md) | 安装、本地拓扑、最小连接与截图/点击 |
| [README](../README.md) | 产品目标、状态总览、示例入口 |
| [本地 e2e](./e2e-local.md) | Xvfb + x11vnc + websockify + Demo 端口与验收 |
| [兼容矩阵](./compat-matrix.md) | Server / Auth / Encoding 必过拓扑 |

## API 与嵌入

| 文档 | 说明 |
|------|------|
| [Automation API](./automation-api.md) | `SVNCClient` / `AutomationSurface`、事件、错误码 |
| [剪贴板](./clipboard.md) | `clipboardWrite` / `typeText({ viaClipboard })` |
| [安全模型](./security.md) | Automation 威胁模型与嵌入清单 |
| [外围加密（D7）](./peripheral-security.md) | WSS / VPN / SSH；不做 RFB VeNCrypt |

## 架构与决策

| 文档 | 说明 |
|------|------|
| [架构索引](./architecture.md) | 模块图、`src/` 目录对照 |
| [设计提案](./design-proposal.md) | 愿景、逻辑架构、早期 API 草案 |
| [路线图](./roadmap.md) | Phase 0–5 与关闭决策 D1–D7 |
| [noVNC 分析](./novnc-analysis.md) | 参考架构与自动化缺口 |
| [自研 vs Wrap](./build-vs-wrap-decision.md) | 为何精简自研 |
| [websockify](./websockify-decision.md) | 复用桥、不自研姊妹产品 |
| [Lean RFB 缺口](./lean-rfb-gaps.md) | 已补项与刻意延后项 |
| [Spike 笔记](./spike-notes.md) | Phase 1 Wrap（已退役）记录 |

## 发布与 CI

| 文档 | 说明 |
|------|------|
| [npm 手动发布](./npm-publish.md) | 维护者发布流程（中文） |
| [CI](./ci.md) | GitHub Actions typecheck / test / build |
| [Changelog](../CHANGELOG.md) | 版本说明 |

## 示例代码

| 路径 | 用途 |
|------|------|
| [`examples/lite/`](../examples/lite/) | 最小查看器 |
| [`examples/demo/`](../examples/demo/) | 全量 Automation + 人工输入 |
| [`examples/agent-screenshot/`](../examples/agent-screenshot/) | 截图 → Agent 环路草图 |
| [`examples/agent-github-nav/`](../examples/agent-github-nav/) | 脚本操控 Chrome 导航 |
| [`examples/ws-tcp-bridge/`](../examples/ws-tcp-bridge/) | **非生产** 试验用 WS↔TCP |
| [`examples/archive/`](../examples/archive/) | 已退役 noVNC Wrap 适配 |

