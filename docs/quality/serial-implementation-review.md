# 串口实现审查

审查日期：2026-10-14。本文记录 FileTerm 源码审查结果，实体串口验收另行记录。

## 已有能力

FileTerm 已覆盖基本参数、端口枚举和手动路径、UTF-8/GBK 等流式解码、写入/flush 超时与
取消。还提供 Text/Hex、换行转换、本地回显、逐字节/逐行发送延迟、USB 身份匹配重连、
DTR/RTS/Break、线路状态、RS-485、mark/space parity、Raw/X/Y/ZMODEM/Kermit、宏和循环
发送，以及串口原始字节日志。

## 待补项

| 优先级 | 问题与证据                                                                                                                                                                                                        | 建议与验收                                                                                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1     | `sessions/serial/worker.rs` 在 `WriteTerminal` 分支内等待整个 `write_serial_bytes` 完成；这期间外层 `reader.read` 不再被轮询。大量粘贴、字节延迟或 CTS 阻塞时，接收显示会延迟，设备持续输出还可能超过驱动缓冲区。 | 让普通发送和接收并发，保留串口文件传输期间的读写独占、现有取消和 RS-485 时序。用有界写队列控制输入积压；用虚拟串口测试“慢速发送时另一端持续输出”，确认接收不中断且关闭立即结束。 |
| P1     | 连接 worker 和测试连接中的 `open_native_async()` 都直接调用；目前没有单独的设备打开等待超时，也没有异常驱动场景的取消测试。方法名称中的 async 不代表打开设备的系统调用一定不会阻塞。                              | 隔离设备打开调用，增加打开等待超时、取消和迟到句柄回收。超时不能强行结束底层阻塞调用，须在其返回后回收端口。用可注入的打开任务模拟迟到结果，再做 Windows/macOS 驱动验收。        |
| P2     | `connection-manager-modal.tsx` 仍按网络连接显示 host/port/username；`overview-page.tsx` 的近期连接使用 `username@host`。串口缺少直观的设备、波特率、帧格式摘要。                                                  | 复用一个串口摘要函数，显示如 `COM3 · 115200 baud · 8N1`，并覆盖 mark/space 的 `M/S` 标记。搜索同时包含设备路径和串口参数；网络连接继续显示自己的字段。                           |
| 验收   | 现有自动化和 Linux PTY 不能证明实体设备的 DTR/RTS 电平、拔插、Break、USB 驱动、RS-485 换向和硬件流控行为。                                                                                                        | 在 Windows/macOS 各记录一次 USB 串口收发、占用/拔插重连、CTS 阻塞取消；按已有串口计划补实体线路及协议互操作验收。                                                                |

前三项是独立待办，本次只完成审查，不标记为已实现。优先完成发送与接收并发，再处理
设备打开生命周期和列表摘要；现有协议能力维持当前模块边界。

相关实现与验收说明：

- `apps/tauri/src-tauri/src/sessions/serial/worker.rs`
- `apps/tauri/src-tauri/src/sessions/serial/device.rs`
- `apps/tauri/src-tauri/src/sessions/serial/pacing.rs`
- `apps/tauri/src-tauri/src/sessions/serial/codec.rs`
- [已有串口能力计划](../plans/completed/serial-capability-gap.md)
- [连接协议本机验证](./connection-protocol-local-testing.md)
