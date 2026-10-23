# Windows/Linux 1024px 应用图标

- 从 Icon Composer 工程直接导出无 macOS 安全边距的 1024px classic/material/clean 图，作为 Windows/Linux 图标母版。
- Windows 运行时窗口/任务栏与 Linux 窗口/启动器使用 1024px；Windows ICO 保留系统兼容的多尺寸图层。
- Linux 安装包补充 1024px hicolor/pixmaps 图标，并同步包内容校验和测试。
- 更新图标 skill、平台约束和资源清单；验证图片尺寸/边界、Rust 图标测试及项目门禁，记录无法实测的平台。

## 完成与验证

- 三个变体由 Icon Composer 直接导出为满版 1024px 图；生成脚本规范为 8-bit sRGB RGBA，再派生小尺寸资源，重复生成字节一致。
- Windows 大小窗口 HICON 均加载 1024px，并补充原生位图尺寸断言；托盘保持 256px，快捷方式保持标准多尺寸 ICO。Linux 窗口/启动器和包内 hicolor/pixmaps/AppImage 图标接入 1024px。
- 类型、Lint、全范围 Prettier、200 项 Renderer 测试、852 项 Rust 单元测试及 CLI/contract 测试、严格 Clippy 通过；Linux 包图标 fixture 测试与图片尺寸/alpha/位深/ICO 一致性检查通过。
- macOS 上 Windows 全项目交叉检查被 MSVC C 头文件缺失阻断（ring 找不到 assert.h）；使用相同 windows 0.61.3 API 的独立 HICON 加载/位图读取片段交叉类型检查通过。Windows 原生 1024px HICON 测试和实际任务栏显示仍待 Windows 实机运行。
- 未在真实 Linux 桌面运行或制作新的 Linux 安装包；包路径核对了 Tauri hicolor 安装与 AppImage 最大图选择实现，包内容校验覆盖 1024px 资源。
