# macOS 应用内更新

复用 Tauri updater 和已有 Windows 更新状态、签名下载及设置入口。macOS 保留 ad-hoc 应用签名，不引入 Apple Developer ID、公证或 Sparkle。

## 范围

- Rust：共享签名下载与待安装状态；macOS 安装前备份应用，失败恢复，完成后保存传输断点、停止会话并重启。
- 发布：为 arm64/x64 生成 `.app.tar.gz` 与 `.sig`，并入同一 `latest.json`；沿用现有更新签名公钥与 CI secrets，DMG 继续用于首次安装。
- UI/文档：复用下载、重启按钮，说明系统拦截后的手动放行；不可写目录、DMG 挂载点和 App Translocation 不执行安装。
- 验证：清单包含六个 Windows/macOS 目标，缺失签名拒绝生成；macOS 备份恢复测试和仓库质量门禁。

## 发布验收

旧的 macOS 版本需手动安装一次包含更新器的版本。真实 arm64/x64 的旧版到新版升级、手动批准、错误签名、安装失败恢复、编辑器取消退出和传输断点保留需打包验收。未发布、未操作用户已安装的 FileTerm。

## 实现与本机验证完成

- 已实现共享签名下载、双架构更新产物及清单、macOS 备份恢复、退出前编辑器确认与传输断点保存，以及中英文手动放行提示。
- 类型、lint、Prettier、CSS contract、201 项 renderer 测试、900 项 Rust/contract 测试、补充恢复场景测试与 Clippy 均通过；修改的 workflow YAML 与 Bash 语法通过。
- `updates.rs` 从 776 行变为 790 行，macOS 安装职责放在 `updates/macos.rs`；未引入依赖或修改版本。
- 已完成 Apple Silicon / macOS 27.0.1 的真实 release DMG 安装、篡改包拒绝与 `beta.14 → beta.15` 应用内自动升级；验证新版进程/二进制、签名、连接及暂停传输保留，详见 [本地升级实测](../../quality/local-auto-update-test.md#2026-10-24-apple-silicon-打包实测)。Intel 实机、浏览器隔离属性和系统手动放行仍待验收；未操作用户正式应用。
