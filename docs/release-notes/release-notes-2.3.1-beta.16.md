## FileTerm 2.3.1-beta.16

本测试版专门用于验证 macOS 从 beta.15 应用内升级到 beta.16；beta.14 及更早版本需先手动安装 beta.15。

**下载地址**

| 平台    | 类型      | 下载                                                                                                                                                                                                                                                                                   |
| ------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-macos-x64.dmg)                                      |
| Windows | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-windows-arm64-setup.exe)                                |
| Windows | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-windows-arm64-portable.exe)（需要 WebView2 Runtime） |
| Linux   | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-arm64.deb)                                          |
| Linux   | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-arm64.rpm)                                          |
| Linux   | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-arm64.AppImage)                                |
| Linux   | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-arm64.pkg.tar.zst)                          |

**安装指南**

[![简体中文安装指南](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/zh-CN.md)

### 2.3.1-beta.16 更新重点

- **beta.15 → beta.16 连续升级测试**：保留 beta.15 的 Tauri updater、Ed25519 更新包验签、安装失败恢复和重启行为；此版本仅提升版本号，供实际 Release 更新链路测试。
- **首次安装边界**：beta.14 及更早版本不包含应用内 updater，需先手动安装 beta.15。beta.16 没有 Apple Developer ID 签名或公证；首次安装 beta.15 时若 macOS 拦截，请按系统提示在“系统设置 → 隐私与安全性”批准。
- **验证范围**：beta.15 → beta.16 的正式 GitHub Release 更新链路待本次实测；此前本机 Apple Silicon 仅用隔离的测试清单验证了同一 updater 实现，浏览器隔离属性下的首次安装与 Intel 实机仍待验证。

### 本版本包含的主要 PR 和问题修复

- 本次仅更新应用版本号，用于验证 beta.15 → beta.16；应用内更新实现见 [PR #357](https://github.com/St0ff3l/fileterm/pull/357)。

完整变更记录请查看 [v2.3.1-beta.15 与 v2.3.1-beta.16 的比较](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.15...v2.3.1-beta.16)。

### 反馈与支持

> &bull;&nbsp;遇到问题请前往 [GitHub Issues](https://github.com/St0ff3l/fileterm/issues) 提交反馈，并附上操作系统、FileTerm 版本、连接类型、复现步骤和脱敏日志；不要提交密码、私钥或 token。
> &bull;&nbsp;也可以加入微信群交流：请打开仓库 [README 的“社区交流”部分](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81) 扫描二维码进微信群，也可加入 QQ 群 534418986。

---

## FileTerm 2.3.1-beta.16

This beta is dedicated to testing the macOS in-app update from beta.15 to beta.16. Beta.14 and earlier require a manual beta.15 installation first.

**Downloads**

| Platform | Type      | Downloads                                                                                                                                                                                                                                                                                 |
| -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-macos-x64.dmg)                                         |
| Windows  | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-windows-arm64-setup.exe)                                   |
| Windows  | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-windows-arm64-portable.exe) (requires WebView2 Runtime) |
| Linux    | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-arm64.deb)                                             |
| Linux    | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-arm64.rpm)                                             |
| Linux    | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-arm64.AppImage)                                   |
| Linux    | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.16/FileTerm-2.3.1-beta.16-linux-arm64.pkg.tar.zst)                             |

**Installation guides**

[![English Installation Guide](https://img.shields.io/badge/English-Installation_Guide-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/en-US.md)

### 2.3.1-beta.16 Highlights

- **beta.15 → beta.16 consecutive update test**: Keep beta.15's Tauri updater, Ed25519 package verification, failed-install recovery, and restart behavior. This build only increments the app version to test the actual Release update path.
- **First-install boundary**: Beta.14 and earlier do not include the in-app updater and must be upgraded to beta.15 manually first. Beta.16 has no Apple Developer ID signature or notarization. If macOS blocks the initial beta.15 install, follow the system prompt to approve it in System Settings → Privacy & Security.
- **Validation scope**: The beta.15 → beta.16 GitHub Release update path remains to be tested. The earlier local Apple Silicon test used an isolated test manifest with the same updater implementation; browser-quarantined first installs and Intel hardware remain untested.

### Main PRs and issues

- This release only increments the app version for beta.15 → beta.16 testing; the in-app updater implementation is in [PR #357](https://github.com/St0ff3l/fileterm/pull/357).

See the [comparison between v2.3.1-beta.15 and v2.3.1-beta.16](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.15...v2.3.1-beta.16) for the complete change set.

### Feedback & Support

> &bull;&nbsp;For problems, open a [GitHub Issue](https://github.com/St0ff3l/fileterm/issues) with the operating system, FileTerm version, connection type, reproduction steps, and redacted logs. Do not submit passwords, private keys, or tokens.
> &bull;&nbsp;Join the community through the [README community section](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81).
