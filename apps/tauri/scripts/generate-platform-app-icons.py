"""Generate Windows/Linux app icon resources from the canonical artwork.

Requires Pillow (`python -m pip install Pillow`). Run from any directory with:
    python apps/tauri/scripts/generate-platform-app-icons.py

macOS Dock resources intentionally remain untouched: their transparent safety
margin is part of the macOS icon contract. Windows and Linux need full-canvas
artwork, so this script crops that margin before generating their resources.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
SOURCE_DIR = ROOT / "apps/tauri/src/renderer/assets/app-icons"
PLATFORM_ASSET_DIR = SOURCE_DIR / "platform"
ICON_DIR = ROOT / "apps/tauri/src-tauri/icons"
WINDOWS_ICON_DIR = ICON_DIR / "app-platform"
TRAY_ICON_DIR = ICON_DIR / "app-tray"
VARIANTS = ("classic", "material", "clean")
ICO_SIZES = (16, 20, 24, 32, 40, 48, 64, 128, 256)


def resized(source: Image.Image, size: int) -> Image.Image:
    return source.resize((size, size), Image.Resampling.LANCZOS)


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True, compress_level=9)


def main() -> None:
    PLATFORM_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    WINDOWS_ICON_DIR.mkdir(parents=True, exist_ok=True)
    TRAY_ICON_DIR.mkdir(parents=True, exist_ok=True)
    (WINDOWS_ICON_DIR / "windows-classic.ico").unlink(missing_ok=True)
    for obsolete in TRAY_ICON_DIR.glob("tray-windows-*-256.png"):
        obsolete.unlink()

    cropped: dict[str, Image.Image] = {}
    for variant in VARIANTS:
        source = Image.open(SOURCE_DIR / f"dock-{variant}.png").convert("RGBA")
        bounds = source.getchannel("A").getbbox()
        if bounds is None:
            raise ValueError(f"{variant} source icon is fully transparent")
        artwork = source.crop(bounds)
        if artwork.width != artwork.height:
            raise ValueError(f"{variant} source artwork must be square: {artwork.size}")
        cropped[variant] = artwork

        for size in (256, 512):
            save_png(resized(artwork, size), PLATFORM_ASSET_DIR / f"{variant}-{size}.png")

        for platform in ("linux", "windows"):
            save_png(
                resized(artwork, 32),
                TRAY_ICON_DIR / f"tray-{platform}-{variant}-32.png",
            )

        windows_ico = (
            ICON_DIR / "icon.ico"
            if variant == "classic"
            else WINDOWS_ICON_DIR / f"windows-{variant}.ico"
        )
        artwork.save(
            windows_ico,
            format="ICO",
            sizes=[(size, size) for size in ICO_SIZES],
        )

    classic = cropped["classic"]
    for size, path in (
        (32, ICON_DIR / "32x32.png"),
        (128, ICON_DIR / "128x128.png"),
        (256, ICON_DIR / "128x128@2x.png"),
        (512, ICON_DIR / "icon.png"),
    ):
        save_png(resized(classic, size), path)

if __name__ == "__main__":
    main()
