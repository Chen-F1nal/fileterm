## FileTerm 2.3.1-beta.11

本测试版为 Windows 终端增加 DOM/WebGL 选择、修复 WebGL 字形栅格问题，并补充用于定位卡顿的 renderer 诊断日志。

**下载地址**

| 平台    | 类型     | 下载                                                                                                                                                                                                                                                                                     |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | DMG      | [Apple 芯片](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-macos-x64.dmg)                                           |
| Windows | 安装版   | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-windows-arm64-setup.exe)                                  |
| Windows | 便携版   | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-windows-arm64-portable.exe)（需安装 WebView2 Runtime） |
| Linux   | DEB      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-arm64.deb)                                            |
| Linux   | RPM      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-arm64.rpm)                                            |
| Linux   | AppImage | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-arm64.AppImage)                                  |
| Linux   | Arch     | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-arm64.pkg.tar.zst)                            |

**安装指南**

[![简体中文安装指南](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/zh-CN.md)

### 2.3.1-beta.11 更新重点

- **Windows 终端 renderer**：可在“设置 → 界面 → 终端显示”选择 DOM 或 WebGL。新安装默认 DOM；旧设置中没有 renderer 选项的升级用户首次迁移到 WebGL，之后保留用户明确选择。WebGL 加载或 context 恢复失败时自动回退 DOM；macOS 和 Linux 继续使用 DOM。已打开的终端需新建或重启后应用选择。
- **字体与栅格**：修复 WebGL 在 DPI、字体或画布尺寸变化后的视口同步，并保留 xterm 的整数像素字形图集约束，避免混合文字出现断笔、拖影或数字字形异常。
- **卡顿诊断与终端响应**：app.log 增加 renderer 状态、输入派发延迟、解析/绘制耗时、解析与 ACK 积压、长任务时间点及进程资源摘要；不记录终端输入正文。终端查询回复绕过无关 UI 状态更新，降低后台或输入法状态下丢失回复的风险。
- **测试版说明**：WebGL 在 Windows 上可选，尚未宣称真实 Claude Code 长任务下的性能提升；遇到问题可切回 DOM，并附脱敏日志反馈。

### 本版本包含的主要 PR 和问题修复

- [PR #348](https://github.com/St0ff3l/fileterm/pull/348)：增加 Windows DOM/WebGL renderer 选择、WebView2 字体与生命周期修复、终端卡顿诊断及协议回复处理修复。

完整变更记录请查看 [v2.3.1-beta.10 与 v2.3.1-beta.11 的比较](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.10...v2.3.1-beta.11)。

### 反馈与支持

> &bull;&nbsp;遇到问题请前往 [GitHub Issues](https://github.com/St0ff3l/fileterm/issues) 提交反馈，并附上操作系统、FileTerm 版本、连接类型、复现步骤和脱敏日志；不要提交密码、私钥或 token。
> &bull;&nbsp;也可以加入微信群交流：请打开仓库 [README 的“社区交流”部分](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81) 扫描二维码进微信群，也可加入 QQ 群 534418986。

---

## FileTerm 2.3.1-beta.11

This beta adds DOM/WebGL selection for Windows terminals, fixes WebGL glyph-grid rendering and expands renderer diagnostics for investigating stalls.

**Downloads**

| Platform | Type      | Downloads                                                                                                                                                                                                                                                                                 |
| -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-macos-x64.dmg)                                         |
| Windows  | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-windows-arm64-setup.exe)                                   |
| Windows  | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-windows-arm64-portable.exe) (requires WebView2 Runtime) |
| Linux    | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-arm64.deb)                                             |
| Linux    | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-arm64.rpm)                                             |
| Linux    | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-arm64.AppImage)                                   |
| Linux    | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.11/FileTerm-2.3.1-beta.11-linux-arm64.pkg.tar.zst)                             |

**Installation guides**

[![English Installation Guide](https://img.shields.io/badge/English-Installation_Guide-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/en-US.md)

### Highlights

- **Windows terminal renderer**: Choose DOM or WebGL in Settings → Interface → Terminal Display. New installations default to DOM. Upgrades whose saved settings do not contain a renderer choice migrate to WebGL once; later explicit choices are preserved. FileTerm falls back to DOM if WebGL fails to load or recover its context. macOS and Linux continue to use DOM. Apply a changed choice to new or restarted terminals.
- **Fonts and glyph grid**: Synchronize the WebGL viewport after DPI, font or canvas-size changes while preserving xterm's integer-pixel glyph atlas constraints, preventing broken strokes, trails and malformed digits in mixed text.
- **Stall diagnostics and terminal replies**: `app.log` now records renderer state, input dispatch delay, parse and draw timings, parse/ACK backlog, long-task timestamps and process resource summaries without recording terminal input contents. Terminal query replies bypass unrelated UI state updates to reduce the risk of dropped replies in background or IME states.
- **Beta note**: WebGL is optional on Windows. Performance under real, long-running Claude Code workloads has not been established. Switch to DOM if needed and include redacted logs when reporting problems.

### Main PRs and issues

- [PR #348](https://github.com/St0ff3l/fileterm/pull/348): Add Windows DOM/WebGL selection, WebView2 font and lifecycle fixes, renderer stall diagnostics, and terminal protocol-reply handling.

See the [comparison between v2.3.1-beta.10 and v2.3.1-beta.11](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.10...v2.3.1-beta.11) for the complete change set.

### Feedback & Support

> &bull;&nbsp;For problems, open a [GitHub Issue](https://github.com/St0ff3l/fileterm/issues) with the operating system, FileTerm version, connection type, reproduction steps, and redacted logs. Do not submit passwords, private keys, or tokens.
> &bull;&nbsp;Join the community through the [README community section](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81).
