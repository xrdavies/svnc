# npm 手动发布指南（@xrdavies/svnc）

本文说明由维护者**手动**将 `@xrdavies/svnc` 发布到 [npm](https://www.npmjs.com/package/@xrdavies/svnc) 的流程，适用于 **0.1.0 及之后**的版本。CI 只做 typecheck / test / build，**不会**自动 `npm publish`。

包名：`@xrdavies/svnc`（scoped 公开包）。  
仓库：[xrdavies/svnc](https://github.com/xrdavies/svnc)。

> **为何 scoped：** 裸名 `svnc` 发布时被 npm 以 E403 拒绝（与已有包名过于相似：`svgo`、`sane`、`send`、`solc`、`async` 等）。官方建议改用 `@xrdavies/svnc`。`package.json` 已配置 `"publishConfig": { "access": "public" }`；首次发布仍建议显式带上 `--access=public`。

## 1. 前置条件

- Node.js **≥ 18**（与 `engines` 一致），建议用当前 LTS。
- 已能登录有权发布 **`@xrdavies`** scope 下包的 **npm 账号**（首次发布需占用该包名；后续发布需对该包有 publish 权限。若 org scope 受限，需在 npm 上拥有 `@xrdavies` 组织权限或使用同名用户 scope）。
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

确认当前身份是有权发布 `@xrdavies/svnc` 的账号。也可使用只读检查：

```bash
npm view @xrdavies/svnc version   # 包尚未发布时会 404，属正常
```

登出（发布结束后可选）：

```bash
npm logout
```

## 3. 版本号

`package.json` 的 `version` 必须与即将发布的 semver **一致**（例如 `0.1.0`、`0.1.1`、`0.2.0`）。

- **首发 / 已打 tag 的版本**：直接使用仓库里已定好的版本（如 `0.1.0`），不要再跑会改文件的 bump，除非刻意发新版本。裸名从未成功发布过，因此 **scoped 首发仍可用 `0.1.0`**。
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

确认版本号与 CHANGELOG / tag 一致后。**scoped 公开包必须允许 public access：**

```bash
npm publish --access=public
```

`publishConfig.access` 已设为 `public`；显式 `--access=public` 可避免首次 scoped 发布被当成私有包。若账号开启了 OTP：

```bash
npm publish --access=public --otp=<一次性验证码>
```

发布中途失败时，先根据报错处理（权限、OTP、网络、`prepublishOnly` 测试失败、包名相似度等），**不要**用不同内容重复发布同一版本号。若再次看到裸名相似度 E403，确认 `package.json` 的 `name` 已是 `@xrdavies/svnc`。

## 6. 验证

```bash
npm view @xrdavies/svnc version
npm view @xrdavies/svnc dist-tags
npm view @xrdavies/svnc time
```

在干净目录试装：

```bash
mkdir -p /tmp/svnc-smoke && cd /tmp/svnc-smoke
npm init -y
npm install @xrdavies/svnc@0.1.0   # 换成刚发布的版本
node -e "import('@xrdavies/svnc').then(m => console.log(Object.keys(m).slice(0, 20)))"
```

浏览器侧仍需 WebSocket + Canvas 环境；安装成功且能解析 ESM 导出即可视为发包成功。

包页：`https://www.npmjs.com/package/@xrdavies/svnc`。

## 7. Tag 与 GitHub 说明

约定：

- Git tag 使用 **裸 semver**，与 npm 版本一致，例如 `0.1.0`（不要用 `v0.1.0`，除非全仓库统一改约定）。
- Tag 应指向**与发布内容一致**的 commit（通常是含该 `version`、scoped `name` 与 CHANGELOG 的 release commit）。

若 tag 尚不存在：

```bash
git tag -a 0.1.0 -m "@xrdavies/svnc 0.1.0"
git push origin 0.1.0
```

若 tag 已在远程（如首发 `0.1.0`），发布 npm 时**不要**改写该 tag；只需保证当前 `main` 上的树与 tag 指向一致（或在重命名包后重新打同版本 tag 的策略已与团队确认），再对该树执行 `npm publish --access=public`。

可选：在 GitHub 上为该 tag 建 Release，正文可摘自 CHANGELOG 对应章节：

- 已有 tag：`https://github.com/xrdavies/svnc/releases/tag/0.1.0`
- 用 CLI：`gh release create 0.1.0 --title "0.1.0" --notes-file CHANGELOG.md`（按需精简 notes）

发布完成后建议在团队内确认：npm 版本、Git tag、CHANGELOG、README 安装说明四处一致。

## 8. 清单（复制用）

- [ ] `main` 干净且已 pull
- [ ] `package.json` `name` = `@xrdavies/svnc`，`version` = 目标版本
- [ ] CHANGELOG 已写该版本
- [ ] `npm whoami` 身份正确（有 `@xrdavies` 发布权）
- [ ] `typecheck` / `test` / `build` 通过
- [ ] `npm pack --dry-run` 内容合理
- [ ] `npm publish --access=public`（必要时再加 `--otp`）
- [ ] `npm view @xrdavies/svnc version` 正确
- [ ] Git tag 已推送；可选 GitHub Release
- [ ] （可选）`npm logout`

## 相关文档

- [CI](./ci.md)
- [Changelog](../CHANGELOG.md)
- [Security](./security.md)
- [Roadmap](./roadmap.md)
