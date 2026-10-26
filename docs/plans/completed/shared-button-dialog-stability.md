# 公共按钮与确认弹窗影响面回归

状态：实现与本机自动验证完成（2026-10-26）；原生 WebView 与真实业务远端仍待验收。

## 范围

沿本次修改的公共 Button、ConfirmActionDialog、FileActionModal、FilePermissionModal 追踪调用处；保留现有未提交工作，不修改传输协议和上传下载行为。公共 Button 的直接消费者包括侧栏收起按钮、监控开关/重试、路径收藏、文件操作/权限和传输页。确认弹窗包括串口、检查点丢弃、SSH 密钥、安全设置、连接/代理/命令管理、后台会话/隧道、AI、主题删除、书签、外部操作审批、编辑器丢弃和退出/关闭标签等入口。

## 验证方法

- 从当前 TSX 实际调用处读取确认文案、变体和附加样式，补充布局层参数转发，测试中英文及四个内置主题。
- 构建 HEAD 源码基线夹具，对比普通状态的按钮宽高、内边距、字体和圆角，避免只检查 busy 前后相同却忽略初始尺寸回归。
- 实际组件覆盖监控延迟操作/失败重试、文件操作/权限、密钥编辑、外部审批、更新、收藏与侧栏；检查 busy/disabled、鼠标 hover、错误重试、窄窗以及 reduced-motion。
- 不把调用配置夹具当作各业务页面全链路验证。沿用开发版识别要求，原生 WebView 无法精确绑定时不启动安装版代替。

## 已发现

- 监控重试按钮仍使用动态前置 spinner 和变长 busy 文案，存在加载宽度变化。
- 文件操作弹窗迁移公共 Button 后，旧 footer 的 88px 取消最小宽度、16px 内边距和字重样式未匹配新类名。HEAD 夹具复现取消按钮 66px、确认按钮 100px、字重 500；已恢复原来的按钮尺寸与主题字重。

## 门禁

修复后运行跨页面浏览器夹具、既有传输页夹具、CSS contract、typecheck、lint、Prettier、renderer/Rust/CLI/contract 和 Clippy。完成后记录结果与未验证项。

## 完成结果

- 保留公共按钮普通状态自然宽度，监控重试和开关使用原尺寸内的加载占位；重试期间保留原文案，禁止重复操作，失败后提示仍显示。
- 权限弹窗恢复与 HEAD 相同的 16px 按钮内边距；新建/重命名 footer 恢复原尺寸和主题字重。
- 公共 spinner 遵守 reduced-motion，减少动效模式下保持静态进度反馈。
- 按用户补充的截图调整重命名、新建文件夹、新建文件：宽度收至 400px、内边距 20px，移除标题/表单/footer 叠加空白，输入高度 32px、圆角使用 `--radius-sm`（4px）。按钮几何仍与原版一致；弹窗宽高缩小是此处明确要求的变化。
- 跨页面夹具通过 32 组实际确认调用配置 × 两种语言 × 四种内置主题及自定义强调色的普通/加载状态；普通按钮几何与 HEAD 源码对比。实际组件另外覆盖文件操作、权限、SSH 密钥、外部审批、更新、监控失败重试、收藏、侧栏，检查窄窗、hover、重复提交和 reduced-motion。书签初次打开的正常入场动画在采样前等待完成，未改动此动画。
- 传输页面既有浏览器夹具通过。typecheck、lint、Prettier、renderer 239 项、Rust 903 项、CLI 10 项、contract 23 项、Clippy 和 CSS contract 通过；既有 CSS 11 条 !important 和 6 处 legacy 颜色提示未增加。

测试不启动实际退出/删除/远端操作，不代表各业务页面全链路或原生平台验收。

复跑跨页面浏览器夹具：`PLAYWRIGHT_CHANNEL=chrome node apps/tauri/tests/browser/button-dialog-stability.mjs`。使用外部 Playwright 安装时通过 `PLAYWRIGHT_MODULE_PATH` 指定模块路径；`FILETERM_UI_ARTIFACT_DIR` 可保存截图。夹具将 HEAD 对应源文件构建为普通状态基线，因此提交后基线会随 HEAD 更新；加载前后稳定性、标准尺寸和紧凑布局断言继续独立生效。
