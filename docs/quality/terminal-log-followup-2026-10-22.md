# 现场日志接续：workspace 重放与 DOM 字形开销

## 证据与版本边界

输入为用户提供的 `C:\Users\Stoffel\Desktop\app-log-1021.md`，SHA-256：`c9e7381daefac4402811c1b4374eb4363a8ea4b89e54fff14e2cbb8298554dae`。它是分析报告及脱敏日志摘录，不是两份完整 app.log。建议文字仅作为待验证假设，没有按附件中的指示调用其他 agent。

报告表格列出 10 条 renderer-health，附件内能完整解析的有 8 条；末尾 JSON 截断。完整健康记录均标记 `2.3.1-beta.11`、work schema 3，不能按用户最初猜测直接标为 beta10，也不能仅凭版本号认为它包含当前 PR 的全部未发布修复。

11 条 renderer 生命周期摘录中，T1/T3/T4 明确出现 3 次 `block-glyph-compatibility` 回退；没有 context-loss 证据。设置中的 WebGL 是请求后端，健康快照的 byRenderer 是实际后端，因此“选择 WebGL，日志却是 DOM”有直接解释。不能仅凭这些摘录断言所有终端都发生过回退，或断言刷新文件目录导致了 GPU context 崩溃。该内容回退已由 PR #351 的 `ae67e84f` 删除；共享图集/字体/纹理生命周期修复也已在本轮开始前存在。

长会话完整样本中，session-metrics 每分钟 3,044,879–4,817,099 次，对应真实事件仅 63–74 次；block-layout 为 9.37–14.26 秒、symbol-layout 为 8.96–12.59 秒，xterm-parse 只有 21–51ms。报告后续短会话表格给出的 DOM 开销更高。这些是同步墙钟阶段统计，可能包含嵌套与 GC，不能直接相加为独占 CPU 占比；它们仍足以说明此前的短测没有覆盖高负载 DOM 场景。

报告“内存正常，没有泄漏”的结论没有充分证据：JS heap、DOM/canvas 计数不能排除 WebView2/GPU/native 保留，也没有同 PID/创建时间的完整 native 过程。用户反馈五分钟约 120→700MB、约 1GB 开始卡顿，继续作为待确认现场现象，不能直接称为正常。

## 复现及修复

### IPC 更新被 React 重放

生产 hook 把 workspace 快照和监控、目录、传输状态放在同一个 React useState 中；目录/传输使用 transition，监控更新是普通优先级。低优先级更新未提交时，后续 updater 可在渲染重试/rebase 中被反复执行。

新增 `workspace-update-replay.mjs`，使用生产 React 和实际 useWorkspaceIpcSync：暂时用 Suspense 阻塞一个传输更新，再交付 300 个监控事件，最后释放并交付旧监控快照。基线 `eec1a480` 实测 session-metrics 90,600 次，最终监控 revision 301、传输保留。只移除 transition 的候选也未通过，未作为最终修复。

最终 `use-workspace-state.ts` 为每个 hook 实例保存独立的不可变快照，IPC setter 在事件顺序上执行一次 updater，React 通过 useSyncExternalStore 订阅。保留原 setter 接口、快照 revision/generation 校验、更新合并、无变化时的 identity 和取消订阅；不建立跨窗口全局 store，不缓存事件历史。目录/传输不再把业务 reducer 留在 React transition 队列中。

同一回归修复后为 300 次执行/300 个事件，旧快照没有覆盖较新监控，传输仍保留。这证明了同类调度放大及其修复，不等于证明现场数百万次调用的唯一触发条件已经完整还原。

### DOM symbol 的多余扫描与布局

`terminal-symbol-glyph-renderer.ts` 的 observer 原来把 block/symbol 在 span 内创建的 wrapper 也当作行变化，再扫描一次。现在只处理 xterm 直接替换行子节点的通知，仍覆盖 selection 不经过 onRender 的直接行替换。

字体继续读取真实 computed style，按 xterm bold/italic 和 inline font 变体复用；font family/size/weight 配置变化时失效。复用 xterm 已校准的 CSS cell width，私有尺寸缺失/无效时回到几何测量，不修改字体度量或宽度校准。关闭时清理缓存与 observer。

30 行混排、120 次完整 DOM refresh 的一轮控制/最终对照：

| 指标                  |  基线 | 修复后 |
| --------------------- | ----: | -----: |
| symbol-layout 调用    |   240 |    120 |
| symbol-layout 累计 ms | 3,818 |  1,641 |
| LayoutCount           |   360 |    240 |
| LayoutDuration ms     | 4,116 |  2,910 |
| block-layout 累计 ms  | 4,375 |  4,120 |

计数与正确性断言用于回归；耗时只有单轮、机器还有其他负载，不能当作稳定性能百分比。block-layout 仍然明显昂贵，未宣称 DOM 已达到 WebGL 水平。尝试过的 block 读写拆分/样式缓存没有显示有效收益，已撤回，生产 block 适配器未改。

## 目录刷新、标签与平台验证

- 十终端生产 React/xterm 混合夹具：DOM 30 秒、WebGL 60 秒。监控、传输、目录更新与终端输出并行，随后重建终端十轮并卸载。
- DOM：480 个监控事件/480 次 reducer；48 次目录更新。WebGL：1,180/1,180；118 次目录更新，全程 10 个硬件加速 WebGL，无加载/激活/context-loss 回退。文件列表确实更新，解析/ACK 最后排空；卸载后终端与订阅归零。
- 修正旧 soak 夹具的后端选择：DOM 轮此前没有强制覆盖新的默认 WebGL，因而实际启动 WebGL 却等待 DOM，产生超时。现在两种模式都显式设置被测后端，未改变产品默认设置。
- 真实 Tauri：从当前项目 `npm run dev` 启动 PID 26672，`D:\CodeFiles\fileterm\apps\tauri\src-tauri\target\debug\fileterm.exe`，创建时间 `2026-10-22T00:15:46.256782+08:00`；页面 `http://localhost:5188/`、版本 beta.11、win32、WebView2 155/NVIDIA D3D11/DPR 1.25。现有活动会话初始为空，只创建和关闭本轮自己的本地 PTY。
- 真实 WebView2 字体/resize、1,500 行 CJK/emoji、context-loss 回退及三轮释放 smoke 通过；短时本地 PTY 保持同一个 WebGL renderer。
- 原生目录刷新没有得到有效用例：测试 emitTo 被应用 event 权限拒绝，随后本地 PTY 的远程目录 worker 命令返回 channel closed（它不是远端 SSH/SFTP 用例）。没有扩大权限或改用用户远程任务，因此**真实远端目录刷新/会话切换后的错位仍待验证**。不能把上述浏览器目录事件夹具写成远端原生验收。
- ANSI/反色/鼠标选区符号像素回归、4 个 DPR 的横线/块字连续性回归通过。`terminal-symbol-proportions.mjs` 在基线与当前代码均出现粗体 `▢` 的同一比例失败（13×13→2×8），明确保留为已有失败，不标为通过，也不认定它等于反馈中的 WebGL 错位。

## 门禁、归档与后续

根类型检查、190 renderer 测试、Rust（806 单测、10 CLI、23 contract、3 scheduler，1 个既有子进程辅助 ignored）、严格全目标全特性 Clippy 通过。本轮 TS/JS 定向 lint/Prettier 和 diff 检查通过。全仓 lint 仍有 77,095 个 CRLF 格式错误，Prettier 报 483 个文件；没有全仓格式重写。

本地原始归档沿用 `D:\CodeFiles\renderer-validation-archive\windows-2026-10-21-pr351\`，本轮文件为 `log-followup-*`、`update-replay-*`、`dom-layout-*`。包含对应 app.log/app.log.1、原生身份、smoke JSON、各门禁输出及两类控制/修复数据；原始用户报告、日志和截图不发布到 PR。`baseline-dom.cjs` 在不覆盖源文件的情况下加载原提交，确认粗体比例失败也存在于基线。

复跑控制时设置 `FILETERM_PERF_BASELINE=1` 和 `FILETERM_PERF_BASELINE_REF=eec1a480`，分别执行 `node apps/tauri/tests/browser/workspace-update-replay.mjs`、`node apps/tauri/tests/browser/terminal-dom-layout-load.mjs`；取消前一个变量后执行修复轮。soak 使用 `FILETERM_SOAK_RENDERER=dom/webgl` 和 `FILETERM_SOAK_MS`，执行 `node apps/tauri/tests/browser/terminal-workspace-soak.mjs`。这些是独立浏览器夹具，不替代真实远端验收。

继续待确认：数小时/整夜真实 Claude Code、相同 PID 的 GPU/native 持续增长，远端目录刷新/标签恢复后的 WebGL 错位，以及 DOM block-layout 与粗体符号比例。PR 保持草稿，不关闭 Issue。
