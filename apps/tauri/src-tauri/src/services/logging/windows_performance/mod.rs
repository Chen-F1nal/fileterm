//! Low-frequency native evidence that continues while the WebView is stalled.
mod host;
mod processes;

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

pub(super) fn start(version: String) {
    static STARTED: AtomicBool = AtomicBool::new(false);
    if STARTED.swap(true, Ordering::AcqRel) {
        return;
    }
    if let Err(error) = std::thread::Builder::new()
        .name("windows-performance".into())
        .spawn(move || {
            let host = host::snapshot();
            let started = Instant::now();
            let mut sampler = processes::Sampler::default();
            let mut previous_sample = None;
            loop {
                let sample_started = Instant::now();
                let interval_ms =
                    previous_sample.map(|at| sample_started.duration_since(at).as_millis());
                previous_sample = Some(sample_started);
                let processes = sampler.sample();
                super::info_global(
                    "app:windows-performance",
                    serde_json::json!({
                        "event": "windows-native-health",
                        "version": version,
                        "pid": std::process::id(),
                        "uptimeMs": started.elapsed().as_millis(),
                        "sampleIntervalMs": interval_ms,
                        "appForeground": host::app_foreground(),
                        "host": host,
                        "power": host::power_status(),
                        "processes": processes,
                        "sampleDurationMs": sample_started.elapsed().as_millis(),
                    })
                    .to_string(),
                );
                std::thread::sleep(Duration::from_secs(60));
            }
        })
    {
        super::warn_global(
            "app:windows-performance",
            format!("sampler start failed: {error}"),
        );
    }
}
