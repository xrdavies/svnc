# npm 手动发布指南（svnc）

本文说明由维护者**手动**将 `svnc` 发布到 [npm](https://www.npmjs.com/package/svnc) 的流程，适用于 **0.1.0 及之后**的版本。CI 只做 typecheck / test / build，**不会**自动 `npm publish`。

包名：`svnc`（公开包，见 `package.json` 的 `publishConfig.access`）。  
仓库：[xrdavies/svnc](https://github.com/xrdavies/svnc)。

## 1. 前置条件

- Node.js **≥ 18**（与 `engines` 一致），建议用当前 LTS。
- 已能登录有权发布 `svnc` 的 **npm 账号**（首次发布需占用该包名；后续发布需对该包有 publish 权限）。
- 本地仓库在 **`main`**，工作区干净，且已同步远程：

  ```bash
  git checkout main
  git pull origin main
  git status   # 应无未提交改动
  ```

- 若本版已有 Git tag（例如 `0.1.0`），确认 tag 指向将要发布的提交：

  ```bash
  git rev-parse HEAD
  git rev-parse 0.1.0   # 或对应版本 tag
  ```

- 阅读本版 [CHANGELOG.md](../CHANGELOG.md) 与 [security.md](./security.md)，确认对外说明一致。

## 2. 登录 npm

```bash
npm login
# 按提示完成 OTP / 浏览器授权（若账号开启了 2FA）
npm whoami
```

确认当前身份是有权发布 `svnc` 的账号。也可使用只读检查：

```bash
npm view svnc version   # 包尚未发布时会 404，属正常
```

登出（发布结束后可选）：

```bash
npm logout
```

## 3. 版本号

`package.json` 的 `version` 必须与即将发布的 semver **一致**（例如 `0.1.0`、`0.1.1`、`0.2.0`）。

- **首发 / 已打 tag 的版本**：直接使用仓库里已定好的版本（如 `0.1.0`），不要再跑会改文件的 bump，除非刻意发新版本。
- **发新版本时**（在改完代码并更新 CHANGELOG 之后）：

  ```bash
  # 选一种：patch | minor | major，或显式版本
  npm version patch --no-git-tag-version
  # 或：npm version 0.1.1 --no-git-tag-version
  ```

  `--no-git-tag-version` 只改 `package.json`（及 lockfile 若有），便于你按 Conventional Commits 自己写 commit / tag。然后：

  1. 更新 [CHANGELOG.md](../CHANGELOG.md) 对应章节。
  2. 提交，例如：`chore(release): bump version to x.y.z`
  3. 推送 `main`，再打 tag（见下文「Tag 说明」）。

**不要**对已经发布到 npm 的同一版本号再次 `npm publish`（npm 不允许覆盖已发布 tarball）。

## 4. 构建与测试

在仓库根目录：

```bash
npm ci                 # 或 npm install（无 lock 严格要求时）
npm run typecheck
npm test
npm run build
```

`package.json` 的 `prepublishOnly` 会在真正 `npm publish` 时再跑一遍 typecheck → test → build；本地先跑可尽早发现失败。

可选：本地 e2e（需本机 VNC 拓扑，见 [e2e-local.md](./e2e-local.md)）：

```bash
npm run e2e:start
npm run e2e:verify
npm run e2e:stop
```

确认将上传的内容（应含 `dist/`、`src/`、LICENSE 等，见 `files` 字段）：

```bash
npm pack --dry-run
```

## 5. 发布

确认版本号与 CHANGELOG / tag 一致后：

```bash
npm publish
```

公开包无需额外 flag（已配置 `"publishConfig": { "access": "public" }`）。若账号开启了 OTP：

```bash
npm publish --otp=<一次性验证码>
```

发布中途失败时，先根据报错处理（权限、OTP、网络、`prepublishOnly` 测试失败等），**不要**用不同内容重复发布同一版本号。

## 6. 验证

```bash
npm view svnc version
npm view svnc dist-tags
npm view svnc time
```

在干净目录试装：

```bash
mkdir -p /tmp/svnc-smoke && cd /tmp/svnc-smoke
npm init -y
npm install svnc@0.1.0   # 换成刚发布的版本
node -e "import('svnc').then(m => console.log(Object.keys(m).slice(0, 20)))"
```

浏览器侧仍需 WebSocket + Canvas 环境；安装成功且能解析 ESM 导出即可视为发包成功。

包页：`https://www.npmjs.com/package/svnc`。

## 7. Tag 与 GitHub 说明

约定：

- Git tag 使用 **裸 semver**，与 npm 版本一致，例如 `0.1.0`（不要用 `v0.1.0`，除非全仓库统一改约定）。
- Tag 应指向**与发布内容一致**的 commit（通常是含该 `version` 与 CHANGELOG 的 release commit）。

若 tag 尚不存在：

```bash
git tag -a 0.1.0 -m "svnc 0.1.0"
git push origin 0.1.0
```

若 tag 已在远程（如首发 `0.1.0`），发布 npm 时**不要**改写该 tag；只需保证当前 `main` 上的树与 tag 指向一致，再对该树执行 `npm publish`。

可选：在 GitHub 上为该 tag 建 Release，正文可摘自 CHANGELOG 对应章节：

- 已有 tag：`https://github.com/xrdavies/svnc/releases/tag/0.1.0`
- 用 CLI：`gh release create 0.1.0 --title "0.1.0" --notes-file CHANGELOG.md`（按需精简 notes）

发布完成后建议在团队内确认：npm 版本、Git tag、CHANGELOG、README 安装说明四处一致。

## 8. 清单（复制用）

- [ ] `main` 干净且已 pull
- [ ] `package.json` version = 目标版本
- [ ] CHANGELOG 已写该版本
- [ ] `npm whoami` 身份正确
- [ ] `typecheck` / `test` / `build` 通过
- [ ] `npm pack --dry-run` 内容合理
- [ ] `npm publish`（必要时 `--otp`）
- [ ] `npm view svnc version` 正确
- [ ] Git tag 已推送；可选 GitHub Release
- [ ] （可选）`npm logout`

## 相关文档

- [CI](./ci.md)
- [Changelog](../CHANGELOG.md)
- [Security](./security.md)
- [Roadmap](./roadmap.md)
