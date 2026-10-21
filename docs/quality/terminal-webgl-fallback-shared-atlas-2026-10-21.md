# WebGL 自动回退与共享字形错位排查

## 输入与边界

用户反馈：启用 WebGL 后刷新文件区、运行 Claude Code 会发生字体变化或字符错位，切换标签可恢复；另有 WebView2 内存约五分钟从 120MB 增到 700MB、约 1GB 时开始卡顿。
这些是现场反馈，没有同一时段的完整原始日志，不能据此确认内存泄漏或 GPU 故障。

本轮先提交日志设置与字重改动 `91eac3cd`，随后在当前目录排查渲染生命周期。
本机验证为 macOS Chrome 155.0.8059.85 / ANGLE Metal（Apple M1 Pro），不是 Windows WebView2 或真实 Claude Code 会话。

## 已复现并修复

### 内容触发的 DOM 回退

原实现扫描可见 `U+2580–U+259F` 块字符，发现后永久回退 DOM。生命周期夹具用 `▗▀▖ ▌█▐ ▝▄▘ ░▒▓█` 稳定触发 `block-glyph-compatibility`。这不是目录刷新接口直接切换渲染器；包含块字符的新输出或历史回放即可触发。

移除这条内容判断和逐帧扫描，继续使用 xterm 默认开启的 WebGL custom glyphs；只保留加载失败、激活失败和 context loss 回退。失败回退事件改为 WARN，默认关闭详情后仍可定位真实后端切换。

像素回归检查全块、上下半块、左右半块及四象限，共九种字形；100%、125%、200% 三个 Chromium 原生倍率及三档容器尺寸均符合字符格几何，隐藏/恢复后仍为 WebGL。整数倍率共享图集重绘前后像素通道差异为 0；125% 有边缘重采样差异，九格四象限占用均保持正确。文本缓冲和选区检查保留。

### 共享图集被另一终端清空后出现错画

xterm 的相同字体/颜色配置终端会共享字形图集。公开 `clearTextureAtlas()` 清空共享图集时，只失效调用者的 WebGL 缓存坐标，其他终端仍可能使用旧坐标。新字形占用旧位置后，未同步失效的终端会错画；该终端重新清理或激活后可恢复。

真实 xterm/WebGL 双终端像素夹具确认共享图集：清理另一终端并写入不同字符后，原终端九格图像有 1,316 个像素通道值改变。适配器在公开清理入口通知使用同一图集的其他终端同步失效模型并重绘，修复后改变数为 0。

已检查字体缩放、隐藏终端恢复、标签激活恢复和主/备用缓冲切换的全部 `clearTextureAtlas()` 调用，修复统一落在该入口。适配器跟随当前图集身份，字体改变后仍适用；不同图集不受影响，释放时移除终端登记并恢复原方法。没有禁用字体度量校准、建立独占图集或修改 WebGL 整数栅格。

## 内存与负载验证

新增生产生命周期夹具 `terminal-renderer-runtime-load.mjs`：DOM 与 WebGL 分别在独立 Chromium 进程中回放同一批 ANSI、CJK、emoji、块字符混合输出，随后 WebGL 持续输出五分钟并定期调整容器宽度。它不经过 Rust/PTY/ACK、React workspace 或真实远端 Claude Code。字体以本地文件加载；Chromium 启动参数设置原生 125% 倍率，页面不使用 Playwright DPR 仿真。后者在本机改变页面 DPR 却未同步物理像素观察结果，不能用来验收图集边界。

校准后的五分钟 WebGL 轮完成额外 11,006 批持续输出，62 个资源采样全程为单个 WebGL 终端，挂载元素保持 22 个，解析队列在结束时清空，主缓冲保持 6,000 行滚动历史加可见行。观察结果：

| 指标                     |     回放完成 | 持续输出结束 | 主动 GC 后 | 关闭终端并 GC 后 |
| ------------------------ | -----------: | -----------: | ---------: | ---------------: |
| JS heap                  |    18.01 MiB |    37.90 MiB |  13.61 MiB |         3.63 MiB |
| CPU 字形图集估计         |        7 MiB |       13 MiB |     13 MiB |            0 MiB |
| Chromium 进程组 RSS 求和 | 1,190.33 MiB |   946.30 MiB | 879.62 MiB |       873.44 MiB |

持续输出期间 JS heap 采样约 13.63–39.87 MiB；图集从 7 页增长到 13 页，后半段保持稳定，终端关闭后登记、队列与图集统计归零。进程组 RSS 峰值后回落，本轮没有复现单调增长至卡死。终端统计归零只证明本应用登记已释放；进程 RSS 未归零不等于仍持有终端，也不能据此确认 GPU 对象均被系统回收。

进程 RSS 求和可能重复计算共享页，不能等同 Windows 单个 WebView2 renderer 的独占内存；同步绘制计时不包含 GPU 完成时间。持续轮期间有仓库回归检查运行，内存曲线可作本轮观察，不能作稳定性能基准。短批对照另用无其他仓库门禁运行的一轮记录：

| 同批 643,560 个 UTF-16 code units，3,000 批 |      DOM |    WebGL |
| ------------------------------------------- | -------: | -------: |
| 解析完成回调与每十批一次 rAF 等待的总时间   | 14.682 s | 10.033 s |
| CDP renderer `TaskDuration` 增量            |  8.470 s |  1.758 s |

这是单次本机合成输出，包含 CPU 解析、着色和绘制提交，以及 rAF 等待；不含网络/PTY 耗时，也没有等待 GPU 完成，不能直接换算成真实 Claude Code 延迟或宣称所有字符渲染都有相同收益。

`terminal-diagnostics` 补充离屏 CPU 字形图集页数和 RGBA 大小估计，同一共享图集只计一次；单个图集最多统计 64 页，超限标记截断，私有结构缺失标记未知。估计不含 GPU 纹理副本、mipmap、驱动或其他原生内存。字段进入既有性能摘要和异常上下文，不增加高频逐批日志。

## 未验证

仍需 Windows WebView2、真实 Claude Code 长任务、文件管理刷新、输入法、跨屏 DPI 与整夜负载验收。两条复现能解释回退和一种错位机制，不能据此宣称 React #185、所有卡死或内存增长已解决。

## 回归入口

- `terminal-webgl-grid.test.mjs`：同图集同步失效、不同图集隔离、字体切换和释放恢复。
- `renderer-work-diagnostics.test.mjs`：共享图集去重、未知结构与 64 页统计上限。
- `terminal-webgl-lifecycle.mjs`：用 `FILETERM_WEBGL_DPR=1|1.25|2` 指定 Chromium 原生倍率；验证块字、共享图集、隐藏恢复、三类失败回退及 WARN 级别。
- `terminal-renderer-runtime-load.mjs`：默认同批 3,000 次回放；`FILETERM_RUNTIME_SOAK_MS=300000` 增加 WebGL 五分钟持续输出，`FILETERM_RUNTIME_OUTPUT` 指定 JSON 结果。

浏览器夹具沿用现有 `ESBUILD_MODULE_PATH`、`PLAYWRIGHT_MODULE_PATH`、`PLAYWRIGHT_EXECUTABLE_PATH` 环境配置，没有新增项目依赖。

## 门禁与现场复核

本轮 `npm run typecheck`、`npm run lint`、项目 Prettier 检查、185 项 renderer 测试、850 项 Rust 单元测试、10 项 CLI 与 23 项 contract 测试、全目标全特性 clippy 均通过。没有修改 Rust 源码、设置默认值、会话内容日志或字体度量算法；本轮修复在工作区，前序日志/字体改动已提交。

现场继续排查 React 崩溃时，React 异常本身默认保留；建议只开启“工作区”“性能与卡顿”“终端”详情，记录复现时间、`react-error`、`terminal-renderer`、异常前后的 `renderer-health` 和系统中同一 WebView2 进程的内存曲线。无需打开 SSH 协议详情，也无需记录会话正文。新图集估计仅用于区分占用来源，不能替代 native/GPU 采样。

原始 JSON 归档在本任务输出目录 `terminal-webgl-investigation/`：`fileterm-webgl-before.json`、`fileterm-webgl-native-dpr1.json`、`fileterm-webgl-native-dpr125.json`、`fileterm-webgl-native-dpr2.json`、`fileterm-webgl-load-native-scale.json`（五分钟轮）、`fileterm-webgl-load-native-quiet.json`（独立短批轮）。
