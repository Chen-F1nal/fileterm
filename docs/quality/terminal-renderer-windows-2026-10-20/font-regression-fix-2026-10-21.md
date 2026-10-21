# Windows WebGL 字形回归修复（2026-10-21）

原始 JSON、日志与截图存放在项目外部归档目录；位置和文件清单见 [验证归档说明](README.md#artifacts)。

## 结论

用户在真实会话发现断笔、拖影和数字异常。此前“网格一致”检查通过不能代表字形正确，先前小数网格候选未通过视觉验收。这份修复记录形成时默认仍为 DOM；初始 PID 20948 的三个已有终端先通过 context loss 回退 DOM；随后类型门禁的版本同步重写 Tauri 配置，开发监视器自动重启到 PID 21628，原连接需要重新建立。此副作用已向用户说明，并修复版本同步对未变化内容仍落盘的问题。后续字体矩阵通过后，用户要求 Windows 默认使用 WebGL；当前状态和仍未验收的交互见 [Windows renderer 报告](README.md)。

## 原因和修复

先前 `terminal-webgl-grid.ts` 把 `device.char.width` / `device.cell.width` 改为测量值乘 DPR，例如 8.2470703125。这违反 addon-webgl 0.19.0 的整数像素约束。`TextureAtlas._findGlyphBoundingBox` 从 `padding + width - 1` 递减扫描 ImageData；小数宽度会产生无效数组索引，使字形边界和图集位置不可靠。

删除整段宽度覆盖，保留上游整数栅格与字体测量，只保留 backing buffer resize 后同步 GL viewport / glyph uniform 的修复。没有修改全局 UI 字体，没有改依赖，也没有把实验夹具的 DOM 校准用于应用。DOM/WebGL 原生列数不同是预期行为，必须分别 fit，并按实际尺寸同步 PTY；不再以跨后端完全相同列数作为通过条件。

## 验证

- 新增单元回归：125% DPI、小数字体测量不改变上游整数格；backing resize 更新 viewport 路径，释放时恢复原方法。
- 52 组 Chromium 字体、DPI（100/110/125/150/200%）、字号、字体迟加载、resize、CJK/emoji、选区、搜索和回放检查通过。新增 device cell 和已生成 glyph atlas 像素整数断言；原先小数候选会被拒绝。
- 实际 Tauri PID 21628、localhost:5188、WebView2 155、DPR 1.25、RTX 3070 Laptop / ANGLE D3D11。独立临时终端装入最新源码，未发送真实 PTY 命令。12px 系统等宽字体 WebGL 为 189×49、cell 6.4×14.4 CSS px；JetBrains Mono 14px 为 151×37、cell 8×19.2 CSS px。各状态 viewport 覆盖 backing buffer，glyph atlas 非整数项为 0，surface 不超出实际 padded host。
- 实际 WebView2 1502 行解析/选区/搜索、字体切换恢复、context loss DOM 回退、三次创建销毁通过。回退原生 DOM 的 FitAddon 舍入允许相对独立参考相差一列，避免重新引入小数栅格；缓冲内容与行数另检。
- 实际测试动态 import 带唯一查询参数，避免同一个页面的 ESM 缓存复用旧候选。新实现运行在独立临时终端；不能把旧会话当作最新源码验证。

原始结果：`terminal-native-grid-font-fix.json`、`terminal-native-grid-font-fix-125pct.png`、`tauri-webview2-native-grid-font-fix.json`、`tauri-webview2-native-grid-font-fix-render.png`、`terminal-native-grid-lifecycle.json`。网格对照保留原生后端差异；旧 `*-production-*` / `*-grid-fixed*` 文件保留为之前候选历史数据，不作为本次候选性能或视觉通过依据。此前短时进程采样可能包含用户实际操作，不作为受控成对基准。

## 用户提供的日志分析

输入为桌面 `app-log(1).md` 分析报告及其选录日志，并非完整 app.log。选录条目包括 9855ms 事件循环间隔、1821ms 输入延迟、1022ms 单批解析、4 个 pending ACK 和 React #185。它们支持主线程阻塞与更新深度超限发生在相邻时间，不能单凭时间关系证明某个 workspace 回调是根因。

`IC._deliver` / `IC.fire` 也符合 xterm 事件发射器的构建形态，不能仅凭压缩符号归为 Tauri 事件链。需要相同发布产物 sourcemap 或 dev 复现定位具体回调。当前不对未经证实的组件修改状态更新策略。堆与节点回落只能说明这些窗口内没有持续单调增长，不能排除长任务内存泄漏。

## 质量门禁

本轮完整 typecheck、165 个 renderer 测试、修改文件定向 ESLint / Prettier、生命周期测试通过。Rust 源码本轮未改，上阶段 Rust/contract 与严格 clippy 通过结果沿用。全仓 lint / 格式仍有既有 CRLF 债务，不扩散格式改动。版本同步新增未变化内容不落盘的保护，LF/CRLF 与实际变更保留换行自检通过。

## 尚待验证

修正候选尚未重新完成 DOM/WebGL 成对长负载性能比较，也未在用户真实 Claude Code 长任务、Windows 输入法和跨屏 DPI 切换中验收。保持 DOM 默认和自动回退；先验收字形再运行真实长任务。不要用旧候选的性能提升数字宣称当前版本的实测收益。

## 用户截图场景追加混排测试

在实际 WebView2 中输出 17 行混排样例，分别以 12/14/16px 验证：中文相邻英文和长数字、ASCII 标点、全角标点、箭头、线框、块字符、emoji、粗体、连续不同 ANSI 颜色。逐行缓冲文本与期望一致，中文选区为“中文夹”，字形图集非整数项为 0，无 page error。已人工检查 12px 和 16px 截图，没有复现此前断笔、拖影与数字字形破损；这只是本机本字体视觉检查。国旗 emoji 在当前 Windows 字体栈显示 CN，记录为字形支持限制，不标记为国旗图像通过。

原始记录：`tauri-webview2-mixed-text.json`。截图：`tauri-webview2-mixed-text-mixed-12px.png`、`tauri-webview2-mixed-text-mixed-14px.png`、`tauri-webview2-mixed-text-mixed-16px.png` 和 `tauri-webview2-mixed-text-mixed-dom-fallback.png`。未向真实本地或远端 PTY 发送命令，临时终端结束后销毁。
