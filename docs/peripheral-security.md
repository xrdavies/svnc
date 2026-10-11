# 外围安全方案 vs RFB 内建 VeNCrypt / RA2 / TLS

> 日期：2026-10-12（Asia/Shanghai）  
> 背景：用户确认 VeNCrypt / RA2 / TLS 更像 **部署外围**，而非 SVNC 客户端核心能力。  
> 关联：[compat-matrix.md](./compat-matrix.md)、[websockify-decision.md](./websockify-decision.md)、[lean-rfb-gaps.md](./lean-rfb-gaps.md)

## 1. 结论（先看）

**推荐：优先用外围方案保护链路；SVNC 本体继续只做 None + VNC Auth。**

| 层级 | 做什么 | 谁负责 |
|------|--------|--------|
| **外围** | 加密传输、网络隔离、访问控制（WSS 反代、VPN、SSH 隧道、原生 WSS VNC） | 运维 / 部署拓扑 |
| **SVNC 客户端（RFB）** | 握手、编码、显示、Automation API（截图 / 键鼠） | 本仓库 |
| **可选未来（仅当矩阵强制）** | RFB 层 VeNCrypt / TLS / RA2 security type | 仅在目标 Server **强制**该 security type、且无法用外围替代时再评估 |

对 Agent / 浏览器场景：多数「要加密」的需求 = **WebSocket 外层用 TLS（WSS）或整网 VPN**，不等于必须在浏览器里实现 VeNCrypt 状态机。

---

## 2. 这三样分别是什么

RFB 握手会协商 **security type**。常见几类：

| 名称 | 大致含义 | 和「外围 TLS」的关系 |
|------|----------|---------------------|
| **None** | 无密码 | 仅适合本机 / 已隔离网络 |
| **VNC Authentication** | DES 挑战–应答密码（经典） | 链路仍可能是明文 TCP/WS；密码不等于传输加密 |
| **TLS（作为通道）** | 先建 TLS，再在隧道里跑 RFB | 可由 **WSS 反代 / 原生 WSS Server** 在 RFB 之外完成 |
| **VeNCrypt** | RFB 内协商「用哪种 TLS / 证书子类型」 | **协议内**安全类型；客户端必须懂 VeNCrypt 握手才能连强制该类型的 Server |
| **RA2 / RA2ne 等** | 加密挑战–应答类认证（多见于部分加固 / 商业部署） | 同样是 **RFB security type**；外围 WSS **不能**代替 Server 要求的该类型握手 |

要点：

- **WSS / VPN / SSH** 保护的是「到桥或到 Server 的管道」。
- **VeNCrypt / RA2** 是 Server 在 RFB 字节流里要求的 **登录方式**。管道已加密时，Server 仍可能坚持用 VeNCrypt 而拒绝 None/VNC Auth。

因此：「外围加密」和「RFB 内建 VeNCrypt」解决的问题 **有重叠但不等价**。

---

## 3. 推荐外围方案（不改 SVNC 客户端）

### 3.1 WSS 反向代理（最常见浏览器场景）

```text
浏览器 ──WSS (TLS)──► nginx / Caddy / Traefik
                         │ 终止 TLS，Upgrade WebSocket
                         ▼
                    websockify ──TCP──► VNC :5900
                         （内网明文 RFB + VNC Auth 即可）
```

- 浏览器侧：`wss://vnc.example.com/`，证书由反代管理。
- SVNC：仍连标准 WebSocket；RFB 里用 None 或 VNC Auth。
- 优点：证书续期、HSTS、IP 白名单、Basic/OIDC 入口都可放在反代；**零客户端协议复杂度**。
- 注意：反代到 websockify 的那段若在不可信网络，仍应再收紧（同机 loopback、或再套一层）。

websockify 自身也可用 `--cert` 直接听 WSS；生产上更常见的是前面再挂成熟反代。

### 3.2 VPN（整网隔离）

```text
Agent / 浏览器所在机器 ──WireGuard / Tailscale / 企业 VPN──► 内网
                                                              │
                                                    websockify + VNC
```

- 适合：团队内网、CI Runner、桌面 Agent 本就在 VPN 内。
- SVNC 可用 `ws://`（VPN 内），或仍走 WSS。
- 优点：不暴露公网端口；与 RFB 认证正交。
- 缺点：不能替代「给任意公网用户打开的网页 VNC」。

### 3.3 SSH 隧道

```bash
# 把远端 websockify 或 VNC 端口转到本机
ssh -L 6080:127.0.0.1:6080 user@jump
# 浏览器 / SVNC 连 ws://127.0.0.1:6080/
```

- 适合：运维临时接入、开发联调、无公网证书时的加密通道。
- 优点：现成、审计路径清晰。
- 缺点：不适合给最终用户的公开 Demo 页；Agent 需能跑 SSH 或已有跳板。

### 3.4 原生 WebSocket + TLS 的 VNC Server

若 Server（或前面的专用网关）**直接提供 WSS 上的 RFB**：

```text
浏览器 ──WSS──► Native WS+TLS VNC / 网关 ──► 桌面
```

- 可省掉 websockify（与 [websockify-decision](./websockify-decision.md) 一致：原生 WS **优先**）。
- TLS 仍在 **传输层**；RFB security type 仍可以是 None / VNC Auth。
- 仅当该 Server **额外强制** VeNCrypt/RA2 时，才回到 §4。

### 3.5 方案对照

| 方案 | 加密传输 | 改 SVNC？ | 典型用途 |
|------|----------|-----------|----------|
| WSS 反代 + websockify | ✅ 浏览器↔反代 | 否 | 公网页 / SaaS 入口 |
| VPN | ✅ 整段覆盖 | 否 | 内网 Agent、企业桌面 |
| SSH 隧道 | ✅ | 否 | 临时运维、开发 |
| 原生 WSS VNC | ✅ | 否（仍标准 WS） | 有原生 WS 的部署 |
| 客户端 VeNCrypt/RA2 | 视子类型 | **要改 RFB** | Server 强制该 security type |

---

## 4. 什么时候外围不够、仍可能要客户端实现

以下情况 **仅外围 WSS/VPN 无法完成握手**，才需要评估 RFB 内建支持：

1. **Server 只提供 VeNCrypt（或仅 RA2）**，拒绝 None / VNC Auth  
   - 即使外层已是 WSS，RFB 里仍必须走 VeNCrypt 子协商（选 TLS 版本、是否校验证书等）。
2. **直连裸 TCP RFB 且要求 TLS/VeNCrypt**（无 WS 桥、无反代）  
   - 浏览器场景少见（浏览器不能裸 TCP）；Node 自动化直连 TCP 时可能遇到。
3. **合规要求「应用层也要 VNC 加密认证」**，审计不认可「仅靠反代 TLS」  
   - 产品/合规驱动，而非协议必需。

**浏览器 SVNC 的默认产品路径**（网页 + websockify/原生 WS）下，1–2 可通过 **换 Server 配置**（允许 VNC Auth + 外围 WSS）规避。只有目标矩阵里出现「必须连死磕 VeNCrypt 的 Server」时，才把客户端实现排进路线图。

---

## 5. RFB 里要不要加 TLS / 证书方式？

| 选项 | 建议 |
|------|------|
| **传输层 TLS（WSS）** | **要有，但放外围或原生 WSS Server**；SVNC 只消费 `wss://` URL，不在库内终止证书。 |
| **RFB security type = VeNCrypt / TLS** | **默认不做**；compat-matrix 保持 ❌。 |
| **RA2 / 其它加固认证** | **默认不做**；同上。 |
| **未来可选** | 若矩阵新增「必过：某 TigerVNC VeNCrypt-only 拓扑」，再单独立项（工作量大：TLS 栈、证书校验、子类型兼容），且优先评估能否用网关把外层 TLS 转成内网 VNC Auth。 |

**不建议**为了「看起来更安全」在 SVNC 里提前实现完整 VeNCrypt：与 Automation / 编码主线争复杂度，且与 MIT 精简客户端目标冲突；noVNC 的历史包袱之一正是认证矩阵膨胀。

---

## 6. 对 SVNC 的明确建议

1. **核心通过 SVNC**（显示 + 截图 + 键鼠 API）；**加密与暴露面通过外围技术方案**达成。  
2. **首期 / 当前矩阵**：Auth = None + VNC Auth；传输加密 = WSS 反代 / VPN / SSH / 原生 WSS。  
3. **VeNCrypt / RA2 / RFB-TLS**：记为 **部署相关延后项**，不是自研编码缺口；文档与 gaps 表保持延后，直到出现不可替代的 Server 强制需求。  
4. Demo / e2e 继续用本机 `ws://` + VNC Auth；对外说明生产应加 WSS 或 VPN（本文件 + README 轻链）。

---

## 7. 变更规则

- 若某客户拓扑 **无法** 关闭 VeNCrypt-only，开 issue / 更新 [compat-matrix.md](./compat-matrix.md) 增加「调研行」，再决定是否实现。  
- 不得在未改矩阵的情况下把 VeNCrypt 宣称为「已支持」。
