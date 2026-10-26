# 终端切换与拖拽闪烁

- 保留当前未提交的侧栏修复；同时补齐缓存主页 `+` 按钮的即时隐藏规则。
- 检查所有 xterm 激活恢复、尺寸同步、WebGL backing resize 调用，保留字体与像素校准。
- 用真实 TerminalView 浏览器夹具复现隐藏后尺寸变化、重新激活首帧仍使用旧宽度，以及垂直拖拽后的画布清空/重绘时序。
- 修复激活前适配和必要的同步重绘，保留零尺寸重试、失活保护与远程 PTY 尺寸同步。
- 验证真实 xterm、DOM/WebGL 回退、现有单测及项目门禁；浏览器验证不代替原生 WebView 实机验收。

## 实现与证据

- 激活恢复原本在普通 effect 后再等待两次 RAF；隐藏标签发生尺寸变化后，重新显示的首帧还会使用旧的 screen 宽度。真实 TerminalView 浏览器夹具先复现首帧 screen 宽于 host，再用 layout effect 立即恢复尺寸，零尺寸或未挂载仍按原来的最多 16 次 RAF 重试，失活时取消。
- 垂直改变行数会同步清空 WebGL canvas，原有 `terminal.refresh` 又延迟到下一帧。夹具在 5 次高度变化中均复现 resize 完成后、微任务检查时尚无 draw。尺寸同步改用适配器中的同步 WebGL 全行绘制，DOM 继续走原 refresh；不清空图集或更改字体/像素校准，不改变 PTY 尺寸同步规则。
- 新增小型单测确认 WebGL 直接绘制且不重建图集、DOM 仍走 refresh。浏览器脚本复用已安装的 Vite 打包，避免额外 esbuild 依赖；真实 WebGL、2 倍 DPI 下首帧适配、5 次连续高度变化、横向变化、窗口变化、持续 TUI 输出和空闲无重复 resize 均通过。
- `+` 的全局 `transition: all` 与工具按钮同样延迟继承的 visibility；将 `.add-tab` 加入仅颜色/背景/透明度的过渡规则。四主题、三平台样式回归确认缓存主页隐藏首帧中 `+`、工具按钮和图标均为 hidden，原有 120 次布局切换也通过。
- 类型、lint、全量格式、224 项 Renderer 测试、927 项 Rust/contract 测试、Clippy 和 CSS contract 全通过。CSS contract 的历史警告与修改前一致。
- 未验证原生 macOS/Windows/Linux WebView，也未将浏览器 DPI 与样式模拟视为原生通过。同步 WebGL 绘制使用既有 xterm 6 私有 renderer 路径，升级 xterm 时需复核；代码已标注 shortcut。
