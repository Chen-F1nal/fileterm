# FileTerm 安装指南

本指南适用于 FileTerm 桌面版。请只从 [FileTerm GitHub Releases](https://github.com/St0ff3l/fileterm/releases) 下载。日常使用请选择最新正式版；测试版本请从 Releases 列表中选择标记为 prerelease 的版本。

## 选择正确的安装包

- **Windows**：x64 电脑下载文件名含 `windows-x64` 的安装包；Windows ARM 设备下载含 `windows-arm64` 的安装包。
- **macOS**：Apple Silicon（M 系列）下载 `macos-arm64.dmg`；Intel Mac 下载 `macos-x64.dmg`。
- **Linux**：运行 `uname -m`。输出 `x86_64` 时选 `linux-x86_64`；输出 `aarch64` 或 `arm64` 时选 `linux-arm64`。

不要混用不同架构的安装包。

## Windows

### 安装版

1. 下载与设备架构匹配的 `FileTerm-<版本>-windows-x64-setup.exe` 或 `FileTerm-<版本>-windows-arm64-setup.exe`。
2. 运行安装器并按提示完成安装。
3. 从开始菜单启动 FileTerm。

安装版提供签名的应用内更新。发现新版本后，FileTerm 会下载并验证对应架构的更新包，再提示重启完成更新。

### 便携版

1. 下载 `FileTerm-<版本>-windows-x64-portable.exe` 或 `FileTerm-<版本>-windows-arm64-portable.exe`。
2. 将文件放在有写入权限的目录后运行。

便携版不需要安装，也不写入安装器注册信息；配置保存在可执行文件旁的 `config/` 目录。它需要系统已安装 WebView2 Runtime。便携版配置与凭据受当前 Windows 设备保护；把配置复制到另一台电脑后，需要重新配置凭据。

## macOS

1. 根据芯片类型下载 `FileTerm-<版本>-macos-arm64.dmg` 或 `FileTerm-<版本>-macos-x64.dmg`。
2. 打开 DMG，将 FileTerm 拖到“应用程序”文件夹。
3. 从“应用程序”文件夹启动。

Apple Silicon 版本要求 macOS 11 或更新版本；Intel 版本的最低系统版本为 macOS 10.13。macOS 安装包未经过 Apple 公证，首次打开时系统可能显示安全提示。确认文件来自本项目的 GitHub Releases 后，可按系统提示在“系统设置 → 隐私与安全性”中允许打开。

包含更新器的 macOS 版本支持签名的应用内更新：下载并验签后，确认重启即可安装。请从当前用户可写的“应用程序”目录运行，不要从 DMG 中运行。更新包签名独立于 Apple 签名和公证；若系统拦截新版，仍需在“隐私与安全性”中允许打开。尚未包含更新器的旧版需先手动安装一次新版 DMG。

## Linux

### 架构对应关系

| `uname -m` 输出      | Release 文件名中的架构 |
| -------------------- | ---------------------- |
| `x86_64`             | `x86_64`               |
| `aarch64` 或 `arm64` | `arm64`                |

### 选择软件包格式

| 格式           | 适用范围                                           | 安装或运行                                                                                                                        |
| -------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `.AppImage`    | 支持 AppImage 的桌面发行版                         | 先运行 `chmod +x FileTerm-<版本>-linux-<架构>.AppImage`，然后运行该文件                                                           |
| `.deb`         | Debian、Ubuntu 及其衍生版                          | `sudo apt install ./FileTerm-<版本>-linux-<架构>.deb`                                                                             |
| `.rpm`         | Fedora、openSUSE 等能提供所需运行库的 RPM 发行版   | Fedora：`sudo dnf install ./FileTerm-<版本>-linux-<架构>.rpm`；openSUSE：`sudo zypper install ./FileTerm-<版本>-linux-<架构>.rpm` |
| `.pkg.tar.zst` | x86_64 的 Arch Linux 系；aarch64 的 Arch Linux ARM | `sudo pacman -U ./FileTerm-<版本>-linux-<架构>.pkg.tar.zst`                                                                       |

x86_64 `.deb` 内含 Debian 11 兼容运行库，并会在系统运行库可用时自动使用系统版本。通过 APT 升级 `.deb` 时，私有运行库会随 FileTerm 一起更新。arm64 `.deb` 使用系统运行库，要求 Debian 12 或更新版本。RPM 和 Pacman 包使用系统运行库；RPM 要求发行版提供 WebKitGTK 4.1 和 OpenSSL 3。AppImage 随包提供 GTK/WebKitGTK 等应用运行库，图形驱动及配套的 Wayland/X11 库使用宿主机版本；系统 glibc 仍需与 Ubuntu 22.04 构建基线兼容。

Arch Linux 官方发行版目前使用 x86_64 包；aarch64 包面向独立的 Arch Linux ARM 发行版。请勿把 ARM 包安装到 x86_64 系统，或反过来。

### AppImage 下载与首次运行

1. 从 GitHub Releases 下载与架构匹配的 `.AppImage` 文件本体。`.sig` 和 `.zsync` 是更新校验/差量更新文件，不能单独启动。
2. 把 AppImage 放在当前用户可写的目录，例如 `~/Applications`。创建目录本身不会下载文件。
3. 添加执行权限后直接运行。下面假设浏览器已把文件下载到 `~/Downloads`；将 `<版本>` 替换为下载文件的实际版本。如果文件在桌面或其他目录，也要修改 `mv` 的来源路径。

```sh
mkdir -p "$HOME/Applications"
mv "$HOME/Downloads/FileTerm-<版本>-linux-x86_64.AppImage" "$HOME/Applications/"
chmod +x "$HOME/Applications/FileTerm-<版本>-linux-x86_64.AppImage"
"$HOME/Applications/FileTerm-<版本>-linux-x86_64.AppImage"
```

ARM64 用户将文件名中的 `x86_64` 换成 `arm64`。若出现 `No such file or directory`，先核对文件是否已下载以及实际路径；若提示缺少 FUSE，Arch 可运行 `sudo pacman -S --needed fuse2` 后重试。[AppImage FUSE 排查文档](https://docs.appimage.org/user-guide/troubleshooting/fuse.html)

### Linux 应用内更新

- 包含更新器的 AppImage、DEB、RPM 支持签名的应用内更新，按当前架构与安装格式下载更新包。AppImage 在 Arch 上也使用此流程；请直接运行用户可写目录中的原始 AppImage，不要解包后运行。
- AppImage 更新保留原文件路径和执行权限。DEB/RPM 更新调用系统安装器，可能需要管理员授权；依赖缺失或包管理器被占用时，可使用上表中的包管理器命令手动安装新版。
- Pacman `.pkg.tar.zst`、不支持的架构或无法识别的安装来源仍会打开发布页，下载后用 `sudo pacman -U` 升级。旧版本若尚未包含 Linux updater，需要先手动安装一次包含它的版本。
- Release 中的 `.zsync` 仍可供 AppImageUpdate 等外部工具执行差量更新；应用内更新下载完整包，并自动验证更新签名，无需用户单独下载 `.sig`。

### 旧 AppImage 的 EGL 启动问题

2.3.2-beta.1 / beta.2 的 AppImage 在部分 Arch / 新 Mesa 环境中可能出现 `Could not create default EGL display: EGL_BAD_PARAMETER`，原因是包内 Wayland 库与宿主机图形栈冲突。后续构建会移除这些宿主机图形库；已发布的旧文件保持不变。旧版可临时优先加载系统库（以下路径适用于 Arch）：

```sh
LD_PRELOAD=/usr/lib/libwayland-client.so.0 \
  "$HOME/Applications/FileTerm-2.3.2-beta.1-linux-x86_64.AppImage"
```

这条命令仅影响本次启动，无需把 `LD_PRELOAD` 写入全局环境。更新签名用于校验更新包，不能修复图形兼容性。`atk-bridge ... unknown signature` 中的 signature 指无障碍消息的数据格式，与更新包数字签名无关；`DRI3` 警告表示当前 X server 无法提供相应硬件加速。若界面正常，检查重启后的应用版本即可；若仍有空白窗口或渲染异常，请保留日志报告。

## 更新与帮助

若 Arch + LXQt 中“打开下载页面”或更新提示无法启动浏览器，先运行 `sudo pacman -S --needed xdg-utils qtxdg-tools`，然后用 `xdg-open https://github.com/St0ff3l/fileterm/releases` 检查系统链接打开能力。若仍然失败，请在 LXQt 的默认应用设置中关联 HTTP/HTTPS 浏览器，并保留终端错误信息。FileTerm 的链接打开失败也会写入应用日志。

- Windows、macOS 与受支持的 Linux AppImage/DEB/RPM 使用签名的应用内更新；按提示确认安装和重启，系统包可能要求管理员授权。
- 不支持应用内更新的安装方式会打开 GitHub Releases，供用户下载匹配架构与格式的安装包。
- 如果安装或启动失败，请在 [GitHub Issues](https://github.com/St0ff3l/fileterm/issues) 提交操作系统、处理器架构、FileTerm 版本和脱敏后的错误信息。不要提交密码、私钥或 token。
