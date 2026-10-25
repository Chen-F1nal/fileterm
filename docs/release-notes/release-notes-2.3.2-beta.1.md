## FileTerm 2.3.2-beta.1

本测试版为受支持的 Linux AppImage、DEB、RPM 安装增加签名校验的应用内更新。beta.1 需先手动安装，beta.2 将用于验证从 GitHub Release 下载、验签、安装和重启的完整升级流程。AppImage 需要放在当前用户可写的位置；DEB/RPM 更新可能需要管理员授权；Arch 和其他不受支持的安装仍通过发布页更新。

**下载地址**

| 平台    | 类型      | 下载                                                                                                                                                                                                                                                                               |
| ------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-macos-x64.dmg)                                      |
| Windows | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-windows-arm64-setup.exe)                                |
| Windows | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-windows-arm64-portable.exe)（需要 WebView2 Runtime） |
| Linux   | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-arm64.deb)                                          |
| Linux   | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-arm64.rpm)                                          |
| Linux   | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-arm64.AppImage)                                |
| Linux   | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-arm64.pkg.tar.zst)                          |

**安装指南**

[![简体中文安装指南](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/zh-CN.md)

### 2.3.2-beta.1 更新重点

- **Linux 应用内更新**：对受支持的 AppImage、DEB 和 RPM 安装使用 Tauri updater，并验证 Ed25519 更新签名；AppImage 通过备份和原子替换安装，DEB/RPM 由系统安装器处理，可能要求管理员授权。
- **安装格式边界**：AppImage 必须位于当前用户可写的位置；DEB/RPM 仅对由系统包管理器安装的 FileTerm 启用；Arch 包和不支持的架构继续打开 GitHub Releases。
- **Linux 侧栏启动宽度**：窗口尺寸稳定后恢复 214px 默认宽度；窗口启动期间较窄的临时视口不会永久改变宽度，手动调整也会保留。
- **AppImage 图形兼容性**：重新打包时移除应由宿主系统提供的显示栈库，避免覆盖新版 Mesa/Wayland。已发布的旧 beta.1 包仍可能需要临时 `LD_PRELOAD=/usr/lib/libwayland-client.so.0` 才能启动。
- **测试方式与验证范围**：Arch x86_64 已验证旧 beta.1 在上述临时环境变量下可启动并应用内升级到 beta.2；重新发布的包用于验证无需该变量的启动及 beta.1 → beta.2 更新。DEB/RPM 授权弹窗和不同 GPU/桌面环境仍待验证。

### 本版本包含的主要 PR 和问题修复

- [PR #362](https://github.com/St0ff3l/fileterm/pull/362)：为 Linux AppImage、DEB 和 RPM 增加签名校验的应用内更新。

完整变更记录请查看 [v2.3.1-beta.16 与 v2.3.2-beta.1 的比较](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.16...v2.3.2-beta.1)。

### 反馈与支持

> &bull;&nbsp;遇到问题请前往 [GitHub Issues](https://github.com/St0ff3l/fileterm/issues) 提交反馈，并附上操作系统、FileTerm 版本、连接类型、复现步骤和脱敏日志；不要提交密码、私钥或 token。
> &bull;&nbsp;也可以加入微信群交流：请打开仓库 [README 的“社区交流”部分](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81) 扫描二维码进微信群，也可加入 QQ 群 534418986。

---

## FileTerm 2.3.2-beta.1

This beta adds signed Tauri in-app updates for supported Linux AppImage, DEB, and RPM installations. Install beta.1 manually first; beta.2 will test the full GitHub Release download, signature verification, installation, and restart flow. AppImages must be in a location writable by the current user; DEB/RPM updates may require administrator authorization. Arch and other unsupported installations continue to use the Releases page.

**Downloads**

| Platform | Type      | Downloads                                                                                                                                                                                                                                                                             |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-macos-x64.dmg)                                         |
| Windows  | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-windows-arm64-setup.exe)                                   |
| Windows  | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-windows-arm64-portable.exe) (requires WebView2 Runtime) |
| Linux    | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-arm64.deb)                                             |
| Linux    | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-arm64.rpm)                                             |
| Linux    | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-arm64.AppImage)                                   |
| Linux    | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.2-beta.1/FileTerm-2.3.2-beta.1-linux-arm64.pkg.tar.zst)                             |

**Installation guides**

[![English Installation Guide](https://img.shields.io/badge/English-Installation_Guide-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/en-US.md)

### 2.3.2-beta.1 Highlights

- **Linux in-app updates**: Use the Tauri updater with Ed25519 signature verification for supported AppImage, DEB, and RPM installations. AppImages are installed with a verified backup and atomic replacement; DEB/RPM updates use the system installer and may require administrator authorization.
- **Installation boundaries**: AppImages must be in a location writable by the current user. DEB/RPM updates are enabled only for FileTerm installations owned by the system package manager. Arch packages and unsupported architectures continue to open GitHub Releases.
- **Linux sidebar startup width**: Restore the 214px default when the window reaches its final size. A temporarily narrow startup viewport no longer permanently changes the width, and manual resizing is preserved.
- **AppImage graphics compatibility**: The repack removes display-stack libraries that should come from the host, avoiding conflicts with newer Mesa/Wayland. Previously published beta.1 downloads may still need the temporary `LD_PRELOAD=/usr/lib/libwayland-client.so.0` workaround to launch.
- **Test path and validation scope**: On Arch x86_64, the previously published beta.1 was verified to launch with that temporary environment variable and update in-app to beta.2. The republished packages are for verifying normal startup without it and the beta.1 → beta.2 update; DEB/RPM authorization dialogs and other GPU/desktop environments remain untested.

### Main PRs and issues

- [PR #362](https://github.com/St0ff3l/fileterm/pull/362): Add signed in-app updates for Linux AppImage, DEB, and RPM installations.

See the [comparison between v2.3.1-beta.16 and v2.3.2-beta.1](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.16...v2.3.2-beta.1) for the complete change set.

### Feedback & Support

> &bull;&nbsp;For problems, open a [GitHub Issue](https://github.com/St0ff3l/fileterm/issues) with the operating system, FileTerm version, connection type, reproduction steps, and redacted logs. Do not submit passwords, private keys, or tokens.
> &bull;&nbsp;Join the community through the [README community section](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81).
