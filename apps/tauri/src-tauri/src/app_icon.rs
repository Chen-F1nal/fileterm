#[cfg(any(target_os = "linux", target_os = "windows"))]
use tauri::image::Image;
use tauri::AppHandle;
#[cfg(any(target_os = "linux", target_os = "windows"))]
use tauri::Manager;

#[cfg(any(target_os = "linux", test))]
mod linux;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(any(target_os = "linux", target_os = "macos", test))]
pub(crate) fn icon_bytes(variant: &str) -> &'static [u8] {
    match variant {
        "material" => include_bytes!("../../src/renderer/assets/app-icons/dock-material.png"),
        "clean" => include_bytes!("../../src/renderer/assets/app-icons/dock-clean.png"),
        _ => include_bytes!("../../src/renderer/assets/app-icons/dock-classic.png"),
    }
}

#[cfg(target_os = "linux")]
pub(crate) fn window_icon_image(variant: &str) -> Result<Image<'static>, String> {
    Image::from_bytes(icon_bytes(variant)).map_err(|error| error.to_string())
}

#[cfg(any(target_os = "linux", target_os = "windows"))]
pub(crate) fn set_window_icon(window: &tauri::WebviewWindow, variant: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows::set_window_icon(window, variant)
    }

    #[cfg(target_os = "linux")]
    {
        window
            .set_icon(window_icon_image(variant)?)
            .map_err(|error| error.to_string())
    }
}

#[cfg(target_os = "linux")]
fn tray_icon_bytes(variant: &str) -> &'static [u8] {
    match variant {
        "material" => include_bytes!("../icons/app-tray/tray-linux-material-32.png"),
        "clean" => include_bytes!("../icons/app-tray/tray-linux-clean-32.png"),
        _ => include_bytes!("../icons/app-tray/tray-linux-classic-32.png"),
    }
}

#[cfg(target_os = "windows")]
fn tray_icon_bytes(variant: &str) -> &'static [u8] {
    match variant {
        "material" => include_bytes!("../icons/app-tray/tray-windows-material-256.png"),
        "clean" => include_bytes!("../icons/app-tray/tray-windows-clean-256.png"),
        _ => include_bytes!("../icons/app-tray/tray-windows-classic-256.png"),
    }
}

#[cfg(any(target_os = "linux", target_os = "windows"))]
pub(crate) fn tray_icon_image(variant: &str) -> Result<Image<'static>, String> {
    Image::from_bytes(tray_icon_bytes(variant)).map_err(|error| error.to_string())
}

pub fn set_app_icon(app: &AppHandle, variant: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    crate::macos_icon::set_app_icon(app, variant)?;

    #[cfg(any(target_os = "linux", target_os = "windows"))]
    {
        for window in app.webview_windows().values() {
            set_window_icon(window, variant)?;
        }

        if let Some(tray) = app.tray_by_id("main") {
            tray.set_icon(Some(tray_icon_image(variant)?))
                .map_err(|error| error.to_string())?;
        }
    }

    #[cfg(target_os = "linux")]
    linux::set_launcher_icon(app, variant)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::icon_bytes;

    #[test]
    fn linux_static_icons_include_the_classic_silver_rim() {
        for bytes in [
            &include_bytes!("../icons/32x32.png")[..],
            &include_bytes!("../icons/128x128.png")[..],
            &include_bytes!("../icons/128x128@2x.png")[..],
            &include_bytes!("../icons/icon.png")[..],
        ] {
            let icon = tauri::image::Image::from_bytes(bytes).unwrap();
            let offset = ((icon.height() / 9 * icon.width() + icon.width() / 2) * 4) as usize;
            let rim = &icon.rgba()[offset..offset + 4];
            assert!(
                rim[0] > 100 && rim[1] > 100 && rim[2] > 100 && rim[3] > 200,
                "classic artwork must retain its visible silver top rim"
            );
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_packaged_icon_matches_classic_runtime_icon() {
        let packaged =
            tauri::image::Image::from_bytes(include_bytes!("../icons/icon.ico")).unwrap();
        let classic = super::tray_icon_image("classic").unwrap();
        assert_eq!(packaged.width(), classic.width());
        assert_eq!(packaged.height(), classic.height());
        assert_eq!(packaged.rgba(), classic.rgba());
    }

    #[test]
    fn each_app_icon_variant_is_an_rgba_png() {
        for variant in ["classic", "material", "clean"] {
            let bytes = icon_bytes(variant);
            assert_eq!(&bytes[..8], b"\x89PNG\r\n\x1a\n");
            assert_eq!(&bytes[12..16], b"IHDR");
            assert_eq!(bytes[24], 8);
            assert_eq!(bytes[25], 6);
        }
    }

    #[test]
    fn platform_tray_icon_assets_keep_native_sizes_and_rgba_format() {
        for (icon, size) in [
            (
                &include_bytes!("../icons/app-tray/tray-linux-classic-32.png")[..],
                32,
            ),
            (
                &include_bytes!("../icons/app-tray/tray-linux-material-32.png")[..],
                32,
            ),
            (
                &include_bytes!("../icons/app-tray/tray-linux-clean-32.png")[..],
                32,
            ),
            (
                &include_bytes!("../icons/app-tray/tray-windows-classic-256.png")[..],
                256,
            ),
            (
                &include_bytes!("../icons/app-tray/tray-windows-material-256.png")[..],
                256,
            ),
            (
                &include_bytes!("../icons/app-tray/tray-windows-clean-256.png")[..],
                256,
            ),
        ] {
            assert_eq!(&icon[..8], b"\x89PNG\r\n\x1a\n");
            assert_eq!(&icon[12..16], b"IHDR");
            assert_eq!(u32::from_be_bytes(icon[16..20].try_into().unwrap()), size);
            assert_eq!(u32::from_be_bytes(icon[20..24].try_into().unwrap()), size);
            assert_eq!(icon[24], 8, "tray PNGs must use 8-bit channels");
            assert_eq!(icon[25], 6, "tray PNGs must use RGBA pixels");
        }
    }
}
