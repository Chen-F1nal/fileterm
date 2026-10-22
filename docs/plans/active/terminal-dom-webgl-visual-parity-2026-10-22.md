# DOM / WebGL 视觉一致性

## 验收目标

以原 DOM 为视觉基准，同机、同字体、同字号、同字重、同主题、同 DPI、同输出和同容器尺寸下，对齐文字笔画、颜色、抗锯齿、横线/块字、字符位置、换行、光标和选区。性能改善不能代替视觉验收。

PR #352 保持草稿。未完成视觉对照前，不推送新候选、不标记 ready、不合并或发布；先保留本机候选和差异证据供用户检查。

## 当前事实

- alpha 混合修正消除了不透明背景被额外合成的问题，尚未完成与 DOM 的视觉一致性。
- 上次开发启动继承工具环境 `NO_COLOR=1`，造成 Claude 单色输出的嫌疑；后续仅清理本次启动环境，原生临时 PTY 确认 `NO_COLOR` 未设置、TERM/COLORTERM 正常，新用户截图颜色已恢复。没有更改用户全局环境或让产品忽略 NO_COLOR。
- 新增 ANSI 16 色和 RGB 色卡像素检查，在 Chromium 原生 100%/125%/200% 倍率通过，仍需真实彩色 Claude 输出对照。
- 用户最新 DOM/WebGL 同机截图仍有笔画和线条粗细差异，不能标记修复完成。

## 后续步骤

### 已留存的同机对照

生产生命周期和完整应用 CSS 的隔离夹具已采集 96 组样例：Consolas / JetBrains Mono，12 / 14 / 16px，100% / 125% / 150% / 200% 原生 Chromium 倍率，DOM / 当前透明图集 WebGL / 不透明图集实验 / 网格实验。合成内容固定，页面原点和容器相同；这些是浏览器诊断，不计作原生 WebView2 验收。

在 125% 下测得的 CSS 单格宽度：

| 字体与字号          |      DOM | 当前 WebGL |
| ------------------- | -------: | ---------: |
| Consolas 12px       | 6.597015 |        6.4 |
| Consolas 14px       | 7.695652 |        7.2 |
| Consolas 16px       |      8.8 |        8.0 |
| JetBrains Mono 12px | 7.203252 |        6.4 |
| JetBrains Mono 14px |      8.4 |        8.0 |
| JetBrains Mono 16px | 9.597826 |        8.8 |

原因已对应到依赖源码：DOM 保留测量所得的小数字符宽度，WebGL `_updateDimensions` 对设备字符宽度使用 `Math.floor`。DOM 的横线/块字另外由应用适配器绘制；WebGL 使用上游 `CustomGlyphs`，两者线宽和取整规则不同。当前透明图集也不能保留 Windows 不透明文字的彩色子像素边缘。

同一 Consolas 12px / 125% 样例中，DOM 横线是相邻两行 `RGB(32,32,32)` 实色像素；当前 WebGL 是一行实色加上下两行 `RGB(228,228,228)` 抗锯齿像素。透明/不透明图集实验得到相同的 WebGL 线型，说明换图集 alpha 不能同时解决线条粗细。

不透明图集实验恢复了子像素边缘，但没有解决网格和图形几何。第二个实验把显示网格与整数图集尺寸分离，CSS 单格统计可与 DOM 相等，却在逐像素对照中仍有字形差异和块字接缝；增加像素吸附/nearest 采样后仍未通过。该阶段的网格实验未落入生产代码；后续候选见下节，网格统计相等不构成视觉通过。

原始记录：本地归档 `parity/parity.json`、`parity/probe.cjs`、各模式 PNG；早期不透明候选的独立 alpha/颜色检查位于 `opaque-candidate/`。

### 本地修补与原生复核

- 不透明图集切换已落到本地工作区，尚未推送：每次绘制读取真实背景 alpha，仅在透明性发生变化时更换图集并失效全部行；半透明主题绘制前清空缓冲，避免同一帧多次合成背景；释放适配器时恢复原选项。没有更改字重或主题颜色。
- 四档 Chromium 原生 DPI 回归通过，检查不透明图集和 Canvas 的 alpha 模式、Windows 彩色子像素边缘、透明主题反复绘制、ANSI/RGB 色卡及 context 恢复。8 项适配器单测、192 项 renderer 测试和类型检查通过。
- 原生开发进程 PID 46856，创建于 `2026-10-22T13:11:05.946766+08:00`，路径为当前项目 `apps/tauri/src-tauri/target/debug/fileterm.exe`，工作目录为仓库根、Vite 5188、应用 beta12 加本地补丁、Tauri 2.11.5、WebView2 155.0.4283.62、DPR 1.25、NVIDIA RTX 3070 Laptop / D3D11 / 驱动 32.0.16.1742。CDP 确认 DOM 实际使用的字体是 Consolas。
- 12 / 14 / 16 / 24px 同机 DOM/WebGL 对照均保留原生子像素边缘，framebuffer alpha 为 255，新绘制 GL 错误为 0；字符宽度和横线仍未一致，不判定视觉验收通过。原始信息及截图位于 `opaque-native/native.json` 和 `opaque-native/opaque-native-*.png`。
- 在已信任的当前仓库启动真实 Claude Code 2.1.308，未发送模型请求；启动输出包含 80 个 SGR 序列、41 个真彩色序列，截图保留橙色图标、黄色提示与文字。日志确认该临时终端实际是 WebGL。此前在用户目录遇到信任提示的尝试未批准提示，未作为启动成功证据。
- 原生 PTY 必须通过 UI 的本地标签关闭流程同步清理前后端；单独调用 bridge `closeTab` 只返回 snapshot，不能把未应用 snapshot 的前端残留误判为产品泄漏。本轮最终标签、会话、终端数均为 0，日志选项恢复；备份 `app.log` / `app.log.1` 后，仅停止本轮 PID/创建时间匹配的无会话开发进程。
- 后续隔离实验复用 DOM 线框几何和按列取整的图形尺寸，测试横线/块字接缝改善，但文本基线、CSS 字距布局与边缘像素仍有差异。该阶段的相位变体和共享图形实现仍未集成；后续候选已复用共享图形，未采用文字相位缓存，不能以这些实验宣布修复完成。

本轮原始记录为 `opaque-local/`、`opaque-native/` 及 `parity/*-probe.cjs`。Claude 仅启动/空闲界面，不是长请求、输入延迟或 GPU/native 内存长期通过记录。

### 当前本地候选：显示网格、线框与 ASCII 基线

- 保留 xterm 图集扫描使用的整数 cell/char 尺寸，仅将显示投影、矩形层和链接层切换到 DOM 的 CSS 网格。实际 Canvas backing 使用浏览器取整后的尺寸；光标与选区跟随投影尺寸。未改变 PTY 数据、滚动缓冲或 renderer 偏好。
- 把 DOM 原有块字/线框几何抽到共享模块，WebGL 在原图集中调用相同绘制函数。图形按列/行边界吸附，floor/ceil 尺寸各自缓存；最多四种宽高组合，继续受已有图集预算与清理管理。未引入文字相位缓存或 DOM 回退。
- 整行块字回归先在 Consolas 14px / 100% 下检测到四个接缝像素；补齐顶点位置吸附后，连续 40 格实心块在四档 DPI、两款字体和四种字号下均无接缝。
- ASCII 基线按 DOM 行盒及 Canvas 字体基线校准，包含正常/粗体/斜体/粗斜体；只在字体、字号、DPI、行高或字体加载变化时重新测量。稳定帧不创建测量 DOM/Canvas。非 ASCII 暂保留上游位置，不能称混合脚本已通过。
- WebGL context 恢复替换 GlyphRenderer 后，重新绑定纹理槽回收和字形钩子；解绑旧钩子再安装新钩子，避免旧 renderer 保留包装。初始化失败释放字体监听和纹理适配器。
- 浏览器矩阵：100% / 125% / 150% / 200%，Consolas / JetBrains Mono，12 / 14 / 16 / 24px；同尺寸 CSS 网格相等、横线厚度/颜色、连续块字、128 组 ASCII 正常/粗斜基线、alpha、颜色、透明主题和 context 恢复通过。生命周期四档检查共享图集、隐藏恢复、resize、块字与失败回退通过。浏览器结果不是原生验收替代。
- 原生开发版 PID **48172**，创建时间 `2026-10-22T17:14:28.664304+08:00`；从根目录运行 npm dev，实际 exe cwd 为 `D:\CodeFiles\fileterm\apps\tauri\src-tauri`，路径为该目录 `target/debug/fileterm.exe`。页面 Vite 5188、beta12 加本地修改、Tauri 2.11.5、WebView2 155.0.4283.62、DPR 1.25、Consolas、NVIDIA RTX 3070 Laptop / D3D11，驱动沿用本机 32.0.16.1742。
- 原生 12 / 14 / 16 / 24px 下两 renderer 单格宽高相等，framebuffer alpha 255，彩色子像素边缘保留，新绘制 GL error 0；保留并排截图及差异图。16px 样例在固定 640×260 像素区域有 7,506 个像素的任一通道差超过 8/255，仍不是逐像素相等，不能因肉眼接近而标记通过。
- 该原生轮为合成文本，未重新运行 Claude 长任务。开启工作区/性能/终端详情后采样，已保存 `app.log` / `app.log.1` 前后副本、CDP heap 和按 PID/创建时间区分的 private bytes/working set 单点；单点不证明长期稳定或真实显存释放。
- 原生检查前后终端为零，最终 tabs/sessions/terminals 均为零；恢复诊断设置后，仅停止本轮 PID/路径/创建时间匹配的开发进程，未操作用户远程任务。
- 本轮完整 typecheck、197 项 renderer、806 项 Rust（1 项 ignored）、10 CLI、23 contract、3 scheduler、严格 Clippy 通过。全量 lint 76,738 项为既有 CRLF 格式冲突；全量 Prettier 482 文件未通过，未重写无关文件。改动文件单独检查通过。

证据：`display-grid-seams/`（矩阵与门禁）、`display-lifecycle/`（四档生命周期）、`display-native/`（原生身份、并排图、差异图、日志与采样）。PR #352 仍为草稿，本轮未推送、未发布。

### 待完成

1. 已完成上述两款字体的浏览器矩阵；继续用本机实际字体栈扩充，并保留原始截图和配准后的差异统计。尚无通过视觉一致性验收的候选。
2. 不透明/透明图集切换已通过本轮检查；仍不得统一加粗、描边、改色或靠切回 DOM 掩盖剩余差异。
3. 逐项区分文字栅格化、像素网格和线框几何差异。图集 ImageData 尺寸保持整数，避免重新引入既有断笔/错位。
4. 候选通过彩色、粗体、dim、反色、选区、CJK/emoji、字体/DPI/容器变化及 context 恢复回归后，再在明确识别的原生开发版检查；保护现有会话。
5. 用户确认本机视觉后再推进 PR；长 Claude Code、输入延迟和 native/GPU 内存按既有长期计划继续验收。

原始数据沿用本地 `D:\CodeFiles\renderer-validation-archive\windows-2026-10-22-font-aa\`，不发布用户截图或会话正文。
