## FileTerm 2.3.1

FileTerm 2.3.1 将近期 SSH、终端渲染、文件编辑和 macOS 应用内更新改进合入正式版。

**下载地址**

| 平台    | 类型     | 下载                                                                                                                                                                                                                                                     |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | DMG      | [Apple 芯片](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-macos-x64.dmg)                                           |
| Windows | 安装版   | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-windows-arm64-setup.exe)                                  |
| Windows | 便携版   | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-windows-arm64-portable.exe)（需安装 WebView2 Runtime） |
| Linux   | DEB      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-arm64.deb)                                            |
| Linux   | RPM      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-arm64.rpm)                                            |
| Linux   | AppImage | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-arm64.AppImage)                                  |
| Linux   | Arch     | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-arm64.pkg.tar.zst)                            |

**安装指南**

[![简体中文安装指南](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/zh-CN.md)

### 2.3.1 更新重点

- **SSH 与连接工作流**：支持最多 8 层 SSH 跳板、SSH 配置别名和交互式密码/私钥认证；连接标签可按主机分组。用户手动上传 WebDAV 或 S3 备份时，SSH 私钥与已保存的密钥口令会和连接配置一起加密；下载会合并备份中的密钥，并保留仅存于本机的密钥。
- **终端渲染与稳定性**：Windows、macOS 和 Linux 可选择 DOM 或 WebGL renderer，WebGL 失败时回退到 DOM；改进字形对齐、图集和纹理回收、连续输出处理，并减少 DOM 字形绘制的布局工作。
- **编辑器与桌面体验**：Monaco 文件编辑器支持显示空白字符、转换 LF/CRLF 行尾并撤销；窗口会适配显示器尺寸和 DPI，桌面图标刷新也更一致。
- **macOS 应用内更新**：使用 Tauri updater 下载更新并以 Ed25519 验签，安装失败时尝试恢复旧应用并重启。beta.14 及更早版本不含应用内 updater，需要手动安装本版；更新包签名不等于 Apple Developer ID 签名或公证，首次安装仍可能需要在“系统设置 → 隐私与安全性”批准。
- **终端字形布局**：修复 xterm 行更新后图形字符重新显示的问题，并避免每帧强制读取终端行布局；本次回归测试覆盖不同设备像素比、选择和点击后重绘。

### 本版本包含的主要 PR 和问题修复

- [PR #317](https://github.com/St0ff3l/fileterm/pull/317)：加入多级 SSH 跳板、串口与终端稳定性改进，以及桌面图标选择。
- [PR #322](https://github.com/St0ff3l/fileterm/pull/322)：刷新 Windows Shell 快捷方式图标，并将 SSH 密钥库加入远程备份同步。
- [PR #334](https://github.com/St0ff3l/fileterm/pull/334) 与 [PR #335](https://github.com/St0ff3l/fileterm/pull/335)：改进 SSH 交互认证、显示器适配和 Monaco 编辑器。
- [PR #340](https://github.com/St0ff3l/fileterm/pull/340)：增加 SSH 配置别名连接并强化 SSH 配置与密钥策略。
- [PR #348](https://github.com/St0ff3l/fileterm/pull/348)、[#351](https://github.com/St0ff3l/fileterm/pull/351)、[#352](https://github.com/St0ff3l/fileterm/pull/352) 和 [#355](https://github.com/St0ff3l/fileterm/pull/355)：改进跨平台终端 renderer、WebGL 字形、纹理生命周期和桌面图标。
- [PR #357](https://github.com/St0ff3l/fileterm/pull/357)：加入 macOS Tauri 应用内更新和更新包验签、恢复流程。
- [PR #358](https://github.com/St0ff3l/fileterm/pull/358)：修复 DOM 图形字形重绘，并降低终端逐帧布局开销。

完整变更记录请查看 [v2.2.31 与 v2.3.1 的比较](https://github.com/St0ff3l/fileterm/compare/v2.2.31...v2.3.1)。

### 反馈与支持

> &bull;&nbsp;遇到问题请前往 [GitHub Issues](https://github.com/St0ff3l/fileterm/issues) 提交反馈，并附上操作系统、FileTerm 版本、连接类型、复现步骤和脱敏日志；不要提交密码、私钥或 token。
> &bull;&nbsp;也可以加入微信群交流：请打开仓库 [README 的“社区交流”部分](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81) 扫描二维码进微信群，也可加入 QQ 群 534418986。

---

## FileTerm 2.3.1

FileTerm 2.3.1 brings recent SSH, terminal rendering, file editing, and macOS in-app update improvements into the stable release.

**Downloads**

| Platform | Type      | Downloads                                                                                                                                                                                                                                                 |
| -------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-macos-x64.dmg)                                         |
| Windows  | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-windows-arm64-setup.exe)                                   |
| Windows  | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-windows-arm64-portable.exe) (requires WebView2 Runtime) |
| Linux    | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-arm64.deb)                                             |
| Linux    | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-arm64.rpm)                                             |
| Linux    | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-arm64.AppImage)                                   |
| Linux    | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1/FileTerm-2.3.1-linux-arm64.pkg.tar.zst)                             |

**Installation guides**

[![English Installation Guide](https://img.shields.io/badge/English-Installation_Guide-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/en-US.md)

### Highlights

- **SSH and connection workflows**: Connect through up to eight SSH jump hosts, use SSH config aliases, and choose between a password or imported private key in interactive authentication. Group connection tabs by host. When users manually upload WebDAV or S3 backups, SSH private keys and saved passphrases are encrypted with connection settings; downloads merge backed-up keys while retaining keys stored only on the current device.
- **Terminal rendering and stability**: Choose the DOM or WebGL renderer on Windows, macOS, and Linux, with a DOM fallback if WebGL fails. Improve glyph alignment, atlas and texture cleanup, and sustained-output handling while reducing layout work during DOM glyph rendering.
- **Editor and desktop experience**: Toggle whitespace markers, convert LF/CRLF line endings with undo in the Monaco file editor, adapt windows to display geometry and DPI, and refresh desktop icons more consistently.
- **macOS in-app updates**: Download updates through the Tauri updater and verify them with Ed25519 signatures; a failed install attempts to restore the previous app before restarting. Beta.14 and earlier do not include the updater and require a manual install of this release. The update signature does not provide Apple Developer ID signing or notarization, so macOS may still require approval in System Settings → Privacy & Security on first install.
- **Terminal glyph layout**: Fix graphic glyphs reappearing after xterm row updates and avoid forced terminal-row layout reads on every frame. Regression coverage includes different device-pixel ratios, selection, and redraw after clicks.

### Main PRs and issues

- [PR #317](https://github.com/St0ff3l/fileterm/pull/317): Add multi-hop SSH, serial and terminal stability improvements, and desktop icon selection.
- [PR #322](https://github.com/St0ff3l/fileterm/pull/322): Refresh Windows Shell shortcut icons and include the SSH key vault in remote backups.
- [PR #334](https://github.com/St0ff3l/fileterm/pull/334) and [PR #335](https://github.com/St0ff3l/fileterm/pull/335): Improve SSH interactive authentication, display adaptation, and the Monaco editor.
- [PR #340](https://github.com/St0ff3l/fileterm/pull/340): Add SSH config aliases and strengthen SSH configuration and key handling.
- [PR #348](https://github.com/St0ff3l/fileterm/pull/348), [#351](https://github.com/St0ff3l/fileterm/pull/351), [#352](https://github.com/St0ff3l/fileterm/pull/352), and [#355](https://github.com/St0ff3l/fileterm/pull/355): Improve cross-platform terminal renderers, WebGL glyphs, texture lifetimes, and desktop icons.
- [PR #357](https://github.com/St0ff3l/fileterm/pull/357): Add macOS Tauri in-app updates, update signature verification, and recovery.
- [PR #358](https://github.com/St0ff3l/fileterm/pull/358): Fix DOM graphic glyph redraw and reduce per-frame terminal layout work.

See the [comparison between v2.2.31 and v2.3.1](https://github.com/St0ff3l/fileterm/compare/v2.2.31...v2.3.1) for the complete change set.

### Feedback & Support

> &bull;&nbsp;For problems, open a [GitHub Issue](https://github.com/St0ff3l/fileterm/issues) with the operating system, FileTerm version, connection type, reproduction steps, and redacted logs. Do not submit passwords, private keys, or tokens.
> &bull;&nbsp;Join the community through the [README community section](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81).
