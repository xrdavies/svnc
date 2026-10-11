# SVNC — Simple VNC

SVNC（Simple VNC）是一个面向前端网页的 VNC 客户端库与应用，目标是在保留经典远程桌面能力的同时，提供**可编程的界面识别与输入控制接口**，便于直接操作远端被控软件。

本项目以 [noVNC](https://github.com/novnc/noVNC) 为重要参考：协议栈、WebSocket 传输、显示与输入模型等均从 noVNC 的成熟实现出发，再针对自动化 / Agent 场景做能力扩展与 API 设计。

## 文档

| 文档 | 说明 |
|------|------|
| [docs/novnc-analysis.md](docs/novnc-analysis.md) | noVNC 架构、模块、协议栈与功能盘点（含对自动化的能力边界） |
| [docs/design-proposal.md](docs/design-proposal.md) | SVNC 愿景、与 noVNC 的差异、可编程 API 方案与分阶段计划 |

## 当前状态

仓库处于**思路与方案整理**阶段：已完成 noVNC 分析与 SVNC 设计提案，尚未落地核心代码。

## 参考

- noVNC：https://github.com/novnc/noVNC
- RFB 协议：https://github.com/rfbproto/rfbproto
- websockify（WebSocket ↔ TCP 代理）：https://github.com/novnc/websockify

## 许可证

待定（实现阶段确定；参考 noVNC 主要为 MPL-2.0）。
