# FileTerm 图标源文件

- `FileTerm.icon/`、`FileTerm-material.icon/`、`FileTerm-clean.icon/` 分别对应 classic、material、clean 三种 Icon Composer 文稿包；在访达中打开即可。VS Code 会把 `.icon` 包显示成文件夹。
- `svg/`、`svg-material/`、`svg-clean/` 是对应变体可单独编辑的图层 SVG。

Windows/Linux 的 1024px 满版母图从各工程直接导出到 `apps/tauri/src-tauri/icons/app/shared/<variant>-1024.png`（Default、1024×1024、scale 1），然后运行 `apps/tauri/scripts/generate-platform-app-icons.py` 生成较小 PNG、ICO 和 tray 资源。不要从带留白的 macOS Dock PNG 放大生成母图；macOS `dock-*.png` 单独保留四边各 100px 的透明安全边距。

所有图层使用 1024×1024 坐标，Composer 缩放为 100%、偏移为 0。银圈内沿由 Apple ictool 渲染的系统蒙版轮廓等距内缩 40px 得到；外沿由系统裁切。终端符号保留原版形状与尺寸，并按可见轮廓整体居中。
