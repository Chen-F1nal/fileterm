## FileTerm 2.3.1-beta.15

本测试版为 macOS 加入 Tauri 应用内更新；beta.14 及更早版本需先手动安装 beta.15，首次安装若被 macOS 拦截需在系统设置中批准。

**下载地址**

| 平台    | 类型      | 下载                                                                                                                                                                                                                                                                                   |
| ------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-macos-x64.dmg)                                      |
| Windows | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-windows-arm64-setup.exe)                                |
| Windows | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-windows-arm64-portable.exe)（需要 WebView2 Runtime） |
| Linux   | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-arm64.deb)                                          |
| Linux   | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-arm64.rpm)                                          |
| Linux   | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-arm64.AppImage)                                |
| Linux   | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-arm64.pkg.tar.zst)                          |

**安装指南**

[![简体中文安装指南](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/zh-CN.md)

### 2.3.1-beta.15 更新重点

- **macOS 应用内更新**：复用 Tauri updater，检查 GitHub Release 更新清单、下载更新包并校验 Ed25519 签名，再替换应用并重启。安装失败会尝试恢复原应用。
- **首次安装与系统批准**：beta.14 没有应用内 updater，必须先手动安装 beta.15。此版本没有 Apple Developer ID 签名或公证；如果 macOS 阻止首次打开，请按系统提示在“系统设置 → 隐私与安全性”手动批准。更新包签名只验证更新来源，不代替 Apple 公证。
- **SSH 加密依赖**：将 `crypto-bigint` 更新至修复版 0.7.6，并同步 `ctutils` 0.4.5，处理 [RustSec RUSTSEC-2026-0387](https://github.com/RustSec/advisory-db/blob/main/crates/crypto-bigint/RUSTSEC-2026-0387.md) 报告的恒定时间运算问题。
- **实测范围**：本地 Apple Silicon 打包流程验证了更新下载、签名拒绝、应用替换、自动重启及连接/暂停传输数据保留。Intel 实机和带浏览器隔离属性的首次安装仍待验证。

### 本版本包含的主要 PR 和问题修复

- [PR #357](https://github.com/St0ff3l/fileterm/pull/357)：为 macOS 加入经 Ed25519 验签的 Tauri 应用内更新、失败恢复和重启流程。

完整变更记录请查看 [v2.3.1-beta.14 与 v2.3.1-beta.15 的比较](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.14...v2.3.1-beta.15)。

### 反馈与支持

> &bull;&nbsp;遇到问题请前往 [GitHub Issues](https://github.com/St0ff3l/fileterm/issues) 提交反馈，并附上操作系统、FileTerm 版本、连接类型、复现步骤和脱敏日志；不要提交密码、私钥或 token。
> &bull;&nbsp;也可以加入微信群交流：请打开仓库 [README 的“社区交流”部分](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81) 扫描二维码进微信群，也可加入 QQ 群 534418986。

---

## FileTerm 2.3.1-beta.15

This beta adds Tauri in-app updates on macOS. Beta.14 and earlier require a manual beta.15 installation first; macOS may require approval in System Settings on first install.

**Downloads**

| Platform | Type      | Downloads                                                                                                                                                                                                                                                                                 |
| -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-macos-x64.dmg)                                         |
| Windows  | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-windows-arm64-setup.exe)                                   |
| Windows  | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-windows-arm64-portable.exe) (requires WebView2 Runtime) |
| Linux    | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-arm64.deb)                                             |
| Linux    | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-arm64.rpm)                                             |
| Linux    | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-arm64.AppImage)                                   |
| Linux    | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.15/FileTerm-2.3.1-beta.15-linux-arm64.pkg.tar.zst)                             |

**Installation guides**

[![English Installation Guide](https://img.shields.io/badge/English-Installation_Guide-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/en-US.md)

### 2.3.1-beta.15 Highlights

- **macOS in-app updates**: Reuse the Tauri updater to check the GitHub Release manifest, download an update, verify its Ed25519 signature, replace the app, and restart. A failed install attempts to restore the original app.
- **First install and system approval**: Beta.14 has no in-app updater, so beta.15 must be installed manually first. This build has no Apple Developer ID signature or notarization. If macOS blocks the first launch, follow the system prompt to approve it in System Settings → Privacy & Security. The updater signature verifies the update source; it does not provide Apple notarization.
- **SSH cryptography dependency**: Update `crypto-bigint` to fixed version 0.7.6 and `ctutils` to 0.4.5 for the constant-time issues reported in [RustSec RUSTSEC-2026-0387](https://github.com/RustSec/advisory-db/blob/main/crates/crypto-bigint/RUSTSEC-2026-0387.md).
- **Validation scope**: The local Apple Silicon package test covered update download, rejection of a modified package, app replacement, automatic restart, and retention of connection and paused-transfer data. Intel hardware and a first install carrying browser quarantine attributes remain untested.

### Main PRs and issues

- [PR #357](https://github.com/St0ff3l/fileterm/pull/357): Add Ed25519-verified Tauri in-app updates, install recovery, and restart handling on macOS.

See the [comparison between v2.3.1-beta.14 and v2.3.1-beta.15](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.14...v2.3.1-beta.15) for the complete change set.

### Feedback & Support

> &bull;&nbsp;For problems, open a [GitHub Issue](https://github.com/St0ff3l/fileterm/issues) with the operating system, FileTerm version, connection type, reproduction steps, and redacted logs. Do not submit passwords, private keys, or tokens.
> &bull;&nbsp;Join the community through the [README community section](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81).
