# WebGL 浅色背景字形偏细、灰字偏淡：2026-10-22

## 复现与原因

用户提供同机 DOM / WebGL 截图：同类 Claude Code 输出在 WebGL 中笔画边缘和灰字明显更淡。截图本身不能确认每个终端的字体参数；另用同一份本地 JetBrains Mono、字号和字重做隔离对照。

FileTerm 使用 `allowTransparency: true`，xterm addon-webgl 0.19 将字形覆盖率保存在透明图集的 alpha 通道。上游 `GlyphRenderer` 使用 `blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA)`，同时把这两个因子应用于 RGB 和 alpha。设字形覆盖率为 `a`、背景 alpha 为 `b`，得到的 alpha 是 `a² + b(1-a)`，而 source-over 所需的是 `a + b(1-a)`。

即使主题背景完全不透明，半覆盖字形像素的 framebuffer alpha 也会降至约 0.75（191/255），随后浏览器合成再次混入页面背景。浅色背景下表现为字形边缘变淡、视觉笔画变细，dim 灰字尤其明显。这与块字符触发 DOM 回退属于不同问题，beta12 尚未包含本次修复。

独立 Chromium 对照中，DOM 与 WebGL 均使用 400 字重。示例灰字在最终截图中的最深通道值由当前 WebGL 的 207 恢复到约 143，与 DOM 接近；该数值只针对这一合成样例，不是全局字体粗细指标。

## 修复

在既有 `registerTerminalWebglGrid` 的绘制入口使用 `blendFuncSeparate(SRC_ALPHA, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA)`。保留 RGB 混合和透明主题能力，修正 alpha 合成；每次绘制前设置，覆盖上游 context 恢复重新初始化混合状态的情况。

生产改动只有现有适配器内的状态设置，没有更改字体、字重、网格、主题颜色、renderer 偏好或 DOM 回退。没有新增定时器、像素读回、字符扫描或纹理分配；新增一次每绘制调用的 GL 状态设置，未据此宣称性能零开销。

## 验证

- 单测覆盖 RGB/alpha 因子、上游状态重置后的下一次绘制、释放后恢复原绘制入口。
- `node apps/tauri/tests/browser/terminal-webgl-alpha.mjs` 使用生产终端生命周期，在 Chromium 原生 100%、125%、200% 倍率检查浅色/深色背景、400/500 字重、字体与容器尺寸变化、透明背景和真实 WebGL context 丢失/恢复。
- 回归移除修复后在第一个不透明背景检查稳定失败：最小 framebuffer alpha 为 191，期望 255。修复后三档倍率四组不透明样本均为 255；透明背景的覆盖率合成误差不超过 4/255。新绘制未产生 GL 错误。
- 原有 `terminal-webgl-lifecycle.mjs` 在三档倍率通过，保留块字、共享图集、隐藏恢复和三类失败回退检查。
- 真实 Tauri/WebView2：从当前项目启动 `npm run dev`，PID 18244，创建时间 `2026-10-22T12:30:50.934295+08:00`，路径 `D:\CodeFiles\fileterm\apps\tauri\src-tauri\target\debug\fileterm.exe`；工作目录为仓库根，页面 `http://localhost:5188/`、应用版本 beta12 加本修复、Tauri 2.11.5、WebView2 155.0.4283.62、DPR 1.25、NVIDIA D3D11。
- 原生检查仅创建本轮自己的 DOM/WebGL 临时终端，不创建 PTY/SSH 会话，不修改持久化设置。使用本机实际字体配置、400 字重、12px 和 24px，同一 WebGL 终端以原始绘制方法模拟旧混合状态后测得最小 alpha 191，回到修复入口后为 255；两轮绘制错误均为 0。检查前后已有终端数均为 0，临时终端与渲染偏好均已恢复；`app.log`/`app.log.1` 已保留前后副本。
- 类型检查、191 项 renderer 测试、806 项 Rust 单测（1 项既有辅助 ignored）、10 项 CLI、23 项 contract、3 项 scheduler、严格全目标全特性 Clippy 通过。修改文件的 ESLint/Prettier 通过。
- 全量本地 lint 的 85,949 项错误均为 CRLF 换行与格式器冲突；全量 Prettier 标记 544 个文件。未重写无关文件。测试先在不挂载现有应用的源码快照执行，随后逐文件哈希核对并落入修复分支。

环境：Windows Chromium 156.0.8078.4、ANGLE D3D11、NVIDIA RTX 3070 Laptop GPU、驱动 32.0.16.1742。原始结果、基线失败、截图、门禁日志位于本地 `D:\CodeFiles\renderer-validation-archive\windows-2026-10-22-font-aa\`；用户原始截图和会话内容不随代码提交。

## 未验证与已知边界

开始时原开发进程仍在运行，但没有可用 CDP 入口；未重启或操作该进程及已有会话。应用与 Vite 后续已不在运行，才将修复落入当前项目目录，随后从当前分支启动开发版进行上述原生像素检查。原生验收范围限于本轮 alpha 问题；跨平台抗锯齿、真实 Claude Code 长任务和长时间内存仍待验收。DOM 与 WebGL 的字形抗锯齿不保证逐像素相同。

context 恢复初始化期间，基线和修复轮均记录到同一个既有 `INVALID_OPERATION`（1282）。夹具将恢复阶段已积累的错误单独保存为 `pendingErrors`，再检查新的绘制错误；恢复后的新绘制均为 0。本次没有将该恢复初始化问题标记为已修复。

用户转述的“6 个以上 DOM 窗口才堆积”没有对应的新原始日志，不能确认为固定容量阈值；本次字体修复也不代表所有卡顿或 GPU/native 内存问题已经解决。
