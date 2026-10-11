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
| [docs/roadmap.md](docs/roadmap.md) | **整体路线图**（阶段、工作项、交付物、依赖、风险） |
| [docs/compat-matrix.md](docs/compat-matrix.md) | 首期 Server × Auth × Encoding 兼容矩阵 |
| [docs/novnc-analysis.md](docs/novnc-analysis.md) | noVNC 架构、模块、协议栈与自动化能力边界 |
| [docs/design-proposal.md](docs/design-proposal.md) | 愿景、API 草案、分阶段设想（执行顺序以 roadmap 为准） |
| [docs/build-vs-wrap-decision.md](docs/build-vs-wrap-decision.md) | Wrap / Fork / 自研客户端决策 |
| [docs/websockify-decision.md](docs/websockify-decision.md) | WebSocket↔TCP 桥：复用 websockify vs 自研 |

## 当前状态

**Phase 0 已关闭**（MIT、`svnc` 包名、单包 `src/`、仅截图 API、TigerVNC + Raw→Tight、非 viewOnly）。仓库骨架已就位；核心客户端尚未落地。

**下一步：** 按 [docs/roadmap.md](docs/roadmap.md) 进入 **Phase 1 Wrap Spike**（`TigerVNC + websockify` → 显示 + `screenshot` / `click` / `typeText`）。

## 仓库布局（起步）

```text
svnc/
  src/           # 单包源码（D5）
  examples/      # Spike / Demo 占位
  docs/          # 路线图与决策
  package.json   # name: svnc, license: MIT
  LICENSE
```

## 参考

- noVNC：https://github.com/novnc/noVNC
- RFB：https://github.com/rfbproto/rfbproto
- websockify：https://github.com/novnc/websockify

## 许可证

**MIT**（自研代码，见 [LICENSE](LICENSE)）。

说明：上游 **noVNC** 多为 MPL-2.0——Wrap Spike 仅作运行时依赖 / 适配层，不整段拷贝进本仓库发布物；**websockify** 为 LGPL-3.0，以**独立进程**复用，不链进本库。
