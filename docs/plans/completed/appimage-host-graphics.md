# AppImage 使用宿主机图形库

## 问题与范围

Arch 用户实测 2.3.2-beta.1 AppImage 启动报 `EGL_BAD_PARAMETER`；禁用 DMABUF 或指定 X11 均无效，临时预加载 `/usr/lib/libwayland-client.so.0` 后启动及 beta.1 → beta.2 应用内更新正常。实际发布包确认捆绑了 Ubuntu 的 Wayland/X11 display-stack 库，覆盖宿主机版本。

## 实现与验证

- 在已有 AppImage 重打包流程中移除上游确认会与新版 Mesa 冲突的十类 display-stack 库，保留 WebKitGTK、GTK 等应用运行库；不在应用启动时强制预加载、禁用渲染或改变 backend。
- CI、release 共用同一处理入口；最终 AppImage 再验证禁用库不存在。`.zsync` 与 updater 签名必须在内容最终确定后生成。
- 用 fixture 覆盖版本化库、嵌套路径、符号链接和运行库保留；使用实际 beta.1 发布包验证处理前失败、处理后通过。
- 同步中英文安装指南与 README，补齐下载/放置/启动步骤、签名更新范围、旧 beta EGL 临时办法及真实测试边界。
- 执行仓库质量门禁；容器检查不能替代 Arch GPU/桌面环境对修复后 AppImage 的实测。

## 依据

- [Tauri #15976](https://github.com/tauri-apps/tauri/issues/15976)：Ubuntu 构建的 display-stack 库覆盖新 Mesa 宿主库，已隔离出十类应由宿主提供的库。
- [Tauri bundler 2.10.0](https://tauri.app/release/tauri-bundler/v2.10.0/)：更新 linuxdeploy/GTK plugin 以处理新版 Mesa 上的 AppImage EGL 故障；本项目仍验证最终产物，避免构建工具缓存或后续变更重新引入。

## 完成记录（2026-10-25）

- 复用 `scripts/ensure-appimage-executable.sh` 的重打包步骤；新增 55 行的宿主机图形库处理/校验脚本与 49 行 fixture 测试。CI 与发布均进入同一流程，最终包元数据检查也会独立拒绝冲突库。
- 真实 x86_64 beta.1 包含全部十类冲突库，新校验器在处理前拒绝该包。Arch 容器（Mesa 26.2.5、Wayland 1.26.0）确认原包覆盖系统 `libwayland-client`，使 Mesa 出现 `wl_fixes_interface`、`wl_display_create_queue_with_name`、`wl_display_dispatch_queue_timeout` 三项未定义符号；移除后改用系统库，三项错误消失。
- 在同一 Arch 容器的 Xvfb 软件渲染环境中，原 AppDir 复现 `EGL_BAD_PARAMETER` 且未显示主窗口；修复后的 AppDir 无需 `LD_PRELOAD`、禁用 DMABUF 或关闭 WebKit sandbox 即可显示欢迎页和侧栏。测试使用实际 beta.1 的原程序二进制，只改变打包内容；此容器结果不能替代实体 GPU/Wayland 桌面验证。
- 真实 ARM64 beta.1 经完整重打包，最终禁用库检查、权限、内嵌更新通道、`.zsync` 名称/长度/SHA-1 校验和完整 AppImage 的 `--help` 均通过。最小 Ubuntu 容器补齐了普通图形桌面提供的 GTK/fontconfig/GL 宿主依赖。
- 类型、lint、Prettier、211 项 renderer 测试、完整 Rust/contract 测试与所有 target/feature 的严格 Clippy 均通过；修改的 Bash 脚本语法检查与 `git diff --check` 通过。
- 中英文安装指南与 README 同步实际更新方式，明确先下载再移动/赋权、AppImage 可写路径、DEB/RPM 授权、Pacman 回退、旧 beta 临时启动命令及 ATK 消息 signature 的含义。没有给应用新增全局 `LD_PRELOAD`、强制软件渲染或关闭无障碍能力。
- 尚未发布包含修复的新版本，也未改动 beta.1 / beta.2 的已发布资产。修复后完整新包仍需用户在原 Arch 机器确认普通启动、图形加速表现及更新重启。
