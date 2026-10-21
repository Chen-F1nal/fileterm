# Windows 接续：Claude Code 长时卡顿与 GPU/native 内存

## 当前状态

工作分支：`fix/logging-controls-terminal-font`。

- `91eac3cd`：日志分类默认降噪、设置紧凑布局与字体字重。
- `ae67e84f`：删除块字符触发 DOM 回退，修复共享图集清理后其他终端错位。
- `c44b3d43`：旧字形引用释放、RGB 缓存预算与合并页复用。

前序验证及边界见[缓存增长复核](terminal-webgl-cache-growth-2026-10-21.md)和[共享图集排查](terminal-webgl-fallback-shared-atlas-2026-10-21.md)。本机为 macOS Chrome / ANGLE Metal，不能作为 Windows WebView2 或真实 Claude Code 长任务通过记录。所有本机负载已结束，用户要求后续在 Windows 继续。

## 接续提示词

在 Windows 接续本分支，排查真实 FileTerm/Tauri WebView2 运行 Claude Code 后界面卡死和 GPU/native 内存增长。先保留本机未提交修改，读取 AGENTS.md、`docs/quality/desktop-ui-preview.md`、本交接及上述两份报告；不要覆盖现有会话或把浏览器夹具当成原生验收。

1. 识别当前项目开发进程的完整路径、工作目录、Vite 端口、版本和实际 renderer，记录 WebView2 与显卡驱动版本。优先复用已确认的开发进程，不启动旧打包版本替代。
2. 开启“工作区”“性能与卡顿”“终端”详情，其他详情保持关闭，会话正文日志独立控制。保留匹配复现时间的 `app.log` / `app.log.1`。
3. 记录相同 PID 及创建时间对应的 FileTerm/WebView2 进程 private bytes、working set；对应 `windows-native-health`、JS heap、图集页数/字节/字形数、解析与 ACK 积压、长帧和 React 异常。先区分 renderer、browser 和 GPU 进程，不能用整个进程组 RSS 直接替代单个 WebView2 私有内存。
4. 优先真实 Claude Code 输出与输入交互；再做稳定颜色、持续 RGB、字体/字号变化、标签切换、文件区刷新对照，观察停止输出和关闭临时终端后是否稳定或回落。保护用户真实任务，用独立临时会话做销毁测试。
5. 重点验证下述 GPU 纹理槽保留线索。需要修复时先留复现证据，在共享适配器解决根因，保留字体度量、原始颜色和滚动缓冲，避免自动重载窗口掩盖问题。
6. Windows 上执行受影响回归及 AGENTS.md 门禁；如果 exe 被运行中会话占用，不强制终止用户任务。报告平台、构建、负载、内存来源、实际观测时长，以及没有验证的部分。不能仅凭 JS heap 或 CPU 图集稳定就宣布 native/GPU 问题已解决。

## 待验证的 GPU 线索

`addon-webgl@0.19.0` 的每个 GlyphRenderer 拥有独立 `_atlasTextures`，CPU 图集可共享。图集合并会减少当前页面数量，字体变化会替换图集；`render()` 只上传当前 `atlas.pages.length` 个槽，而 `setAtlas()` 只将版本置为 -1。未使用槽及旧 mip levels 是否保留较大 storage，需要进一步验证，尚未提交生产修复，不能认定它就是 Windows 卡死根因。

新增测试专用 `helpers/webgl-texture-trace.mjs`，拦截 RGBA `texImage2D`、`generateMipmap`、纹理绑定与删除，记录 API 请求的逐 level 大小。它不查询真实显存、不代表驱动实际分配或释放时间；mip level 历史按已请求且未删除对象统计。只在显式启用 GPU probe 的浏览器夹具中加载，不修改生产 renderer 的 GL API。

Windows PowerShell 示例（依现有环境设置 Playwright/esbuild 模块与浏览器路径，不添加项目依赖）：

```powershell
$env:FILETERM_RUNTIME_TRUECOLOR = '1'
$env:FILETERM_RUNTIME_BATCHES = '3000'
$env:FILETERM_RUNTIME_GPU_PROBE = '1'
$env:FILETERM_RUNTIME_OUTPUT = Join-Path $env:TEMP 'fileterm-gpu-texture-windows.json'
node apps/tauri/tests/browser/terminal-renderer-runtime-load.mjs
```

`textureProbe.before` / `after` 保存字号变化前后的 CPU 页数、活动/非活动纹理槽及 API storage 估计；`textureDispose` 检查释放路径。首轮 macOS smoke 产生有效记录、未知格式为 0，销毁后跟踪纹理数与字节为 0；尚未对未使用槽保留提出或验证生产修复。Windows 上先核对这些结果，再与实际 native/GPU 采样交叉。

既有 Windows 原生分钟采样在 Rust `services/logging/windows_performance/`，独立于 renderer 心跳。不要把宿主进程的 DXGI 当前进程查询误当成另一个 WebView2 GPU 进程的数据；接口返回未知或权限不足时保留未知状态，不记为 0。
