# Claude Code 长时卡顿：WebGL 缓存增长复核

## 提交与结论边界

按用户要求先提交上一轮修复：`ae67e84f`（保留 WebGL 块字渲染、共享图集坐标失效和诊断夹具）。随后继续检查内存增长。

内存增加不必然是泄漏：滚动历史、字体栅格、浏览器和 GPU 缓存会占用内存。但不能把持续增加并伴随 UI 卡死称为正常。微软说明 WebView2 的 GPU 驱动和缓冲需要额外内存，也要求对异常增长分别检查 JS heap、事件监听和 DOM 保留；见 [WebView2 性能指南](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance)。单个工作集数值和关闭后进程 RSS 没有立即下降，都不能独立证明泄漏。

本轮已复现两条增长路径并在 renderer 修复；尚未确认它们就是用户 Windows / Claude Code 整夜卡死的全部原因。本机为 macOS Chrome 155 / Apple M1 Pro / ANGLE Metal，测试模拟平台值为 Windows，但不是真实 WebView2、SSH/PTY 或 Claude Code。

## 复现一：大量 RGB 字形变体

上一轮测试仅循环七种 ANSI 前景色，不能覆盖持续变化的 RGB 颜色。现有生产生命周期夹具增加 `FILETERM_RUNTIME_TRUECOLOR=1`，每批改变 RGB 颜色并混排 CJK、emoji 和块字。修复前记录 6,000 批；最终修复后记录同批回放并继续输出五分钟（额外 11,425 批）：

| 指标                       |    修复前 |   修复后 |
| -------------------------- | --------: | -------: |
| CPU 字形图集 RGBA 大小估计 |   127 MiB |   33 MiB |
| 主动 GC 后 JS heap         | 82.35 MiB | 9.51 MiB |

修复前图集随不同颜色变体持续增长，3,000 批时约 64 MiB，6,000 批时约 127 MiB。主缓冲保持 6,000 行加可见行，最终解析队列为零，说明本次增长不是无限滚动行数或未解析输出积压。修复后的 GC 值来自额外持续输出后的结束采样，负载时长不同；该表用于展示占用来源和回收效果，不是等时长性能基准。两个指标覆盖不同内存来源，不能直接相加为进程总占用。

`addon-webgl@0.19.0` 图集按字符和属性缓存栅格字形；动态 RGB 增加历史变体。修复在绘制前检查缓存占用，使用至少 32 MiB、并按共享图集中最大终端物理视口四份 RGBA 表面放大的预算。超过预算且有效字形像素再次填充后（同时计入排版行空隙），清理可重建缓存并重用已有页面。它是回收触发预算，允许页面取整和当前帧工作集带来的超额，不是整个进程的硬内存上限。

没有改变终端缓冲、PTY 流、原始颜色、复制内容或字体度量，也没有自动切回 DOM。保留已分配页面供复用，避免每次回收重新分配 GPU 资源；终端生命周期结束仍走原有释放路径。

## 复现二：清理图集时保留旧字形

同一段静态 ASCII 输出，重建字体图集后重复 `clearTextureAtlas()` 一百次：

| 指标            | 修复前 | 修复后 |
| --------------- | -----: | -----: |
| 初始字形对象数  |     93 |     93 |
| 第一次清理后    |    141 |     48 |
| 第 100 次清理后 |  4,893 |     48 |

本地安装的 xterm `TextureAtlas.ts` 中，`AtlasPage.clear()` 重置像素和行坐标，却没有清空 `_glyphs` 与 `_usedPixels`。此外，已合并页面不在 `_activePages` 中；只清像素不会让这些页面重新参与分配。第一个页面为空时的提前返回还可能跳过其他页面的清理。

修复复用现有 `clearTextureAtlas()` 入口，在已知私有结构上同步清理字形引用、像素使用量和两个字形查找缓存，恢复普通页面的可分配状态，并让全部共享终端的模型失效。保留超宽字形专用页面的身份；小页面优先使用。回收当帧与其他共享终端各自完整重绘，随后恢复局部绘制；避免留下持续全量重绘标记。未知结构不进行这套私有字段重置，升级 xterm 时必须复核。

## 扩展负载

最终版本的三个 Chromium 原生倍率（100%、125%、200%）均通过块字、共享图集、隐藏恢复、三类失败回退及释放回归。

React 工作区另外运行三分钟的十终端 WebGL 合成负载，包含 ACK 额度、监控更新、传输事件与输入，随后重建终端十轮并全部卸载：

| 阶段         | GC 后 JS heap | 存活终端 | 业务订阅     |
| ------------ | ------------: | -------: | ------------ |
| 持续负载结束 |     50.21 MiB |       10 | 保持既定数量 |
| 十轮重建后   |     11.25 MiB |       10 | 未累积       |
| 全部卸载后   |      8.62 MiB |        0 | 全部归零     |

没有 React #185、Maximum update depth exceeded 或其他 pageerror，ACK 最终排空，传输历史上限 200。CDP 节点计数在负载期仍有每次采样约增加一个的现象，挂载元素数量固定，卸载后节点数降到 135；保留这个观察，不用它推断已经发生泄漏或所有 DOM 保留均已解决。

最终 RGB 五分钟轮额外完成 11,425 批输出，共 62 个资源采样；全程保持 WebGL，回放完成及后续每个采样的 CPU 图集都为 33 MiB，满足后半段变化不超过 4 MiB 的断言。JS heap 采样约 9.26–36.57 MiB，主动 GC 后 9.51 MiB；关闭终端并 GC 后 3.73 MiB，终端登记、图集对象统计和解析队列归零。

Chromium 进程组 RSS 求和从回放完成的 889.83 MiB 增至持续输出结束的 983.95 MiB；中后段约 981–986 MiB，主动 GC 后 924.72 MiB、关闭终端后 918.30 MiB。组 RSS 可能重复计算共享页，且包含 browser/GPU 等进程，不能作为 Windows 单个 WebView2 进程的独占内存。它没有完全回到回放后低点，故不能只凭图集和 JS heap 稳定就宣布 GPU/native 内存增长全部解决。

本轮类型、lint、全项目 Prettier、187 项 renderer 测试、850 项 Rust 单测、10 项 CLI、23 项 contract 和全目标全特性 clippy 均通过。

浏览器负载使用本地字体文件和 Chromium 原生倍率。持续输出期间并行执行了仓库门禁，因此本轮数据用于占用趋势与正确性，不作为稳定 CPU 性能对照。GPU 完成时间、独占显存和 Windows 单进程 private bytes 没有采集。

## 代码与回归

- `terminal-webgl-atlas-cache.ts`：带结构检查的缓存清理和占用判定。
- `terminal-webgl-grid.ts`：绘制前的缓存复用、共享终端同步失效与释放。
- `terminal-diagnostics.ts`：增加 `uniqueWebglAtlasGlyphs`，同图集只计一次；私有计数不可读时为 `null`。仍沿用最多 64 页统计与截断标记，不新增周期任务。
- `terminal-webgl-grid.test.mjs`：重复清理、合并页复用、不同视口共享预算、释放恢复，以及避免对已保留的空页面逐帧清理。
- 生产生命周期夹具增加 `FILETERM_RUNTIME_CLEAR_CYCLES=100`；断言旧字形不会随清理次数累积。RGB 固定尺寸夹具断言图集不超过宽松的 96 MiB 回归阈值，并要求持续轮后半段变化不超过 4 MiB；这些数值不是产品全局限制。

## 现场后续

继续开启“工作区”“性能与卡顿”“终端”详情即可；React 异常与卡顿/积压警告默认保留，SSH 协议细节和会话正文不需要开启。核对同一时段的 `uniqueWebglAtlasGlyphs`、`uniqueWebglAtlasBytesEstimate`、实际 renderer、缓冲行数、解析/ACK 积压，以及 Windows 同一个 WebView2 进程的 private bytes / working set。

如果图集与 GC 后 heap 都稳定，但进程 private bytes 持续增长，下一步应检查 GPU/native 对象；如果 heap、监听或未解析队列持续增长，则继续沿引用和交付路径检查。真实 Windows Claude Code 长会话、交互延迟、文件区刷新和整夜负载尚未验收，不宣称 React #185 或所有卡死已解决。

原始数据归档在本任务输出目录 `terminal-webgl-cache-growth/`：`fileterm-webgl-truecolor-before.json`、`fileterm-webgl-truecolor-final.json`、`fileterm-webgl-clear-before.json`、`fileterm-webgl-clear-final.json`、三个倍率的 `fileterm-atlas-final-dpr*.json` 和 `fileterm-workspace-atlas-final.log`。前序提交为 `ae67e84f`；本轮新的缓存修复仍在工作区，尚未提交。
