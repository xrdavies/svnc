# Wrap / Fork / 自研：对照 noVNC 维护现状的决策

> 调研日期：2026-10-12（Asia/Shanghai）  
> 数据来源：本地克隆 [novnc/noVNC](https://github.com/novnc/noVNC)（加深后的 `master`）、GitHub Releases / Issues / PRs / Contributors、`@novnc/novnc` npm 下载量、既有 [novnc-analysis.md](./novnc-analysis.md) 与 [design-proposal.md](./design-proposal.md)。  
> **统计均为当时快照，未捏造数字。**

## 1. 结论（先看）

**主路径：以 noVNC 为蓝本的精简自研 RFB 客户端（路径 C），短期允许「薄包装」做产品验证（路径 A），不把长期 Fork（路径 B）当作默认策略。**

理由简述：上游仍有维护，但发布节奏约一年一版、日常合并偏慢，且公开 API **刻意面向人工浏览器操控**——没有稳定的程序化指针与帧更新事件。SVNC 的核心差异（界面识别 + click/type 闭环）与上游产品目标不对齐，长期挂在私有 `_sendMouse` 或维护分流 Fork 的成本，高于「借鉴协议与解码思路、自建干净 Automation API」的可控工程量。完整复刻 noVNC 全部认证/编码/H.264/移动手势则不划算；自研应 **裁剪协议面**，先打通自动化主路径。

---

## 2. noVNC 维护与发布节奏（证据）

### 2.1 仓库规模（2026-10-12 快照）

| 指标 | 值 |
|------|-----|
| Stars / Forks | ~14 093 / ~2 680 |
| Default branch | `master` |
| License | **MPL-2.0**（`package.json` / `LICENSE.txt`） |
| npm 包 | `@novnc/novnc` **1.7.0**；近 30 天下载约 **6 261 514**（npm downloads API） |
| `open_issues` 字段（含 PR） | 112 |
| 按类型拆分（Search API） | Open issues **73**；Closed issues **1336**；Open PRs **39**；Closed PRs **601** |
| 最近 push | 2026-10-05（合并 #2081） |

### 2.2 稳定版发布间隔

| 稳定 Tag | 发布日（UTC 公开 Release） | 距上一稳定版 |
|----------|---------------------------|--------------|
| v1.7.0 | 2026-04-28 | **412 天**（~13.6 月） |
| v1.6.0 | 2025-03-12 | 267 天（~8.8 月） |
| v1.5.0 | 2024-06-18 | 515 天（~16.9 月） |
| v1.4.0 | 2023-01-20 | 455 天 |
| v1.3.0 | 2021-10-22 | 465 天 |
| v1.2.0 | 2020-07-14 | 462 天 |
| v1.1.0 | 2019-04-09 | 411 天 |
| v1.0.0 | 2018-02-22 | — |

模式：**大约一年一版稳定发布**（8.8–16.9 个月），中间有 beta。截至调研日，距 v1.7.0 已约 **167 天**，尚无更新的稳定版。

### 2.3 提交活跃度（`master`，本地加深历史）

| 窗口 | 约提交数 |
|------|----------|
| 自 2024-01-01 | 215 |
| 自 2025-01-01 | 148 |
| 自 2026-01-01 | 30 |

2026 年月度分布（摘录）：1 月 4、2 月 7、5 月 11、6 月 2、8 月 1、9 月 4、10 月 1——**有活动，但不均匀，夏季后明显变稀**。近期多为小修复、CI/runner、`vnc_lite` URL 参数、Wakelock、控制条布局等，**未见面向「程序化自动化 SDK」的方向性投入**。

### 2.4 Bus factor

- `AUTHORS` maintainers：Samuel Mannehed、Pierre Ossman（均为 **Cendio / ThinLinc**）。
- Contributors API 累计贡献靠前：`samhed`（736）、`CendioOssman`（720）、`kanaka`（603，创始/emeritus）、其后为 Cendio 相关账号与少量社区。
- 2025 年以来 git author 亦以 Cendio/ThinLinc 团队为主。

**解读：** 项目健康、生态巨大，但维护高度集中；社区 PR 队列不短（见下），**不能假设「SVNC 需要的 API 会很快合入上游」**。

---

## 3. Issue / PR 主题与历史痛点

### 3.1 量级

- 长期开放 issue ~**七十余**；开放 PR ~**三十九**（含功能、修复、基建）。
- 部分 feature 带 `patchwelcome` 多年仍开（例：[\#1764](https://github.com/novnc/noVNC/issues/1764) 触摸板模式，2023-03 开，2026-04 仍有 +1）。
- 维护者明确表态：功能要考虑长期维护成本，**偏好少而必要**（见 \#1764 讨论）。

### 3.2 主题（关键词检索 + 抽样，非穷尽）

| 主题 | 观察 |
|------|------|
| **Security** | 历史上大量讨论；近期仍有如 [\#2051](https://github.com/novnc/noVNC/issues/2051)（不可信 URL 参数 / WebSocket 目标，\#2011 后续）。完整 `vnc.html` 应用面与**库 API**风险不同，但说明「嵌入场景」需自控连接面。 |
| **Input / 键盘** | macOS 系统快捷键吞 keyup（[\#1799](https://github.com/novnc/noVNC/issues/1799)）、Android Gboard 映射（[\#2068](https://github.com/novnc/noVNC/issues/2068)）、公开键盘 target（[\#2084](https://github.com/novnc/noVNC/issues/2084)）等——浏览器 DOM 输入本就难；**程序化 `sendKey` 路径反而更干净**。 |
| **Pointer / 鼠标** | 回归类：[\#1970](https://github.com/novnc/noVNC/issues/1970)（1.6 右键 / tap-to-click，标 `notourbug`）；公开 API **仍无** `sendPointer`/`click`。 |
| **Clipboard** | 长期议题；开放 PR 含权限拒绝回退、ExtendedClipboard 消费等。 |
| **Mobile / touch** | 手势已有；模拟触摸板等增强靠社区 PR（如 \#2065），上游不一定快速采纳。 |
| **HiDPI / 光标 / 缩放** | 硬件光标缩放等有开放 PR（如 \#2077）；视口缩放与坐标转换对自动化是一等复杂度。 |
| **TypeScript / 现代打包** | 库为 **原生 ESM**（`"type":"module"`，`exports` → `core/rfb.js`），**无官方 TypeScript 类型**；测试仍绑 **Karma**（[\#1883](https://github.com/novnc/noVNC/issues/1883) deprecated，有迁 Vite 的 PR \#2016 等）。 |
| **Performance / memory** | 如 [\#2075](https://github.com/novnc/noVNC/issues/2075) Chromium Image Cache 增长；JPEG 在 Firefox 慢（\#1987）等。 |
| **Automation** | 几乎无上游产品议题；读屏靠 `getImageData`/`toDataURL`/`toBlob`，**无 frame/damage 事件**（见 API.md 与本仓库分析文档）。 |
| **Infra / 文档** | Wiki 编辑、文档站、snap SSL 路径空格等「周边」问题长期挂起。 |

### 3.3 与 SVNC 直接相关的架构债（对照已有分析）

摘自代码与 `docs/API.md`（及 [novnc-analysis.md](./novnc-analysis.md)）：

1. **库 / 应用耦合边界清晰但「自动化半成品」**  
   - 库入口：`core/rfb.js`（`RFB`）。  
   - 完整 UI：`app/ui.js` + `vnc.html`（设置、控制条、i18n）——SVNC 不需要这条线。  
2. **鼠标走私有路径**  
   - DOM → `_handleMouse` → `_sendMouse` → `RFB.messages.pointerEvent`；**稳定文档只有 `sendKey`，没有指针注入**。  
3. **无公开帧更新事件**  
   - 事件集：`connect` / `disconnect` / `clipboard` / `bell` / `desktopname` / `capabilities` / …——**无 `framebufferupdated`**。自动化只能轮询截图或侵入内部。  
4. **内部模块声明不稳定**（`API-internal.md`）——不宜把 Display/Websock 当公共契约。  
5. **传输模型**  
   - 浏览器侧 WebSocket / RTCDataChannel；现实部署常依赖 **websockify**（姊妹项目）或服务器原生 WS。ThinLinc 官方博文亦提示 websockify 更偏评估、生产需自建代理栈。  
6. **协议面庞大**  
   - `core/rfb.js` 约 **3 426** 行；解码器目录含 Raw / CopyRect / RRE / Hextile / Zlib / Tight / TightPNG / ZRLE / JPEG / **H.264** 等；认证含 none、VNC Auth、RA2、Tight、VeNCrypt、XVP、Apple DH、MSLogonII 等。  
   - **自研若追求 1:1 兼容，成本接近再造 noVNC；若只服务「可控服务器集合」，可大幅裁剪。**  
7. **MPL-2.0**  
   - 直接拷贝/修改文件有文件级 copyleft 义务；薄包装依赖 npm 包相对简单，**深度 Fork 需法务与同步流程**。

### 3.4 「更新慢」是否等于「死项目」？

**不等于。** 证据显示：仍有稳定版、仍有合并、生态下载量极大、Cendio 持续投入。  
「慢」对 SVNC 的含义是：

- 你提的 Automation API **排不上上游优先级**的概率高；  
- 安全/输入/移动等修复 **周期以月计**；  
- 39 个开放 PR 说明社区补丁多、**合入不确定**。

因此「更新慢」单独不构成自研充分条件；**产品目标错位 + API 缺口 + Fork 同步税** 三者叠加，才构成自研倾向。

---

## 4. 替代方案与生态简图

| 选项 | 与 SVNC 关系 |
|------|----------------|
| **@novnc/novnc** | 事实标准 HTML5 RFB 客户端库；SVNC 短期可依赖。 |
| **kasmtech/noVNC** | 深度 Fork，**刻意打破 RFB**，只配 KasmVNC；不能当通用 VNC 客户端。 |
| **Apache Guacamole** (`guacamole-common-js`) | 浏览器端是 Guacamole 协议客户端，VNC 在 **服务端 guacd** 终结——架构重，不是「前端直连 RFB」库。 |
| **react-vnc 等** | 多为 noVNC 的 React 封装，不解决指针/帧事件缺口。 |
| **Node RFB 库**（如 `rfb2`、`vnc-rfb-client`） | 偏 Node/服务端；浏览器 Canvas + Agent 场景需另接显示与输入。 |
| **Selkies / Desktopia 等** | 现代桌面流（WebCodecs / WebRTC / WebTransport），**不是**兼容任意既有 VNC Server 的 RFB 客户端；若未来放弃「兼容经典 VNC」可另议，与当前 SVNC 目标不符。 |
| **ThinLinc Web Access** | 产品化栈（含 noVNC 血统），闭源/商业向；不替代开源库策略。 |

**「自研」成本画像（数量级，供规划，非精确估时）：**

| 能力切片 | 难度 | 备注 |
|----------|------|------|
| WS 传输 + 版本/安全握手 + ServerInit | 中 | 可对照 `rfbproto` + noVNC 状态机 |
| None + VNC Auth | 低–中 | 覆盖大量自建 TigerVNC/x11vnc |
| Raw + CopyRect + ZRLE 或 Tight | 中–高 | 实用最小集；可先 Raw 打通再加 |
| JPEG / TightPNG | 中 | 带宽友好 |
| H.264 / 全认证矩阵 / 完整伪编码 | 高 | **首期应砍掉** |
| Canvas Display + 桌面坐标 | 中 | SVNC 必做 |
| **公开 Pointer + Key + Frame 事件** | 低（若自控栈） | **差异化所在** |
| 移动手势 / 完整 UI 壳 | 高 | 非 MVP |

---

## 5. 决策框架（对照 SVNC 目标）

SVNC 目标（摘自 design-proposal）：**可编程界面识别 + 点击/输入**；精简可嵌入；兼容 RFB 生态；人机双模。

| 路径 | 做法 | 优点 | 风险 / 成本 | 何时合理 |
|------|------|------|-------------|----------|
| **A. Wrap** | 依赖 `@novnc/novnc`，外挂 Automation；指针暂用私有/`RFB.messages` 或伪造 DOM | 最快验证识别闭环；复用解码与认证 | 升级脆弱；无 frame 事件；碰内部 API；类型/测试栈老旧 | **仅原型 / Spike（建议 ≤ 数周）** |
| **B. Fork** | Vendoring/fork 后导出 `sendPointer`、加 frame 事件 | 改动面可控、行为与上游接近 | MPL 合规；与 39+ PR 的上游**持续 rebase**；目标分叉后「伪上游」；安全补丁要自己盯 | 仅当必须 **100% 兼容 noVNC 行为** 且愿意养 Fork |
| **C. Self-implement** | 以 noVNC / rfbproto 为规格参考，自建精简客户端 + 一等 Automation API | API 形状自主；可 TypeScript/现代工具链；避开历史 UI 债；许可可自选（注意勿不当复制 MPL 文件） | 编码/认证覆盖慢；早期兼容性 bug；短期无社区 | **中长期默认**，协议面裁剪后 |

### 5.1 推荐主路径（含混合）

```text
Spike (A, 可丢弃代码)
    → 验证：截图 → 识别 → click/type → 再截图
    → Exit：Automation 契约稳定（桌面坐标、错误模型）

并行设计 (C)
    → Session / Transport / 最小 Encoding / Display / InputController
    → 公开：pointer + key + frame/damage + screenshot

可选过渡
    → 若 Spike 阶段某解码器正确性难啃：临时 **只 vendoring 单个 decoder 文件**（MPL 文件级合规），
      而非整库 Fork (B)
```

**明确不推荐：** 以长期 Fork（B）作为主战略——同步税与产品目标错位叠加后，通常既慢于精简自研，又不如薄包装灵活。

### 5.2 风险摘要

| 风险 | 缓解 |
|------|------|
| 自研兼容性不足 | 固定参考服务器矩阵（如 TigerVNC、x11vnc、某 BMC）；CI 对着真实 VNC；编码按需加 |
| 重复造轮子 | 规格读 rfbproto；行为测试可对照同场景 noVNC 像素/输入；不复制粘贴大段 MPL 源除非接受义务 |
| Wrap 期间技术债泄漏进产品 | 私有 API 调用集中在 `adapters/novnc-legacy.ts` 一类边界；设删除日期 |
| 安全（可操控 API） | 连接 URL 白名单、凭证不进日志、审计钩子——不依赖完整 `vnc.html` |
| 许可 | 自研代码倾向 Apache-2.0/MIT（待定）；任何从 noVNC 拷贝的文件保持 MPL-2.0 并履行披露 |

### 5.3 退出 / 晋级标准（建议写进里程碑）

**结束纯 Wrap（A）进入自研主线（C）当：**

1. Automation 契约（`click` / `typeText` / `screenshot` / 坐标空间）已在真实任务跑通；**且**  
2. 需要稳定 `frame`/`damage` 或指针 API，继续挂内部方法的成本 > 两周量级的 Transport+Raw 自研；**或**  
3. `@novnc/novnc` 小版本升级曾两次以上打破适配层。

**暂停扩协议面当：**

- 目标服务器集合用 Raw/Tight/ZRLE 之一已足够；H.264/冷门认证无用户故事。

**考虑短期 Fork（B）仅当：**

- 法务要求最大化复用现有经过验证的解码器实现，**且** 团队承诺上游跟踪职责（有人专门 rebase）。

---

## 6. 对既有设计文档的修正

原 [design-proposal.md](./design-proposal.md) 写：**短期 A → 中期按需 B 或 C**。  

本决策将其收紧为：

> **短期 A（Spike）→ 默认中期 C（精简自研）；B 降级为「解码器级有限 vendoring / 例外」，而非整库 Fork 主线。**

---

## 7. 建议的下一步（若采纳本推荐）

1. **Spike（Wrap）**：最小 Demo——连接、截图、桌面坐标点击、`typeText`（基于 `sendKey`）、可选 OCR 插件接口空壳。适配层隔离私有调用。  
2. **冻结 Automation API 草案**为 TypeScript 类型（可先 `interface` only）。  
3. **启动精简 RFB 骨架**：Websock 缓冲、ProtocolVersion、Security none/VNCAuth、ServerInit、FramebufferUpdate(Raw)、PointerEvent/KeyEvent、Canvas Display、`frame` 事件。  
4. **兼容性矩阵文档**：列出首期支持的 Server × Encoding × Auth。  
5. **许可决策**：自研文件 SPDX；禁止无记录地从 noVNC 复制。  
6. **不**把完整 `app/ui.js` 控制条纳入范围。

---

## 8. 参考链接

- noVNC：https://github.com/novnc/noVNC  
- Releases：https://github.com/novnc/noVNC/releases  
- API：https://github.com/novnc/noVNC/blob/master/docs/API.md  
- RFB：https://github.com/rfbproto/rfbproto  
- websockify：https://github.com/novnc/websockify  
- Kasm fork 说明：https://github.com/kasmtech/noVNC  
- 本仓库：[novnc-analysis.md](./novnc-analysis.md)、[design-proposal.md](./design-proposal.md)
