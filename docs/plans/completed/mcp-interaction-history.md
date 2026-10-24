# MCP 交互状态回传

状态：源码完成，项目门禁通过；安装版与真实宿主弹窗待更新后验收。

## 问题与修复

- MCP 宿主可能隐藏实时通知，命令成功结果缺少用户曾在 FileTerm 完成安全输入的事实。desktop bridge 将本次交互记录保留在最终成功或失败响应中，client 优先采用最终记录；MCP 在 structuredContent.interactionHistory，CLI JSONL 在顶层 interactionHistory 返回。
- dispatch 完成和最后一个 progress 同时就绪、writer 队列满时会丢失临时通知。返回前排空请求自身的事件队列，将记录随最终响应发送；不重放操作。
- 审批结果、sudo/su 密码输入结束状态以前没有完整回传。现在记录审批通过、拒绝、关闭、超时，以及安全输入请求、完成、取消、超时和不可用状态。
- SSH 登录凭据、主机验证、私钥口令和 keyboard-interactive/MFA 以前只显示整体连接等待。现在由连接 operation 保留类型与状态，唤醒原有等待调用并回传脱敏记录。最多保留 16 次认证交互，超出明确标记 history-truncated。
- 文件通道 Storage 错误曾让 Agent 误以为 SSH 会话关闭；现在返回 FILETERM_STORAGE_OPERATION_FAILED，不据此推断 SSH 断线。FILETERM_CONNECTION_FAILED 现在保留稳定代码，不再退化为通用失败。
- 写操作可能成功后在生成快照时失败，取消调用也不能证明远程动作已撤销。变更操作遇到存储、返回值解析异常或请求取消时，明确返回 unknown，要求检查状态后再决定是否重试。
- 旧指引中建议 Agent 索取 sudo/su 密码的内容改为恢复 FileTerm 窗口或在本地保存凭据；手动 CLI 输入机制保持兼容，Agent 不应收集密码。

## 隐私和语义

最终交互记录只包含 event、status、code 三个字段，不复制通知正文、提示正文、回答、密码、口令长度、用户名、主机信息、progress token 或内部请求 ID。记录不包含命令输出；命令原有输出边界保持既定语义。

requested 表示后端请求界面显示安全提示，并非已取得界面实际绘制确认。input-completed 仅表示本地安全输入已完成，不代表密码正确或 SSH/sudo 认证成功。认证结果仍以连接/命令自身结果判断；退出码 0、缺少交互记录都不能证明免密。最终响应中的历史事件不表示提示仍在等待输入。

## 已检查的其他边界

后台命令保留 commandId、offset、running、exitCode、timedOut、cancelled 等状态；文件传输保留任务 ID 与独立等待查询。接受/排队不被当作任务完成。sudo 密码通过 stdin 发送；su 的 PTY 已关闭 ECHO，并等待密码提示再发送；本轮没有添加秘密回传渠道。

桥断开或调用者取消后，Agent 最多能知道此前收到的状态，不能保证拿到后续最终结果；这类变更操作必须按结果不确定处理。初始连接认证交互归属于 connection operation；已结束调用之外的用户 GUI 操作不自动推送给 Agent，应通过会话或任务查询获取后续状态。

## 验证

本地 bridge 夹具模拟隐藏/丢失实时通知、只收到较晚的状态、最终输入完成、取消与超时，核对最终结构化结果及文本一致；另外覆盖最后事件排空竞争、输出 schema、敏感通知正文过滤、旧 bridge 兼容、连接状态唤醒与有界截断、稳定错误码和不确定结果恢复。

已通过：类型检查、lint、Prettier、209 项 Renderer 测试、910 项 Rust/contract 测试（877 unit + 10 CLI + 23 contract）、所有 target/feature 的 Clippy -D warnings、git diff --check。

未更新 /Applications/FileTerm.app，未重启已安装 MCP，也未通过新构建在真实 NAS 上重复弹窗测试。本轮改动未提交。
