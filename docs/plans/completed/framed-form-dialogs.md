# 轻量表单弹窗统一框线与间距

状态：实现与本机自动验证完成（2026-10-26）；原生 WebView 与真实远端待验收。

## 范围与决定

以 root 视角认证弹窗为参考，统一轻量操作/认证弹窗的标题分隔线、分组框线、底部操作区、小圆角与适中间距。用户修正上一版过密布局，因此 FileAction 宽度从 400px 放至 440px、输入高度从 32px 恢复 36px；root 主入口单独从 620px 收窄到 560px，顶部内容间距改为与备份密码弹窗相同的 16px。

覆盖重命名/新建文件及文件夹、备份密码、SSH 密钥口令、交互式认证、主机指纹确认、SMB 凭据与共享选择。已有分组结构的提权、SSH 凭据、权限与密钥编辑不机械重建。公共 modal-error 圆角统一消费 `--radius-sm`。文件命名表单只保留一个普通 label 和输入框，按用户最后的截图修正移除多余分组框；label 用 htmlFor 关联输入，保持可访问名称。

复用公共 Button、DropdownSelect 和 VerticalScrollbar；FormDialogBody 只负责共享内容布局与滚动，不接管各业务弹窗的提交/关闭行为。选择、校验、密码存储/遮罩、回调和协议边界保持原逻辑。

## 验证

跨页面浏览器夹具扩展实际 root/备份/口令/交互认证/指纹/SMB/共享组件：中英文、深浅主题、420px 窄窗、busy 尺寸、错误小圆角、root 560px 宽度和 16px 顶部间距、名称标签唯一且可访问、20 轮挑战列表滚动时 footer 保持可见，以及密码/认证/SMB/root 提交参数。沿用既有四主题/自定义强调色和 32 组确认配置回归。

完成后运行传输页夹具、CSS contract 与项目门禁。原生 WebView 和真实远端不在浏览器夹具验证范围。

## 完成与结果

- 文件命名保持一个普通 label，无额外 fieldset 框线；正文为适中留白，标题/底部操作区保留分隔线。已有多字段表单的分组边框继续保留。
- root 顶部正文 padding 从 10px 调至 16px；公共 modal-error 圆角从 10px 改为 `--radius-sm`（4px），与输入框一致。
- 跨页面浏览器夹具和既有传输页夹具通过，包含新增表单的实际参数回调、名称标签唯一/可访问和长表单滚动。检查深浅截图，未增加视觉按钮宽度。
- typecheck、lint、Prettier、renderer 239 项、Rust 903 项、CLI 10 项、contract 23 项及 Clippy all-targets/all-features 通过。CSS contract 通过，既有 11 条 !important 和 6 处 legacy 颜色提示未增加；git diff --check 通过。
- 本轮只调整 renderer 布局和控件，不修改协议、凭据或传输实现；真实业务行为仍需用户在原生开发版与实际远端验收。

## 路径收藏补充对齐

- 标题栏统一为 44px 高、14px/500 字号和 16px 左右留白；弹窗宽度 440px，内容留白 16px，卡片小圆角与 12–13px 正文保持轻量表单密度。
- 空状态去掉装饰性圆形底框；读取/空列表/少量收藏共用 160px 内容基线，避免异步加载和首次收藏导致窗口跳动。长路径保留 title，窄窗口当前目录区与操作按钮分行。
- 收藏/已收藏文案使用既有 StableButtonLabel 保持按钮自然最大宽度；错误提示复用公共 modal-error。
- 浏览器实际增删测试复现原有删除确认被通用 Dialog（z-index 1000）遮挡的问题：为该嵌套确认使用局部 1001 层级，并在移除确认显示时关闭父 Dialog 的 Escape 捕获。Dialog 新增 closeOnEscape，默认 true；收藏区保持键盘隔离，并在非 busy 时由 Escape 取消子确认，busy 时不关闭。
- 增加中英文/深浅主题/420px 窄窗的空状态、长路径、收藏失败重试、成功后按钮尺寸、取消/删除、排序、打开以及父子 Escape 回归，均通过；公共控件跨页面夹具仍通过。typecheck、lint、Prettier、renderer 239、Rust 903、CLI 10、contract 23、Clippy 和 CSS contract 通过，既有 CSS 债务未增加。

原生 WebView 和真实收藏持久化未在浏览器夹具中验证。
