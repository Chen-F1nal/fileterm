use tauri::{Manager, WebviewWindow};
use windows::{
    core::Owned,
    Win32::{
        Foundation::{HWND, LPARAM, WPARAM},
        UI::WindowsAndMessaging::{
            CreateIconFromResourceEx, SendMessageW, HICON, ICON_BIG, ICON_SMALL, LR_DEFAULTCOLOR,
            WM_SETICON,
        },
    },
};

thread_local! {
    // WM_SETICON borrows HICONs. Keep the three shared variants alive on the UI
    // thread, including when windows close or switch away from a variant.
    static ICONS: Result<[Owned<HICON>; 3], String> = load_icons();
}

fn load_icons() -> Result<[Owned<HICON>; 3], String> {
    fn load(variant: &str) -> Result<Owned<HICON>, String> {
        let bytes = super::tray_icon_bytes(variant);
        // These 256px RGBA PNGs are also valid Windows icon resource payloads.
        // Use Windows-sized assets instead of a 1024px Dock bitmap.
        let icon = unsafe {
            CreateIconFromResourceEx(bytes, true, 0x0003_0000, 256, 256, LR_DEFAULTCOLOR)
        }
        .map_err(|error| error.to_string())?;
        Ok(unsafe { Owned::new(icon) })
    }
    Ok([load("classic")?, load("material")?, load("clean")?])
}

fn apply_window_icon(hwnd: HWND, variant: &str) -> Result<(), String> {
    let index = match variant {
        "material" => 1,
        "clean" => 2,
        _ => 0,
    };
    ICONS.with(|icons| {
        let icons = icons.as_ref().map_err(Clone::clone)?;
        for kind in [ICON_SMALL, ICON_BIG] {
            // Tauri's set_icon currently sends only ICON_SMALL on Windows.
            // Explicitly update ICON_BIG for the taskbar and Alt+Tab as well.
            unsafe {
                SendMessageW(
                    hwnd,
                    WM_SETICON,
                    Some(WPARAM(kind as usize)),
                    Some(LPARAM(icons[index].0 as isize)),
                );
            }
        }
        Ok(())
    })
}

pub(super) fn set_window_icon(window: &WebviewWindow, variant: &str) -> Result<(), String> {
    let target = window.clone();
    let variant = variant.to_string();
    window
        .run_on_main_thread(move || {
            let result = target
                .hwnd()
                .map_err(|error| error.to_string())
                .and_then(|hwnd| apply_window_icon(HWND(hwnd.0), &variant));
            if let Err(error) = result {
                crate::services::logging::warn(
                    target.app_handle(),
                    "app-icon",
                    format!("failed to update Windows window/taskbar icon: {error}"),
                );
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::{
        core::w,
        Win32::UI::WindowsAndMessaging::{
            CreateWindowExW, DestroyWindow, WINDOW_EX_STYLE, WM_GETICON, WS_OVERLAPPED,
        },
    };

    #[test]
    fn native_window_updates_both_icon_sizes_and_can_restore_classic() {
        // A hidden native window exercises real WM_SETICON/WM_GETICON handling.
        let hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                w!("STATIC"),
                w!("FileTerm icon test"),
                WS_OVERLAPPED,
                0,
                0,
                100,
                100,
                None,
                None,
                None,
                None,
            )
        }
        .unwrap();
        let mut handles = Vec::new();
        for variant in ["classic", "material", "clean", "classic"] {
            apply_window_icon(hwnd, variant).unwrap();
            let get = |kind| unsafe {
                SendMessageW(hwnd, WM_GETICON, Some(WPARAM(kind as usize)), None).0
            };
            let big = get(ICON_BIG);
            assert_ne!(big, 0);
            assert_eq!(get(ICON_SMALL), big);
            handles.push(big);
        }
        assert_ne!(handles[0], handles[1]);
        assert_ne!(handles[1], handles[2]);
        assert_ne!(handles[0], handles[2]);
        assert_eq!(handles[0], handles[3]);
        unsafe { DestroyWindow(hwnd) }.unwrap();
    }
}
