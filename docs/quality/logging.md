# 本地诊断日志

## 代码入口

Rust 统一入口为 `apps/tauri/src-tauri/src/services/logging/mod.rs`。持久化管线使用 `tracing` subscriber 和自定义 layer，旧的 `logging::debug/info/warn/error/session/write_global` 等 API 作为兼容 facade，把原有调用转成 tracing event。

| 模块        | 职责                                                |
| ----------- | --------------------------------------------------- |
| mod.rs      | 稳定 facade、日志目录、subscriber 注册与旧调用适配  |
| layer.rs    | tracing 字段和 span 提取、级别转换、写入统一 writer |
| level.rs    | TRACE / DEBUG / INFO / WARN / ERROR 类型与解析      |
| category.rs | scope 到统一功能分类的映射                          |
| format.rs   | 秘密脱敏、控制字符转义、单行和长度限制、行格式化    |
| writer.rs   | 有界队列、后台线程、文件写入、轮转、退出排空        |
| panic.rs    | panic 位置和消息捕获，同时保留原 stderr 行为        |

前端入口为 `apps/tauri/src/renderer/lib/diagnostic-log.ts`，统一 scope 常量和写入失败处理。
调用链为 renderer → writeDiagnosticLog IPC → Rust tracing event → subscriber layer → writer，组件不直接写文件。`tracing-log` 把依赖通过 `log` facade 发出的记录接入同一订阅器。

## 分类与格式

```text
毫秒时间戳 [INFO] [renderer:monitoring] category=monitoring sidebar action action="toggle" tab_id="…"
```

- level 表示严重程度。
- category 表示统一功能域：app、workspace、connection、terminal、monitoring、files、transfer、storage、security、updates、integration、logging、other。
- scope 保留原功能名和标签 ID，例如 ssh:tab-id、metrics:tab-id、renderer:workspace。
- 未识别的 scope 归入 other，不丢弃日志；增加业务日志时同步扩充 category.rs 映射。
- 新 Rust 代码优先使用 `tracing::{debug, info, warn, error}` 并记录具名字段；需要贯穿函数调用的上下文时使用 span / `#[instrument]`。不要把凭据、终端输入或完整远端输出作为字段传入。
- tracing event 的额外字段会以 `key=value` 附加到消息后；活动 span 名称会以 `span="…"` 附加。旧 facade 调用生成相同的 tracing event，但暂时保留原来的自由文本消息。

```rust
tracing::info!(
    category = "connection",
    scope = "ssh",
    tab_id = %tab_id,
    protocol = "ssh",
    "session connected"
);
```

分类用于检索，所有功能的事件仍写入同一个 app.log，方便按时间和 tab_id 串联跨层问题。
历史行没有 category 字段，新旧行仍兼容原来的时间戳/级别/scope 前缀。

## 文件与保留

日志位于应用数据目录的 logs/，设置页“系统与日志”可打开。
开发版使用独立 bundle ID `com.fileterm.desktop.dev`，但与普通安装版共用 `com.fileterm.desktop` 数据与日志目录；此前的 `.dev` 数据目录不迁移、不读取。Windows portable 沿用 exe 旁的配置目录规则。

app.log 在下一条日志导致超过 2 MiB 前轮转为 app.log.1，仅保留一个备份。单条消息上限为 16 KiB，控制字符转义，不允许换行注入。

密码、token、Authorization、私钥、OTP 等带标签字段会脱敏。业务代码仍应避免将秘密传给 logger，脱敏不能识别所有没有标签的秘密。

## 级别过滤

使用 tracing-subscriber `EnvFilter`，默认保留 DEBUG 及以上，延续原来的诊断行为。启动前可设置 `FILETERM_LOG_LEVEL` 为 TRACE、DEBUG、INFO、WARN、ERROR，或使用 tracing-subscriber 的 target 过滤指令；大小写不敏感，无法解析时回退到 DEBUG。
该设置在进程启动时读取，修改后需重启。过滤在事件格式化、脱敏和排队前完成，不影响原 renderer console 输出。

## 写入和限流

- 常规日志通过非阻塞提交进入 1024 条有界队列，由一个专用线程串行写入；避免每行都创建 Tokio blocking task。
- 队列满时 TRACE/DEBUG/INFO 被丢弃，并在后续写入时记录 dropped_low_priority 计数（受 WARN 级别过滤约束）。
- WARN/ERROR 在队列满时继续走后台写入回退路径，不因队列满而主动丢弃；该回退不受普通队列容量限制。
- 排队顺序在普通写入线程中保持；回退路径可能与普通日志交错，应以时间戳和 scope 关联。
- 正常桌面退出最多等待 500ms 排空已排队的日志；磁盘错误、后台任务异常、线程启动失败、强制终止或超时仍可能导致日志缺失。

业务采样日志应单独限频，不依赖队列满后的保护。监控样本摘要最多每分钟一条，侧栏状态变化去重，详见 monitoring-sidebar-diagnostics.md。

## 长时间运行诊断事件

以下性能事件写入 `app.log`。`renderer-health` 仅在可见 renderer 中每分钟提交一次；JS heap 不是 WebView 或应用进程的总内存。

| 事件 / scope                                     | 级别与触发                                                                           | 记录内容                                                                                                                                                                                                         | 解释限制                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `renderer-health` / `renderer:performance`       | DEBUG；可见页面每分钟                                                                | `uptimeMs`、可用时的 `usedJSHeapBytes` / `totalJSHeapBytes`、`ipcCallbackCount`、`terminalCount`、`domNodeCount`、本分钟 `maxEventLoopGapMs`；支持 Long Tasks API 时包含任务数、总时长和最大时长；应用版本与平台 | 隐藏页面不采样；JS heap 不代表 WebView 进程内存。可选字段可能不存在                  |
| `renderer-health.native`                         | 随上述记录，由 Rust 附加                                                             | `tokioAliveTasks`、`tokioGlobalQueueDepth`、`sessions`、`workers`、`workerQueuedCommands`、`sessionLogWriters`                                                                                                   | 只记录数量；使用非等待锁，锁忙时相应值为 `null`。全局就绪队列不包含所有 IO 等待任务  |
| `renderer-health.native`                         | 随上述记录，由 Rust 附加                                                             | `transferTasks`、`transferRuns`、`transferProgressSamples`、`terminalOutput.windows`、`terminalOutput.inFlight`、`terminalOutput.queuedBatches`                                                                  | 只记录数量；锁忙时相应值为 `null`，不是累计历史数或内存字节数                        |
| `event-loop-gap` / `renderer:performance`        | WARN；可见页面的 1 秒心跳间隔达到 4 秒，最多每 30 秒一次                             | `elapsedMs`、页面是否聚焦、应用版本与平台                                                                                                                                                                        | 在 renderer 恢复后才能记录；不能单独证明键盘输入或按钮响应耗时                       |
| `terminal-output-parse` / `renderer:performance` | WARN；终端输出解析耗时达到 1 秒、监听器失败或输出发生跳过，最多每 30 秒一次          | `elapsedMs`、待处理字符数和批次数、监听器数、是否有监听器失败、跳过的字节数                                                                                                                                      | 记录确认链路的耗时和积压，不包含终端输出正文                                         |
| `terminal:output` / category `terminal`          | WARN；renderer 等待输出额度达到 1 秒，或某窗口待发送队列已满；最多每窗口每 30 秒一次 | 等待时记录窗口/标签标识、等待毫秒和额度上限；队列满时记录窗口标识与累计跳过字节数                                                                                                                                | 表示输出显示遇到背压或发生跳过，不包含终端输出正文；跳过后终端会提示可用 Ctrl+L 重绘 |

这些性能记录不包含终端文本、终端输入或传输文件内容。普通 `app.log` 还包含各功能主动写入的运行与错误事件；启用的终端会话 transcript 单独保存在 `session-logs/`，其内容策略见“范围”。

## Windows 系统与大小核对照

Windows 构建在日志初始化后启动一个独立原生采样线程，立即采样一次，随后每 60 秒采样，
写入 `app.log`，scope 为 `app:windows-performance`，事件为 `windows-native-health`，级别 INFO。
不依赖 renderer 的事件循环、IPC 或动画帧；页面卡住时原生采样仍可继续。进程暂停、系统睡眠、
采样线程调度延迟及日志队列丢弃仍可能造成记录间隔或缺失；日志缺失本身不证明应用冻结。

- 每条记录带应用版本、主进程 PID、采样器运行时间、`sampleIntervalMs`、`sampleDurationMs` 和
  `appForeground`（本应用是否拥有前台窗口，读取失败为 `null`）。首次间隔为 `null`。
- `host` 缓存并重复记录 Windows build、display version、edition、进程架构、CPU 型号，以及
  Windows CPU Sets 报告的效率等级、各等级逻辑处理器数和物理核心数。失败记录 `errorCode`；
  多效率等级仅说明系统报告了异构拓扑，不把等级直接标成 Intel P/E 核，也不代表实际线程调度。
- `power` 记录电源连接和节电状态原始值；`acLineStatus` 的 0/1/255 对应离线/在线/未知。
- `processes.samples` 只选本 FileTerm 和它的 WebView2 子进程树，记录 PID、角色、累计 CPU 时间、
  `cpuPercentOneCore`、工作集字节、private committed bytes、优先级及 power throttling 原始 masks。
  CPU 百分比按两次成功采样间隔计算，100 表示占满一个逻辑处理器；多线程可超过 100，
  不是任务管理器按整机容量归一化的数值。首次采样或 PID 被复用时为 `null`。
- 最多采样 32 个进程，`count` 保留实际匹配数量，超出时 `truncated=true`。退出、权限不足或 API
  不支持会记录对应 `*ErrorCode`，不作为 0 CPU/0 内存；退出进程的采样状态会清理，句柄及时关闭。

对照同一时间的 `renderer-health`、`event-loop-gap`、`terminal-output-parse`：若页面心跳中断而
原生日志继续，可进一步看 WebView2 的 CPU、内存与策略变化；策略 masks 不能证明线程被调度到
小核，确认实际核心驻留和调度等待仍需 Windows 线程/ETW 采样。这里不改变绑核、优先级或节能策略，
不采集用户名、命令行、窗口标题、终端内容或凭据，也不写独立的无限增长日志文件。

## 前端异常

`renderer-error-log.ts` 通过同一 IPC 将异常写入 `app.log`，级别为 ERROR、scope 为 `renderer:error`（category 为 workspace）。覆盖 React ErrorBoundary、window error、未处理的 Promise 拒绝和 bridge 就绪后的初始化失败。

记录 source、应用版本、平台、窗口类型、错误名称/消息、JavaScript stack 和 React componentStack。只提取窗口类型，不记录完整 URL 或任意拒绝对象；不自动收集连接配置、终端内容或业务状态。堆栈在生产构建中可能包含压缩符号，但仍保留定位信息。三个错误正文/堆栈字段分别按转义后 UTF-8 3000 字节限制，同来源同内容在 5 秒内去重，React 组件堆栈不会被全局错误去重覆盖。

日志提交是 best-effort：bridge 尚未就绪、写入失败、进程强制退出时可能无法落盘。处理器不更新 React state，不阻止浏览器默认错误处理，也不把所有 console 输出转存为文件日志。

## 范围

诊断 app.log、终端会话 transcript 和 WebView console 是三个不同入口。诊断日志不自动保存终端输出，console 也不会自动归入文件日志。
