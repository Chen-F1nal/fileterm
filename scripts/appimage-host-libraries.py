"""Keep AppImage display libraries compatible with the host's Mesa/EGL drivers."""

import argparse
import os
from pathlib import Path


HOST_LIBRARIES = {
    "libwayland-client",
    "libwayland-cursor",
    "libwayland-egl",
    "libwayland-server",
    "libxkbcommon",
    "libxcb-randr",
    "libxcb-render",
    "libxcb-shm",
    "libXau",
    "libXdmcp",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("appdir", type=Path)
    parser.add_argument("--remove", action="store_true")
    args = parser.parse_args()
    appdir = args.appdir.resolve()
    library_root = appdir / "usr/lib"
    if (
        not (appdir / "AppRun").is_file()
        or not library_root.is_dir()
        or library_root.is_symlink()
        or not library_root.resolve().is_relative_to(appdir)
    ):
        parser.error("expected an extracted AppDir with AppRun and a local usr/lib directory")

    libraries = []
    for directory, _, filenames in os.walk(library_root, followlinks=False):
        for filename in filenames:
            name, separator, version = filename.partition(".so")
            if name in HOST_LIBRARIES and separator and (not version or version.startswith(".")):
                libraries.append(Path(directory) / filename)
    if libraries and not args.remove:
        raise SystemExit(
            "AppImage bundles host graphics libraries that can break Mesa/EGL:\n"
            + "\n".join(str(path.relative_to(appdir)) for path in sorted(libraries))
        )
    for library in sorted(libraries):
        # Unlink the bundled entry, never its symlink target.
        library.unlink()
        print(f"Removed host graphics library: {library.relative_to(appdir)}")


if __name__ == "__main__":
    main()
