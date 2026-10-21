# Windows：WebView2 纹理 storage 接续记录

## 结论与范围

PR #351，基线 `5485a4dd`，分支 `fix/logging-controls-terminal-font`。本机初始工作区干净，从 `feat/renderer-performance-diagnostics` 切到目标分支并 fast-forward 同步，没有覆盖未提交工作，也未创建 worktree。

已在真实 Tauri/WebView2 中复现：字体变化后 CPU 图集从 15 页变为 1 页，未使用的纹理槽仍保留历史 texture/mip 请求。修复后非活动槽恢复为完整的 1×1 占位纹理；尺寸变化替换整个纹理对象，清除旧 mip levels。这个资源生命周期问题已修复，**它是否导致用户长时间卡死、GPU/native 持续增长仍未确认**。

真实 Claude Code 两次短任务均完成，没有复现长时间冻结；不能据此宣布整夜负载或所有卡顿已解决。测试期间有游戏、构建和独立 Chromium 回归并行运行，数据用于正确性与占用来源观察，不作为隔离的性能基准。

## 开发版身份与日志

- 时间：2026-10-21 23:26–23:38 SGT。进程采样覆盖 23:26:49–23:38:31，共 123 个时点；主进程存活时有 122 组完整样本。
- 启动：从 `D:\CodeFiles\fileterm` 执行 `npm run dev`，cargo 工作目录为 `apps/tauri/src-tauri`；启动日志确认加载 `tauri.dev.conf.json`。使用当前源码构建的 `D:\CodeFiles\fileterm\apps\tauri\src-tauri\target\debug\fileterm.exe`，PID 20464，创建时间 `2026-10-21T15:26:05.0458770Z`。
- Vite：当前 checkout 的 `node_modules/vite/bin/vite.js`，PID 24776，监听 `::1:5188`；实际页面 `http://localhost:5188/`，`window.fileterm.platform=win32`。界面和原生日志版本均为 `2.3.1-beta.11`。WebView2 CDP 仅监听 `127.0.0.1:9223`。
- Windows 11，WebView2 `155.0.4283.62`；RTX 3070 Laptop，驱动 `32.0.16.1742`（2026-09-30），实际 ANGLE NVIDIA D3D11，硬件加速开启；DPR 1.25。另有 GameViewer virtual display driver `15.6.5.199`，不把它当作实际 GL renderer。
- 开启 workspace、performance、terminal 详情，其他详情关闭；会话正文日志未开启。原生 sampler 独立于 renderer 心跳，记录同一 PID 和创建时间的 private bytes、working set；不以进程组 RSS 替代。
- 使用 Computer Use 返回的精确 exe 窗口核对到 Vite 页面；窗口被游戏遮挡时截图捕获到了游戏，故不将该截图作为终端证据。随后使用已绑定的 WebView2 CDP 截图和缓冲读取，没有启动其他 FileTerm 安装版或抢占游戏前台。

本地归档：`D:\CodeFiles\renderer-validation-archive\windows-2026-10-21-pr351\`，原始日志与截图不上传仓库。包含复现前 `baseline-app.log*`、`before-fix-app.log*`、`after-fix-app.log*`、定期复制的 `captured-app.log*`，每组均保留 `app.log` 与 `app.log.1`。`process-identity.json`、`app-process.json`、`os.json`、`video-drivers.json` 保留环境；`native-processes.jsonl`、`gpu-process-memory.jsonl`、renderer JSON 及 `summary.json` 保留时间关联。`summarize.cjs` 保留汇总方法。

## 修复前证据与修复

在真实 WebView2 的隔离 iframe 内加载生产 terminal lifecycle，临时内存终端输出 3,000 批 RGB/CJK/emoji/块字，再改变字号并写入固定 ASCII。iframe 内安装既有测试专用纹理追踪，不改主页面或 Claude 终端的 GL API。对照使用相同生成器；候选修复轮开始时多写入一批后重跑完整序列，故不将两轮耗时或 glyph 数作为等量性能对照。

| API 请求统计                     | 修复前字号变化前 | 修复前变化后 | 修复后变化前 | 修复后变化后 |
| -------------------------------- | ---------------: | -----------: | -----------: | -----------: |
| CPU 图集页数                     |               15 |            1 |           15 |            1 |
| 已请求且未删除的 RGBA level 字节 |       47,535,432 |   47,535,432 |   46,137,328 |    1,398,160 |

修复前非活动槽 9 仍有 22,369,620 字节请求，其他非活动槽约 1.3–5.3 MiB；部分槽的 mip level 数超过当前 512×512 页面所需数量。修复后 15 个非活动槽各为 4 字节、1 个 level，活动 512×512 页为 1,398,100 字节。两轮临时 runtime 销毁后跟踪纹理数/字节均归零，未知格式为零。

这些是逐 level **API 请求大小**，不是真实显存或驱动释放时刻；不将 46 MiB 请求减少等同于 native private bytes 或独占显存同量下降。

`terminal-webgl-textures.ts` 在 glyph renderer 绘制前处理每个槽：首次接管或目标尺寸变化时创建替代纹理、删除旧对象并失效上传版本；未使用槽填入上游同样的 1×1 红色占位。稳定帧不创建/删除纹理。分配失败保留旧对象并允许后续重试；释放时恢复方法。上游 dispose 闭包读取同一个可变 slot 的当前 texture，因此仍释放替代对象，不引入第二套纹理所有权。接入 grid 适配器，初始化失败也恢复 hook。

没有改变字体度量、原始颜色、滚动缓冲、PTY/ACK 或自动重载策略。仍依赖 addon-webgl 0.19 私有结构，升级时需复核。另修正 Windows scheduler fixture 的 `track` 参数签名，与两个现有原生窗口调用者一致，生产追踪行为不变。

原始数据：`headless-textures-before.json`、`webview2-textures-before.json`、`webview2-textures-after.json`、`webview2-dispose-{before,after}.json`。

## 真实 Claude Code 与 native 关联

独立本地 ConPTY 直接运行已安装的 Claude Code `2.1.306`，当前配置模型为 `deepseek-flash`。请求生成包含中文/emoji/框线的终端图集说明，禁止工具和文件访问；不是 SSH 远端工程任务。修复前 80 段约 85 秒完成，修复后 120 段约 124 秒完成。两轮均真实经过 Rust PTY、IPC、xterm 解析和 ACK；输入经应用 bridge 和终端 Enter 处理链，不代表物理键盘或 IME 延迟验收。

修复前 renderer 连续 63 个五秒样本，修复后 49 个样本。Claude 的图集为 1 MiB，采样解析队列为零；修复后最后 smoke 临时增加第二个终端，合计短时 2 MiB。修复后终端函数检查确认已经接入纹理适配器。主页面 CDP GC 后 heap：修复前约 26.69 MiB、修复后约 25.09 MiB；两轮负载不同且期间有 iframe/原生 smoke，不能作为等量 heap 改善结论。

| 进程角色 / PID | 创建时间（UTC，均为 15:26:05） | private MiB：首 / 峰 / 末 | working set MiB：首 / 峰 / 末 |
| -------------- | ------------------------------ | ------------------------- | ----------------------------- |
| FileTerm 20464 | .0458770                       | 10.70 / 15.04 / 12.61     | 62.93 / 68.63 / 66.11         |
| browser 36692  | .3304950                       | 39.64 / 44.38 / 41.30     | 见原始逐进程样本              |
| GPU 1344       | .6474660                       | 131.09 / 347.39 / 142.09  | 85.81 / 132.17 / 109.71       |
| renderer 27488 | .7981380                       | 170.38 / 502.37 / 200.14  | 203.13 / 534.73 / 247.32      |

这张表跨越修复前后、合成 iframe、真实 Claude 和销毁过程；峰值与回落不能直接归因于修复。末值是停止本轮开发进程前的活进程样本。WebView2 browser、renderer、GPU 分开记账，同 PID 的创建时间一致，没有把 Claude 自身内存归到 WebView2。

末段 WDDM `GPU Process Memory` 的 GPU PID 1344 实例记录 DedicatedUsage 74,473,472–182,603,776 字节，末值 76,984,320；SharedUsage/TotalCommitted 另存原始记录。它是该实例的 Windows 计数器，不是 GL 对象逐个分配/释放的证明，也没有修复前等时段对照，故不据此宣称显存问题已解决。

去重后的匹配时段日志有 12 条 windows-native-health、11 条 renderer-health。健康快照中的 parseFailures/ackFailures 和 pendingBatches/pendingAcknowledgements 均为零，最大累计 ACK 耗时 73ms；最大长帧 187ms、最大事件循环间隔 1,077ms，未复现长期无响应。健康快照是分钟粒度，不能排除采样间短暂积压。context loss / DOM 回退来自明确的临时 smoke 终端，不作为 Claude 终端失败。

原有活动会话初始为空；两轮只关闭自己的临时标签。构建共享包曾触发 Vite 页面重载，修复后连续采样从最后一次重载之后开始；它不是用重载修复卡顿。完成后关闭自己启动的开发进程以释放 Rust 门禁 exe 锁。真实 PTY 关闭响应后的即时资源快照仍短暂有 1 个 React 终端、tabs 已空，随后进程退出；不能把该即时快照写成真实 PTY 资源已归零。临时内存终端的同步 dispose 则有独立归零断言。

## 回归与门禁

- 定向 8 项、全 renderer 189 项通过。新增合并/字体替换/非活动槽复用、稳定帧无分配、分配失败重试、原有 dispose 所有权回归。
- `FILETERM_RUNTIME_GPU_PROBE=1` 的生产生命周期夹具新增逐槽断言：字节数和 mip 层数必须精确匹配当前页，非活动槽只有 1×1。Windows NVIDIA D3D11 3,000 批 RGB 后再持续 60 秒通过，图集稳定 33 MiB，GC 后 heap 9,477,488 字节，字号切换后纹理请求 1,398,160 字节，销毁归零。
- 52 组生产字体网格、125% 生命周期（共享图集/块字/隐藏恢复/三类失败回退/释放）通过；真实 WebView2 的 1,500 行混排、字体/resize/context-loss 和三轮释放 smoke 通过。真实 IME、物理选区与输入延迟未验收。
- 根 `npm run typecheck` 通过；本次 TS/JS 文件定向 ESLint/Prettier 通过，`git diff --check` 通过。
- 根 lint 报 78,089 个现有 CRLF 格式错误，根 Prettier 报 486 个文件；`core.autocrlf=true`，未对全仓执行格式重写。
- `npm run test:tauri` 初次受开发 exe 文件锁阻塞；本轮任务完成后关闭自启进程重跑通过：806 单测、10 CLI、23 contract、3 scheduler，1 项子进程辅助测试按原设计 ignored。
- 严格全目标全特性 Clippy：加入本机已有 NASM 路径后发现 scheduler fixture 签名错误；修正后原命令通过。未安装新依赖或改系统 PATH。

待确认：真实远程 Claude Code 长任务、数小时/整夜 native/GPU 趋势、字体频繁变化和图集合并下的驱动实际释放延迟、文件区刷新与后台标签组合压力，以及所有历史卡死/React #185 的完整根因。PR 保持草稿，不关闭相关 Issue。
