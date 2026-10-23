## FileTerm 2.3.1-beta.14

本测试版修复 Windows WebGL 终端的彩色细线与图集缩放问题，并让任务栏和通知区使用与桌面图标同源的高清资源。

**下载地址**

| 平台    | 类型      | 下载                                                                                                                                                                                                                                                                                   |
| ------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-macos-x64.dmg)                                      |
| Windows | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-windows-arm64-setup.exe)                                |
| Windows | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-windows-arm64-portable.exe)（需要 WebView2 Runtime） |
| Linux   | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-arm64.deb)                                          |
| Linux   | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-arm64.rpm)                                          |
| Linux   | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-arm64.AppImage)                                |
| Linux   | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-arm64.pkg.tar.zst)                          |

**安装指南**

[![简体中文安装指南](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/zh-CN.md)

### 2.3.1-beta.14 更新重点

- **Windows WebGL 终端**：字形绘制位置对齐到设备像素，并让链接覆盖层使用整数图集单元，修复彩色细线、越界采样和图集重建后的像素变化。本机 Chromium / NVIDIA 回归中，6,440 组场景和 15,640 次边界探针未发现这些问题；19 组自动适配行列差异仍保留，原生安装版 WebView2 还需实测。
- **Windows 图标**：任务栏和托盘使用与桌面图标相同的 256px 源图，交由 Windows 按显示尺寸缩放。
- **格式检查**：Prettier 自动沿用文件现有的 LF 或 CRLF 换行，避免 Windows Git 换行转换造成的格式冲突。

### 本版本包含的主要 PR 和问题修复

- 修复 Windows WebGL 字形边缘的彩色细线及覆盖层图集重建造成的像素变化。
- 调整 Windows 任务栏和通知区图标资源分辨率。

完整变更记录请查看 [v2.3.1-beta.13 与 v2.3.1-beta.14 的比较](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.13...v2.3.1-beta.14)。

### 反馈与支持

> &bull;&nbsp;遇到问题请前往 [GitHub Issues](https://github.com/St0ff3l/fileterm/issues) 提交反馈，并附上操作系统、FileTerm 版本、连接类型、复现步骤和脱敏日志；不要提交密码、私钥或 token。
> &bull;&nbsp;也可以加入微信群交流：请打开仓库 [README 的“社区交流”部分](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81) 扫描二维码进微信群，也可加入 QQ 群 534418986。

---

## FileTerm 2.3.1-beta.14

This beta fixes colored edge artifacts and glyph atlas scaling in the Windows WebGL terminal. It also uses the desktop-resolution icon artwork for the taskbar and tray.

**Downloads**

| Platform | Type      | Downloads                                                                                                                                                                                                                                                                                 |
| -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-macos-x64.dmg)                                         |
| Windows  | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-windows-arm64-setup.exe)                                   |
| Windows  | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-windows-arm64-portable.exe) (requires WebView2 Runtime) |
| Linux    | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-arm64.deb)                                             |
| Linux    | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-arm64.rpm)                                             |
| Linux    | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-arm64.AppImage)                                   |
| Linux    | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.14/FileTerm-2.3.1-beta.14-linux-arm64.pkg.tar.zst)                             |

**Installation guides**

[![English Installation Guide](https://img.shields.io/badge/English-Installation_Guide-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/en-US.md)

### 2.3.1-beta.14 Highlights

- **Windows WebGL terminal**: Align glyph drawing to device pixels and use integer atlas cells for the link overlay, fixing colored edge artifacts, out-of-bounds sampling, and pixel changes after atlas rebuilds. Local Chromium/NVIDIA regression covered 6,440 scenarios and 15,640 edge probes with none of these issues; 19 automatic-fit row or column differences remain, and the native installed WebView2 app still needs verification.
- **Windows icons**: Use the same 256px source artwork as the desktop icon for taskbar and tray surfaces, letting Windows scale it to display size.
- **Formatting checks**: Let Prettier follow each file's existing LF or CRLF line endings, avoiding conflicts with Windows Git checkout conversion.

### Main PRs and issues

- Fix colored edge artifacts and atlas rebuild changes in the Windows WebGL terminal.
- Update Windows taskbar and tray icon source resolution.

See the [comparison between v2.3.1-beta.13 and v2.3.1-beta.14](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.13...v2.3.1-beta.14) for the complete change set.

### Feedback & Support

> &bull;&nbsp;For problems, open a [GitHub Issue](https://github.com/St0ff3l/fileterm/issues) with the operating system, FileTerm version, connection type, reproduction steps, and redacted logs. Do not submit passwords, private keys, or tokens.
> &bull;&nbsp;Join the community through the [README community section](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81).
