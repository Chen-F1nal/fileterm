#!/usr/bin/env python3
"""Check actual extracted deb/rpm/pacman desktop and icon payloads."""

import argparse
import configparser
from pathlib import Path
import struct


ICON_FILES = {
    "usr/share/pixmaps/fileterm.png": ("app/linux/128x128.png", 128),
    "usr/share/pixmaps/com.fileterm.desktop.png": ("app/linux/128x128.png", 128),
    "usr/share/icons/hicolor/32x32/apps/fileterm.png": ("app/linux/32x32.png", 32),
    "usr/share/icons/hicolor/128x128/apps/fileterm.png": ("app/linux/128x128.png", 128),
    "usr/share/icons/hicolor/256x256@2/apps/fileterm.png": ("app/shared/classic-256.png", 256),
}


def verify(root, icons_dir):
    for relative, (source, size) in ICON_FILES.items():
        payload = (root / relative).read_bytes()
        expected = (icons_dir / source).read_bytes()
        if payload != expected:
            raise ValueError(f"Stale or modified package icon: {relative}")
        if payload[:8] != b"\x89PNG\r\n\x1a\n" or payload[24:26] != bytes([8, 6]):
            raise ValueError(f"Expected an 8-bit RGBA PNG: {relative}")
        if struct.unpack(">II", payload[16:24]) != (size, size):
            raise ValueError(f"Incorrect icon dimensions: {relative}")

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
            "Exec": "/usr/bin/fileterm %U", "TryExec": "/usr/bin/fileterm",
            "StartupWMClass": "fileterm",
        }.items():
            if values.get(key) != expected:
                raise ValueError(f"Incorrect {key} in {name}: {values.get(key)!r}")
        if values.getboolean("NoDisplay", fallback=False) != hidden:
            raise ValueError(f"Incorrect launcher visibility: {name}")
    print(f"Verified Linux launcher IDs and five classic icon payloads: {root}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path, help="Extracted deb/rpm/pacman package root")
    parser.add_argument("--icons-dir", type=Path,
                        default=Path(__file__).resolve().parents[1] / "src-tauri/icons")
    args = parser.parse_args()
    verify(args.root, args.icons_dir)
