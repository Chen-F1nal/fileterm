# FileTerm Installation Guide

This guide covers the FileTerm desktop app. Download FileTerm only from [FileTerm GitHub Releases](https://github.com/St0ff3l/fileterm/releases). For everyday use, choose the latest stable release. To test prerelease builds, select a release marked as a prerelease.

## Choose the Correct Download

- **Windows**: choose an installer whose name contains `windows-x64` for an x64 PC, or `windows-arm64` for a Windows ARM device.
- **macOS**: Apple silicon (M-series) Macs should use `macos-arm64.dmg`; Intel Macs should use `macos-x64.dmg`.
- **Linux**: run `uname -m`. Choose `linux-x86_64` for `x86_64`, or `linux-arm64` for `aarch64` or `arm64`.

Do not install a package built for a different architecture.

## Windows

### Installer

1. Download `FileTerm-<version>-windows-x64-setup.exe` or `FileTerm-<version>-windows-arm64-setup.exe` for your device.
2. Run the installer and follow its prompts.
3. Launch FileTerm from the Start menu.

Installed builds support signed in-app updates. FileTerm downloads and verifies the update for your architecture, then asks you to restart to complete the update.

### Portable

1. Download `FileTerm-<version>-windows-x64-portable.exe` or `FileTerm-<version>-windows-arm64-portable.exe`.
2. Place it in a directory where you have write access and run it.

The portable build does not install files or register an uninstaller. It stores its configuration in a `config/` directory beside the executable and requires the WebView2 Runtime to be installed on Windows. Its configuration and credentials are protected for the current Windows device; credentials must be set up again if you move the configuration to another computer.

## macOS

1. Download `FileTerm-<version>-macos-arm64.dmg` or `FileTerm-<version>-macos-x64.dmg` for your Mac.
2. Open the DMG and drag FileTerm to the Applications folder.
3. Launch FileTerm from Applications.

The Apple silicon build requires macOS 11 or later. The Intel build has a minimum system version of macOS 10.13. The macOS package is not notarized by Apple, so macOS may show a security warning on first launch. After confirming that the file came from this project's GitHub Releases, follow macOS prompts to allow it under **System Settings → Privacy & Security**.

macOS builds that include the updater support signed in-app updates: download and verify the update, then confirm the restart to install it. Run the app from an Applications directory writable by your user, rather than from the DMG. Update-package signatures are separate from Apple signing and notarization; if macOS blocks the new version, allow it in Privacy & Security. Older builds without the updater need one manual installation of a newer DMG first.

## Linux

### Match Your Architecture

| `uname -m` output    | Architecture tag in release filenames |
| -------------------- | ------------------------------------- |
| `x86_64`             | `x86_64`                              |
| `aarch64` or `arm64` | `arm64`                               |

### Choose a Package Format

| Format         | For                                                                                       | Install or run                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `.AppImage`    | Desktop distributions with AppImage support                                               | Run `chmod +x FileTerm-<version>-linux-<arch>.AppImage`, then launch the file                                                           |
| `.deb`         | Debian, Ubuntu, and derivatives                                                           | `sudo apt install ./FileTerm-<version>-linux-<arch>.deb`                                                                                |
| `.rpm`         | Fedora, openSUSE, and other RPM distributions that provide the required runtime libraries | Fedora: `sudo dnf install ./FileTerm-<version>-linux-<arch>.rpm`; openSUSE: `sudo zypper install ./FileTerm-<version>-linux-<arch>.rpm` |
| `.pkg.tar.zst` | Arch Linux derivatives on x86_64; Arch Linux ARM on aarch64                               | `sudo pacman -U ./FileTerm-<version>-linux-<arch>.pkg.tar.zst`                                                                          |

The x86_64 `.deb` includes a compatibility runtime for Debian 11 and selects the system runtime automatically when available. Its private runtime is updated together with FileTerm when you upgrade the `.deb` through APT. The arm64 `.deb` uses system libraries and requires Debian 12 or newer. RPM and Pacman packages use system libraries; the RPM requires a distribution that provides WebKitGTK 4.1 and OpenSSL 3. AppImages bundle application runtimes such as GTK/WebKitGTK, but use the host's graphics drivers and matching Wayland/X11 libraries. Host glibc must still be compatible with the Ubuntu 22.04 build baseline.

The official Arch Linux distribution currently uses the x86_64 package. The aarch64 package is for the separate Arch Linux ARM distribution. Do not install the ARM package on an x86_64 system or vice versa.

### Download and Launch an AppImage

1. Download the actual `.AppImage` asset for your architecture from GitHub Releases. The `.sig` and `.zsync` files support verification/differential updates and cannot be launched on their own.
2. Put the AppImage in a directory writable by your user, such as `~/Applications`. Creating a directory does not download the file.
3. Make the file executable and launch it directly. This example assumes your browser downloaded the file to `~/Downloads`; replace `<version>` with the version in its actual filename. If it is on your Desktop or elsewhere, change the source path in `mv` too.

```sh
mkdir -p "$HOME/Applications"
mv "$HOME/Downloads/FileTerm-<version>-linux-x86_64.AppImage" "$HOME/Applications/"
chmod +x "$HOME/Applications/FileTerm-<version>-linux-x86_64.AppImage"
"$HOME/Applications/FileTerm-<version>-linux-x86_64.AppImage"
```

ARM64 users should replace `x86_64` with `arm64`. For `No such file or directory`, first check whether the file was downloaded and confirm its actual path. If FUSE is missing on Arch, run `sudo pacman -S --needed fuse2` and retry. [AppImage FUSE troubleshooting](https://docs.appimage.org/user-guide/troubleshooting/fuse.html)

### Linux In-App Updates

- AppImage, DEB, and RPM builds that include the updater support signed in-app updates for their current architecture and package format. This includes AppImages running on Arch. Run the original AppImage directly from a writable directory, rather than extracting it first.
- AppImage updates preserve the original file path and executable permissions. DEB/RPM updates invoke the system installer and may require administrator authorization. If dependencies are missing or the package manager is busy, use the package-manager commands above to install the new version manually.
- Pacman `.pkg.tar.zst` packages, unsupported architectures, and unrecognized installations still open the release page. Download the matching package and upgrade with `sudo pacman -U`. Older versions without the Linux updater need one manual installation of a version that includes it.
- The `.zsync` sidecar remains available for differential updates with AppImageUpdate and similar external tools. In-app updates download the full package and verify its update signature automatically; you do not need to download `.sig` separately.

### EGL Startup Failures in Older AppImages

The 2.3.2-beta.1 / beta.2 AppImages can fail with `Could not create default EGL display: EGL_BAD_PARAMETER` on some Arch / newer Mesa systems because bundled Wayland libraries conflict with the host graphics stack. Subsequent builds remove these host graphics libraries; published older files remain unchanged. For an older build, temporarily prefer the system library (this path is for Arch):

```sh
LD_PRELOAD=/usr/lib/libwayland-client.so.0 \
  "$HOME/Applications/FileTerm-2.3.2-beta.1-linux-x86_64.AppImage"
```

This affects only that launch; do not add `LD_PRELOAD` to your global environment. Update signatures verify packages and cannot fix graphics compatibility. The signature in `atk-bridge ... unknown signature` describes an accessibility message's data format, rather than a digital package signature. A `DRI3` warning means the current X server cannot provide the corresponding hardware acceleration. If the UI works, check the app version after restarting; report retained logs if you still see a blank window or rendering problems.

## Updates and Support

If the download-page button or update hint cannot launch a browser on Arch + LXQt, run `sudo pacman -S --needed xdg-utils qtxdg-tools`, then test the system launcher with `xdg-open https://github.com/St0ff3l/fileterm/releases`. If it still fails, configure the HTTP/HTTPS browser association in LXQt's default application settings and retain the terminal error. FileTerm also records link-launch failures in its application log.

- Windows, macOS, and supported Linux AppImage/DEB/RPM builds use signed in-app updates. Confirm installation and restart when prompted; system packages may require administrator authorization.
- Installation types without in-app updates open GitHub Releases so you can download the matching architecture and package format.
- If installation or startup fails, open a [GitHub Issue](https://github.com/St0ff3l/fileterm/issues) with your OS, processor architecture, FileTerm version, and redacted error details. Do not include passwords, private keys, or tokens.
