# SVNC — Simple VNC

SVNC（Simple VNC）是一个面向**浏览器网页**的 VNC 客户端库与轻量应用：在提供基础远程桌面能力的同时，暴露**可编程的界面识别与键鼠控制 API**，方便未来 AI Agent 自动化接入。

参考：[noVNC](https://github.com/novnc/noVNC)。实现策略见决策文档——短期可薄包装验证，中长期精简自研 RFB 客户端。

## 产品目标（已锁定）

1. **浏览器直用**：在网页中完成基础 VNC（连接、显示、键盘/鼠标）。
2. **Agent API**：界面识别钩子 + 键盘/鼠标/截图等控制接口，支撑识别 → 决策 → 输入闭环。
3. **移动端稍后**：暂不做移动缩放、触摸手势等适配，后续再补。

## 传输立场（摘要）

浏览器不能直接连经典 VNC 的裸 TCP。部署时二选一：

- 使用 **websockify（或兼容桥）** 做 WebSocket↔TCP——**复用上游，不自研姊妹项目**；或
- 连接已提供 **原生 WebSocket** 的 VNC Server。

详见 [docs/websockify-decision.md](docs/websockify-decision.md)。

## 文档

| 文档 | 说明 |
|------|------|
| [docs/novnc-analysis.md](docs/novnc-analysis.md) | noVNC 架构、模块、协议栈与自动化能力边界 |
| [docs/design-proposal.md](docs/design-proposal.md) | 愿景、API 草案、分阶段计划（已对齐目标 1–3） |
| [docs/build-vs-wrap-decision.md](docs/build-vs-wrap-decision.md) | Wrap / Fork / 自研客户端决策 |
| [docs/websockify-decision.md](docs/websockify-decision.md) | WebSocket↔TCP 桥：复用 websockify vs 自研 |

## 当前状态

方案整理阶段：noVNC 分析、设计提案、客户端自研决策、**websockify 复用决策**已就绪。核心代码尚未落地。

**下一步建议：** Phase 1 Spike——`websockify + 本地 VNC` 拓扑下，浏览器基础显示 + `screenshot` / `click` / `typeText` API。

## 参考

- noVNC：https://github.com/novnc/noVNC
- RFB：https://github.com/rfbproto/rfbproto
- websockify：https://github.com/novnc/websockify

## 许可证

待定（实现阶段确定；客户端参考 noVNC 多为 MPL-2.0；websockify 为 LGPL-3.0，建议以独立进程复用）。
