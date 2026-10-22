## FileTerm 2.3.1-beta.13

本测试版改进 WebGL 字形透明度与几何对齐，修复终端关闭时的光标闪烁定时器清理，并减少监控图表的重复处理。

**下载地址**

| 平台    | 类型     | 下载                                                                                                                                                                                                                                                                                     |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | DMG      | [Apple 芯片](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-macos-x64.dmg)                                           |
| Windows | 安装版   | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-windows-arm64-setup.exe)                                  |
| Windows | 便携版   | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-windows-arm64-portable.exe)（需安装 WebView2 Runtime） |
| Linux   | DEB      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-arm64.deb)                                            |
| Linux   | RPM      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-arm64.rpm)                                            |
| Linux   | AppImage | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-arm64.AppImage)                                  |
| Linux   | Arch     | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-arm64.pkg.tar.zst)                            |

**安装指南**

[![简体中文安装指南](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/zh-CN.md)

### 2.3.1-beta.13 更新重点

- **WebGL 字形渲染**：分离字形覆盖率与颜色混合，并让图集透明度匹配当前主题背景；不透明 Windows 主题保留子像素抗锯齿。改进块/框字符几何和字体、DPR 感知的基线定位。原生 WebView2 的文字边缘与混合脚本像素一致性仍未验证。
- **终端资源清理**：在释放 WebGL 插件和上下文前先释放光标闪烁状态管理器，避免定时器继续持有已关闭且聚焦的终端及其回滚内容。尚未在原生 WebView2 测量 RSS 回收；数小时 Claude Code 活跃会话的内存增长仍未解释，不能认定该问题已修复。
- **监控图表**：样本未变化时复用监控历史和网络图表路径，减少重复计算。
- **验证范围**：Windows Playwright Chromium 156 + ANGLE D3D11 的 WebGL fixture 已通过；这不是原生 Tauri/WebView2 验证。

### 本版本包含的主要 PR 和问题修复

- [PR #352](https://github.com/St0ff3l/fileterm/pull/352)：改进 WebGL 字形混合和对齐，清理终端光标闪烁定时器，并减少监控图表重复处理。

完整变更记录请查看 [v2.3.1-beta.12 与 v2.3.1-beta.13 的比较](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.12...v2.3.1-beta.13)。

### 反馈与支持

> &bull;&nbsp;遇到问题请前往 [GitHub Issues](https://github.com/St0ff3l/fileterm/issues) 提交反馈，并附上操作系统、FileTerm 版本、连接类型、复现步骤和脱敏日志；不要提交密码、私钥或 token。
> &bull;&nbsp;也可以加入微信群交流：请打开仓库 [README 的“社区交流”部分](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81) 扫描二维码进微信群，也可加入 QQ 群 534418986。

---

## FileTerm 2.3.1-beta.13

This beta improves WebGL glyph coverage and alignment, cleans up cursor-blink timers when terminals close, and avoids redundant monitoring-chart work.

**Downloads**

| Platform | Type      | Downloads                                                                                                                                                                                                                                                                                 |
| -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-macos-x64.dmg)                                         |
| Windows  | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-windows-arm64-setup.exe)                                   |
| Windows  | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-windows-arm64-portable.exe) (requires WebView2 Runtime) |
| Linux    | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-arm64.deb)                                             |
| Linux    | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-arm64.rpm)                                             |
| Linux    | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-arm64.AppImage)                                   |
| Linux    | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.13/FileTerm-2.3.1-beta.13-linux-arm64.pkg.tar.zst)                             |

**Installation guides**

[![English Installation Guide](https://img.shields.io/badge/English-Installation_Guide-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/en-US.md)

### Highlights

- **WebGL glyph rendering**: Separate glyph coverage from color blending and match atlas transparency to the live theme background; opaque Windows themes retain subpixel antialiasing. Improve block/box geometry and font/DPR-aware baseline placement. Native WebView2 pixel parity for text edges and mixed scripts remains unverified.
- **Terminal cleanup**: Dispose the cursor-blink state manager before disposing the WebGL addon and context, preventing its timer from retaining a closed, focused terminal and its scrollback. Native WebView2 RSS reclamation was not measured; multi-hour active Claude Code session memory growth remains unexplained and is not established as fixed.
- **Monitoring charts**: Reuse monitoring history and network chart paths when samples have not changed, reducing repeated work.
- **Validation scope**: The WebGL fixture passed on Windows Playwright Chromium 156 with ANGLE D3D11; this is not native Tauri/WebView2 validation.

### Main PRs and issues

- [PR #352](https://github.com/St0ff3l/fileterm/pull/352): Improve WebGL glyph blending and alignment, clean up terminal cursor-blink timers, and reduce repeated monitoring-chart work.

See the [comparison between v2.3.1-beta.12 and v2.3.1-beta.13](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.12...v2.3.1-beta.13) for the complete change set.

### Feedback & Support

> &bull;&nbsp;For problems, open a [GitHub Issue](https://github.com/St0ff3l/fileterm/issues) with the operating system, FileTerm version, connection type, reproduction steps, and redacted logs. Do not submit passwords, private keys, or tokens.
> &bull;&nbsp;Join the community through the [README community section](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81).
