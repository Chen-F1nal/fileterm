# 小屏窗口适配与编辑器行尾

Refs #333、#332。

## 范围与方案

- 主窗口首次启动、默认尺寸和恢复尺寸统一按当前显示器工作区及 DPI 限制，同时降低超过工作区的原生最小尺寸，显示前校正位置。
- 独立编辑器和连接等窗口复用尺寸限制，保留既有居中与关闭链路。
- Monaco 首选项增加持久保存的空白字符显示；状态栏显示 LF/CRLF，点击转换支持撤销。
- 加载内容直接同步 Monaco model，避免异步加载沿用空 Windows model 的 CRLF。已有行尾保留；无行尾的 Shell 脚本及已确认 POSIX 远端默认 LF，不探测远端。

## 验证

- Rust 尺寸回归覆盖 175% DPI、普通屏幕、保存的大窗口与独立窗口。
- 真实 Monaco 预览覆盖延迟加载、LF/CRLF 转换、撤销、回车、粘贴、保存和空白字符开关。
- 类型、静态、格式、renderer、Rust/contract、Clippy 与 CSS contract 门禁。
- Windows/Linux 原生高 DPI 仍需平台实测；浏览器预览不替代原生验证。

## 进度

- [x] 窗口与编辑器实现。
- [x] 回归与项目门禁。

## 验证结果

- workspace 类型、Lint、Prettier、114 项 renderer 测试通过。
- Rust 772 项单元、10 项 CLI 和 23 项 contract 测试通过；全目标、全 feature Clippy 无警告。
- 真实 Monaco 的 Windows UA 浏览器回归通过：先建立空 CRLF model 再延迟加载 LF、转换后保存及撤销、CRLF 粘贴与回车统一到 LF、空白字符偏好重载、Shell/已知 POSIX/未知与 Windows 远端的默认值。
- 深浅色 1073×546、800×500 视口检查通过；浏览器改变尺寸时存在 ResizeObserver 通知，未发生回归断言失败。
- CSS contract 通过，保留原有 11 处 `!important` 债务，未新增组件 CSS。
- Windows/Linux 原生 DPI、任务栏和多显示器需要平台实测；本次未推送、发布或关闭 Issue。

复现编辑器回归：使用本机已安装的 Playwright，运行 `node apps/tauri/tests/browser/file-editor.mjs`；可通过 `PLAYWRIGHT_MODULE_PATH` 指定依赖路径、`PLAYWRIGHT_CHANNEL=chrome` 使用已安装 Chrome。
