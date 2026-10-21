## FileTerm 2.3.1-beta.12

本测试版修复终端 WebGL 字形缓存与纹理槽回收问题，解决可复现的工作区更新重放，并减少 DOM 符号字形的重复布局。

**下载地址**

| 平台    | 类型     | 下载                                                                                                                                                                                                                                                                                     |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | DMG      | [Apple 芯片](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-macos-x64.dmg)                                           |
| Windows | 安装版   | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-windows-arm64-setup.exe)                                  |
| Windows | 便携版   | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-windows-arm64-portable.exe)（需安装 WebView2 Runtime） |
| Linux   | DEB      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-arm64.deb)                                            |
| Linux   | RPM      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-arm64.rpm)                                            |
| Linux   | AppImage | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-arm64.AppImage)                                  |
| Linux   | Arch     | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-arm64.pkg.tar.zst)                            |

**安装指南**

[![简体中文安装指南](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E5%AE%89%E8%A3%85%E6%8C%87%E5%8D%97-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/zh-CN.md)

### 2.3.1-beta.12 更新重点

- **WebGL 字形与纹理缓存**：块字符不再触发 DOM 回退；共享字形图集清理会同步失效相关终端，字体或图集变化后会回收旧纹理槽和 mip levels。仅在 WebGL 加载/激活失败或 context loss 时回退 DOM。GPU 探针统计的是 API 请求大小，不代表实测显存。
- **长时终端更新**：修复可复现的 workspace 更新重放，监控、目录和传输 reducer 按事件顺序执行一次；减少 DOM 符号字形的重复扫描与布局。
- **验证范围与限制**：Windows WebView2/WebGL 回归、混合输出及模拟目录更新通过。真实远端目录刷新后的错位、数小时 Claude Code 负载、GPU/native 内存增长仍待现场验证；DOM block 布局仍有开销。

### 本版本包含的主要 PR 和问题修复

- [PR #351](https://github.com/St0ff3l/fileterm/pull/351)：修复 WebGL 图集/纹理缓存增长和 workspace 更新重放，并减少 DOM 符号布局开销。

完整变更记录请查看 [v2.3.1-beta.11 与 v2.3.1-beta.12 的比较](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.11...v2.3.1-beta.12)。

### 反馈与支持

> &bull;&nbsp;遇到问题请前往 [GitHub Issues](https://github.com/St0ff3l/fileterm/issues) 提交反馈，并附上操作系统、FileTerm 版本、连接类型、复现步骤和脱敏日志；不要提交密码、私钥或 token。
> &bull;&nbsp;也可以加入微信群交流：请打开仓库 [README 的“社区交流”部分](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81) 扫描二维码进微信群，也可加入 QQ 群 534418986。

---

## FileTerm 2.3.1-beta.12

This beta fixes terminal WebGL glyph-cache and texture-slot retention, prevents reproducible workspace update replay, and reduces repeated DOM symbol layout.

**Downloads**

| Platform | Type      | Downloads                                                                                                                                                                                                                                                                                 |
| -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | DMG       | [Apple silicon](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-macos-arm64.dmg) · [Intel](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-macos-x64.dmg)                                         |
| Windows  | Installer | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-windows-x64-setup.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-windows-arm64-setup.exe)                                   |
| Windows  | Portable  | [x64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-windows-x64-portable.exe) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-windows-arm64-portable.exe) (requires WebView2 Runtime) |
| Linux    | DEB       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-x86_64.deb) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-arm64.deb)                                             |
| Linux    | RPM       | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-x86_64.rpm) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-arm64.rpm)                                             |
| Linux    | AppImage  | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-x86_64.AppImage) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-arm64.AppImage)                                   |
| Linux    | Arch      | [x86_64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-x86_64.pkg.tar.zst) · [ARM64](https://github.com/St0ff3l/fileterm/releases/download/v2.3.1-beta.12/FileTerm-2.3.1-beta.12-linux-arm64.pkg.tar.zst)                             |

**Installation guides**

[![English Installation Guide](https://img.shields.io/badge/English-Installation_Guide-0969DA?style=for-the-badge&labelColor=555)](https://github.com/St0ff3l/fileterm/blob/main/docs/installation/en-US.md)

### Highlights

- **WebGL glyphs and texture caches**: Block characters no longer trigger a DOM fallback. Shared glyph-atlas invalidation reaches peer terminals, and stale texture slots and mip levels are reclaimed after font or atlas changes. DOM fallback remains for WebGL load or activation failures and context loss. The GPU probe reports API request sizes, not measured VRAM.
- **Long-running terminal updates**: Fix reproducible workspace update replay so monitoring, directory, and transfer reducers run once in event order; reduce repeated DOM symbol scans and layout.
- **Validation and limits**: Windows WebView2/WebGL regressions, mixed output, and simulated directory updates pass. Remote directory refresh alignment, multi-hour Claude Code workloads, and GPU/native memory growth still need field validation; DOM block layout remains costly.

### Main PRs and issues

- [PR #351](https://github.com/St0ff3l/fileterm/pull/351): Fix WebGL glyph-atlas and texture-cache growth and workspace update replay, and reduce DOM symbol layout work.

See the [comparison between v2.3.1-beta.11 and v2.3.1-beta.12](https://github.com/St0ff3l/fileterm/compare/v2.3.1-beta.11...v2.3.1-beta.12) for the complete change set.

### Feedback & Support

> &bull;&nbsp;For problems, open a [GitHub Issue](https://github.com/St0ff3l/fileterm/issues) with the operating system, FileTerm version, connection type, reproduction steps, and redacted logs. Do not submit passwords, private keys, or tokens.
> &bull;&nbsp;Join the community through the [README community section](https://github.com/St0ff3l/fileterm#%E7%A4%BE%E5%8C%BA%E4%BA%A4%E6%B5%81).
