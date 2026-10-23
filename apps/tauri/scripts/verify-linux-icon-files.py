#!/usr/bin/env python3
"""Check actual extracted Linux desktop and icon payloads."""

import argparse
import configparser
from pathlib import Path
import struct


ICON_FILES = {
    "usr/share/pixmaps/fileterm.png": ("app/shared/classic-1024.png", 1024),
    "usr/share/pixmaps/com.fileterm.desktop.png": ("app/shared/classic-1024.png", 1024),
    "usr/share/icons/hicolor/32x32/apps/fileterm.png": ("app/linux/32x32.png", 32),
    "usr/share/icons/hicolor/128x128/apps/fileterm.png": ("app/linux/128x128.png", 128),
    "usr/share/icons/hicolor/256x256@2/apps/fileterm.png": ("app/linux/128x128@2x.png", 256),
    "usr/share/icons/hicolor/1024x1024/apps/fileterm.png": ("app/shared/classic-1024.png", 1024),
}


def verify(root, icons_dir, appimage=False):
    for relative, (source, size) in ICON_FILES.items():
        payload = (root / relative).read_bytes()
        expected = (icons_dir / source).read_bytes()
        if payload != expected:
            raise ValueError(f"Stale or modified package icon: {relative}")
        if payload[:8] != b"\x89PNG\r\n\x1a\n" or payload[24:26] != bytes([8, 6]):
            raise ValueError(f"Expected an 8-bit RGBA PNG: {relative}")
        if struct.unpack(">II", payload[16:24]) != (size, size):
            raise ValueError(f"Incorrect icon dimensions: {relative}")

    executable = "fileterm" if appimage else "/usr/bin/fileterm"
    for name, hidden in [("FileTerm.desktop", False), ("com.fileterm.desktop.desktop", True)]:
        entry = configparser.ConfigParser(interpolation=None)
        path = root / "usr/share/applications" / name
        if b"\r" in path.read_bytes():
            raise ValueError(f"Desktop entries must use LF line endings: {name}")
        with path.open() as file:
            entry.read_file(file)
        values = entry["Desktop Entry"]
        for key, expected in {
            "Type": "Application", "Name": "FileTerm", "Icon": "fileterm",
            "Exec": f"{executable} %U", "TryExec": None if appimage else executable,
            "StartupWMClass": "fileterm",
        }.items():
            if values.get(key) != expected:
                raise ValueError(f"Incorrect {key} in {name}: {values.get(key)!r}")
        if values.getboolean("NoDisplay", fallback=False) != hidden:
            raise ValueError(f"Incorrect launcher visibility: {name}")
    if appimage:
        verify_appimage(root)
    print(f"Verified Linux launcher IDs and {len(ICON_FILES)} classic icon payloads: {root}")


def verify_appimage(root):
    desktops = list(root.glob("*.desktop"))
    if len(desktops) != 1 or desktops[0].name != "FileTerm.desktop":
        raise ValueError("AppDir must expose exactly one root desktop entry: FileTerm.desktop")
    if desktops[0].read_bytes() != (root / "usr/share/applications/FileTerm.desktop").read_bytes():
        raise ValueError("AppDir root desktop entry differs from the packaged launcher")
    for executable in ["AppRun", "AppRun.wrapped", "usr/bin/fileterm"]:
        if not (root / executable).is_file():
            raise ValueError(f"AppDir executable is missing: {executable}")
    for name in ("fileterm.png", ".DirIcon"):
        data = (root / name).read_bytes()
        if data[:8] != b"\x89PNG\r\n\x1a\n" or len(data) < 24:
            raise ValueError(f"AppDir icon must be a valid PNG: {name}")
        size = struct.unpack(">II", data[16:24])
        if size != (1024, 1024):
            raise ValueError(f"AppDir icon must be 1024x1024px: {name} is {size[0]}x{size[1]}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path, help="Extracted Linux package root")
    parser.add_argument("--appimage", action="store_true", help="Check portable AppDir launchers and root entries")
    parser.add_argument("--icons-dir", type=Path,
                        default=Path(__file__).resolve().parents[1] / "src-tauri/icons")
    args = parser.parse_args()
    verify(args.root, args.icons_dir, args.appimage)
