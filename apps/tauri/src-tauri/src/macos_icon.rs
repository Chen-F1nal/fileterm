use objc2::{AllocAnyThread, MainThreadMarker};
use objc2_app_kit::{NSApplication, NSImage, NSWorkspace, NSWorkspaceIconCreationOptions};
use objc2_foundation::{NSData, NSString};
use std::path::Path;
use tauri::AppHandle;

pub fn set_app_icon(app: &AppHandle, variant: &str) -> Result<(), String> {
    let icon_bytes: &'static [u8] = match variant {
        "material" => include_bytes!("../../src/renderer/assets/app-icons/dock-material.png"),
        "clean" => include_bytes!("../../src/renderer/assets/app-icons/dock-clean.png"),
        _ => include_bytes!("../../src/renderer/assets/app-icons/dock-classic.png"),
    };
    let reset_finder_icon = variant == "classic";
    let logging_app = app.clone();

    app.run_on_main_thread(move || {
        // SAFETY: Tauri runs this closure on the AppKit main thread.
        let main_thread = unsafe { MainThreadMarker::new_unchecked() };
        let data = NSData::with_bytes(icon_bytes);
        let Some(icon) = NSImage::initWithData(NSImage::alloc(), &data) else {
            crate::services::logging::warn(
                &logging_app,
                "app-icon",
                "unable to decode embedded Dock icon",
            );
            return;
        };
        // SAFETY: The image is decoded from a bundled PNG and AppKit's setter accepts it.
        unsafe {
            NSApplication::sharedApplication(main_thread).setApplicationIconImage(Some(&icon))
        };

        let Some(bundle_path) = std::env::current_exe().ok().and_then(|executable| {
            executable
                .ancestors()
                .find(|path| path.extension().is_some_and(|extension| extension == "app"))
                .map(Path::to_path_buf)
        }) else {
            return;
        };
        let bundle_path = NSString::from_str(&bundle_path.to_string_lossy());
        let workspace = NSWorkspace::sharedWorkspace();
        let options = NSWorkspaceIconCreationOptions(0);

        // shortcut: FinderInfo marks the signed bundle as custom and fails strict codesign; use signed app variants if signature checks must remain valid.
        // Clear first so Finder refreshes the custom icon when switching variants.
        let cleared = workspace.setIcon_forFile_options(None, &bundle_path, options);
        let updated = reset_finder_icon
            || workspace.setIcon_forFile_options(Some(&icon), &bundle_path, options);
        if !cleared || !updated {
            crate::services::logging::warn(
                &logging_app,
                "app-icon",
                "failed to update the app bundle icon in Finder",
            );
        }
    })
    .map_err(|error| error.to_string())
}
