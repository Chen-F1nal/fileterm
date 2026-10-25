## FileTerm 2.3.2-beta.2

此版本用于验证 Linux 从 beta.1 应用内升级到 beta.2；请先手动安装 beta.1。AppImage 需要放在当前用户可写的位置；DEB/RPM 更新可能需要管理员授权；Arch 和其他不受支持的安装仍通过发布页更新。

**下载地址**

| 平台    | 类型      | 下载                                                                                                                                                                                                                                                                               |
| ------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-macos-x64.dmg)                                      |
| Windows | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-windows-arm64-setup.exe)                                |
| Windows | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-windows-arm64-portable.exe)（需要 WebView2 Runtime） |
| Linux   | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-arm64.deb)                                          |
| Linux   | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-arm64.rpm)                                          |
| Linux   | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-arm64.AppImage)                                |
| Linux   | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-arm64.pkg.tar.zst)                          |

**安装指南**

[![简体中文安装指南](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/zh-CN.md)

### 2.3.2-beta.2 更新重点

- **Linux 应用内更新**：对受支持的 AppImage、DEB 和 RPM 安装使用 Tauri updater，并验证 Ed25519 更新签名；AppImage 通过备份和原子替换安装，DEB/RPM 由系统安装器处理，可能要求管理员授权。
- **安装格式边界**：AppImage 必须位于当前用户可写的位置；DEB/RPM 仅对由系统包管理器安装的 FileTerm 启用；Arch 包和不支持的架构继续打开 GitHub Releases。
- **Linux 侧栏启动宽度**：窗口尺寸稳定后恢复 214px 默认宽度；窗口启动期间较窄的临时视口不会永久改变宽度，手动调整也会保留。
- **AppImage 图形兼容性**：重新打包时移除应由宿主系统提供的显示栈库，避免覆盖新版 Mesa/Wayland。已安装旧 beta.2 的用户需重新下载此版本，因为版本号未变化，应用内更新不会识别同版本替换。
- **beta.1 → beta.2 升级验证**：手动安装重新发布的 beta.1，确认无需 `LD_PRELOAD` 即可启动，再在应用内检查并安装 beta.2。旧 beta.1 在 Arch x86_64 上通过临时设置 `LD_PRELOAD=/usr/lib/libwayland-client.so.0` 成功升级；DEB/RPM 授权弹窗和不同 Linux 图形环境仍待实测。

### 本版本包含的主要 PR 和问题修复

- 本版本包含 Linux 侧栏启动宽度修正；Linux 应用内更新实现见 [PR #362](https://github.com/St0ff3l/fileterm/pull/362)。
- [PR #365](https://github.com/St0ff3l/fileterm/pull/365)：修复 Linux 窗口启动后侧栏宽度变窄的问题。

完整变更记录请查看 [v2.3.2-beta.1 与 v2.3.2-beta.2 的比较](https://github.com/St0ff3l/fileterm/compare/v2.3.2-beta.1...v2.3.2-beta.2)。

### 反馈与支持

> &bull;&nbsp;遇到问题请前往 [GitHub Issues](https://github.com/St0ff3l/fileterm/issues) 提交反馈，并附上操作系统、FileTerm 版本、连接类型、复现步骤和脱敏日志；不要提交密码、私钥或 token。
> &bull;&nbsp;也可以加入微信群交流：请打开仓库 [README 的“社区交流”部分](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81) 扫描二维码进微信群，也可加入 QQ 群 534418986。

---

## FileTerm 2.3.2-beta.2

This beta is for testing the Linux in-app update from beta.1 to beta.2. Install beta.1 manually first. AppImages must be in a location writable by the current user; DEB/RPM updates may require administrator authorization. Arch and other unsupported installations continue to use the Releases page.

**Downloads**

| Platform | Type      | Downloads                                                                                                                                                                                                                                                                             |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-macos-x64.dmg)                                         |
| Windows  | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-windows-arm64-setup.exe)                                   |
| Windows  | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-windows-arm64-portable.exe) (requires WebView2 Runtime) |
| Linux    | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-arm64.deb)                                             |
| Linux    | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-arm64.rpm)                                             |
| Linux    | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-arm64.AppImage)                                   |
| Linux    | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.2/FileTerm-2.3.2-beta.2-linux-arm64.pkg.tar.zst)                             |

**Installation guides**

[![English Installation Guide](https://img.shields.io/badge/English-Installation_Guide-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/en-US.md)

### 2.3.2-beta.2 Highlights

- **Linux in-app updates**: Use the Tauri updater with Ed25519 signature verification for supported AppImage, DEB, and RPM installations. AppImages are installed with a verified backup and atomic replacement; DEB/RPM updates use the system installer and may require administrator authorization.
- **Installation boundaries**: AppImages must be in a location writable by the current user. DEB/RPM updates are enabled only for FileTerm installations owned by the system package manager. Arch packages and unsupported architectures continue to open GitHub Releases.
- **Linux sidebar startup width**: Restore the 214px default when the window reaches its final size. A temporarily narrow startup viewport no longer permanently changes the width, and manual resizing is preserved.
- **AppImage graphics compatibility**: The repack removes display-stack libraries that should come from the host, avoiding conflicts with newer Mesa/Wayland. Users with the previously published beta.2 must download this same-version replacement manually because the updater will not detect an equal version.
- **beta.1 → beta.2 update test**: Install the republished beta.1 and verify it launches without `LD_PRELOAD`, then check for beta.2 in the app. The old beta.1 was verified to update on Arch x86_64 when launched with `LD_PRELOAD=/usr/lib/libwayland-client.so.0`; DEB/RPM authorization dialogs and other Linux graphics environments remain untested.

### Main PRs and issues

- This release includes the Linux sidebar startup width fix in [PR #365](https://github.com/St0ff3l/fileterm/pull/365); the Linux in-app updater is implemented in [PR #362](https://github.com/St0ff3l/fileterm/pull/362).

See the [comparison between v2.3.2-beta.1 and v2.3.2-beta.2](https://github.com/St0ff3l/fileterm/compare/v2.3.2-beta.1...v2.3.2-beta.2) for the complete change set.

### Feedback & Support

> &bull;&nbsp;For problems, open a [GitHub Issue](https://github.com/St0ff3l/fileterm/issues) with the operating system, FileTerm version, connection type, reproduction steps, and redacted logs. Do not submit passwords, private keys, or tokens.
> &bull;&nbsp;Join the community through the [README community section](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81).
