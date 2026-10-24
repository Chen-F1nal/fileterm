# Linux 应用内更新

## 目标与范围

AppImage、DEB、RPM 的 x86_64/aarch64 发行包复用现有 Tauri updater、签名密钥和下载/重启界面。pacman、开发态和无法确认安装来源的程序继续打开 GitHub Release。旧客户端需先手动安装一次包含更新器的版本。

## 实现范围

- Rust：初始化 Linux updater；按 bundle 类型、架构、AppImage 运行环境及系统包归属选择精确目标，拒绝跨包格式更新。Arch 从 DEB 重打包，不能仅凭二进制内的 DEB 标记判断。
- 安装：确认编辑器保存后，AppImage 在原目录保留独立备份，失败恢复；DEB/RPM 复用插件的系统提权安装。成功后保存传输断点、停止会话并重启；失败或取消授权保持应用运行并显示错误。
- 发布：最终 DEB（含 universal 重打包）、RPM、AppImage（含权限/zsync 处理）完成后再签名，上传六组 Linux payload/signature，合入统一清单。不能发布无包类型的 Linux fallback 目标。
- UI：复用已有设置页，只补充 Linux 目录权限和安装授权提示。
- 文档/测试：更新架构和发布验收；覆盖包格式/架构路由、Arch fallback、备份恢复和清单缺失/空签名/重复目标。

## 验证

执行仓库质量门禁、CSS contract、workflow YAML/Bash 检查；Linux CI 执行 updater 单元测试。AppImage 原地升级、DEB/RPM 提权/取消、包管理器锁与依赖失败仍需对应发行版的真实旧版到新版验收，不能以 macOS 单元测试替代。

## 实现与代码验证完成（2026-10-25）

- 已完成上述运行时、清单、最终包签名和中英文提示；复用原更新公钥，未新增依赖、修改版本或发布产物。
- macOS 本机通过类型、lint、Prettier、210 项 renderer 测试、914 项 Rust/contract 测试及全部 target/feature 的 Clippy。
- 在 Debian 12 ARM64 Docker 环境中编译真实 Linux 分支，通过 13 项 updater 测试及全部 target/feature 的 Clippy。源码复制至独立容器目录，Tauri 生成文件不写回用户工作区。
- 两个 workflow 的 YAML 和 76 个 Bash block 语法通过；CSS contract 通过，已有的 11 处 `!important` 与约 6 处旧颜色债务未变化。
- 此次完成代码和容器验证，未进行 Linux 图形桌面旧版到新版升级或生产签名发布。AppImage 真正替换/重启、DEB/RPM 的图形提权/取消、依赖与锁冲突，均按[发布验收清单](../../quality/auto-update-release-checklist.md#linux-tauri-应用内更新)继续实测。

## 鲁棒性复审与加固（2026-10-25）

- AppImage 继续复用 Tauri 下载验签，安装改用同目录暂存与原子替换。写入前检查 Type 2 ELF 与架构，暂存后回读 SHA-256；旧副本、新文件和目录均按提交顺序刷盘，保留原执行权限。写入过程中不改动原文件；并发修改原文件时拒绝覆盖并保留备份，提交后失败尝试恢复。
- Linux 安装前后检查重启路径及执行权限，路径丢失或不可执行时保持应用运行；系统包若继承了指向其他 AppImage 的启动环境，则在安装前拒绝。
- 包归属查询限时两秒，超时终止查询并回退下载页。共享 updater 检查限时二十秒，网络连接和读取停滞分别限时十五/六十秒，持续有数据的慢速下载不受二十秒检查超时影响。
- 清单拒绝空 payload 或用目录/符号链接冒充安装包；不只检查签名文件是否存在。
- 新故障测试覆盖错误格式/架构/截断头、部分写入/损坏/panic、进程被实际强制终止、并发修改、丢失/不可执行的重启文件、恢复受阻时保留备份、查询超时与空安装包。强制终止测试仅启动单元测试子进程，不启动桌面应用。
- 本轮 Linux ARM64 的 20 项更新测试及 Clippy 通过；仍未以容器测试代替 Linux 图形授权或真实整包旧版到新版升级验收。
- 本机复跑通过类型、lint、Prettier、210 项 renderer 测试、921 项完整 Rust/contract 测试，以及新增故障场景后的 Clippy。临时容器、卷和构建镜像已清理，未提交或发布。
