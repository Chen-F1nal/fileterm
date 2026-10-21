use std::collections::BTreeMap;
use std::sync::atomic::{AtomicU32, Ordering};

use super::{LogCategory, LogLevel};

const CATEGORIES: [&str; 14] = [
    "app",
    "workspace",
    "connection",
    "terminal",
    "monitoring",
    "performance",
    "files",
    "transfer",
    "storage",
    "security",
    "updates",
    "integration",
    "logging",
    "other",
];
// Detailed diagnostics are opt-in; basic INFO and all warnings/errors bypass this mask.
const DEFAULT_MASK: u32 = 0;
static ENABLED_CATEGORIES: AtomicU32 = AtomicU32::new(DEFAULT_MASK);

pub fn default_categories() -> BTreeMap<String, bool> {
    CATEGORIES
        .iter()
        .map(|name| ((*name).to_owned(), false))
        .collect()
}

pub fn migrate_categories(input: BTreeMap<String, bool>) -> BTreeMap<String, bool> {
    // Earlier iterations of this unreleased setting persisted noisy default combinations.
    let previous_defaults = [
        ((1 << CATEGORIES.len()) - 1) & !(1 << 2) & !(1 << 4),
        (1 << 0) | (1 << 9) | (1 << 10) | (1 << 12),
        1 << 5,
    ];
    if input.len() == CATEGORIES.len()
        && previous_defaults.iter().any(|mask| {
            CATEGORIES
                .iter()
                .enumerate()
                .all(|(index, name)| input.get(*name) == Some(&(mask & (1 << index) != 0)))
        })
    {
        default_categories()
    } else {
        input
    }
}

pub fn normalize_categories(input: BTreeMap<String, bool>) -> BTreeMap<String, bool> {
    default_categories()
        .into_iter()
        .map(|(name, default)| {
            let enabled = input.get(&name).copied().unwrap_or(default);
            (name, enabled)
        })
        .collect()
}

pub fn set_categories(categories: BTreeMap<String, bool>) {
    let categories = normalize_categories(categories);
    let mask = CATEGORIES
        .iter()
        .enumerate()
        .fold(0, |mask, (index, name)| {
            mask | if categories[*name] { 1 << index } else { 0 }
        });
    ENABLED_CATEGORIES.store(mask, Ordering::Relaxed);
}

fn enabled_in(mask: u32, level: LogLevel, category: LogCategory) -> bool {
    level >= LogLevel::Warn
        || (level == LogLevel::Info
            && matches!(
                category,
                LogCategory::App
                    | LogCategory::Security
                    | LogCategory::Updates
                    | LogCategory::Logging
            ))
        || CATEGORIES
            .iter()
            .position(|name| *name == category.as_str())
            .is_some_and(|index| mask & (1 << index) != 0)
}

pub(super) fn enabled(level: LogLevel, category: LogCategory) -> bool {
    enabled_in(ENABLED_CATEGORIES.load(Ordering::Relaxed), level, category)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_disable_detail_but_keep_basic_info_and_all_errors() {
        for (name, enabled) in default_categories() {
            let category = LogCategory::from_name(&name);
            assert_eq!(category.as_str(), name);
            assert!(!enabled);
            assert_eq!(enabled_in(DEFAULT_MASK, LogLevel::Debug, category), enabled);
            assert_eq!(
                enabled_in(DEFAULT_MASK, LogLevel::Info, category),
                matches!(name.as_str(), "app" | "security" | "updates" | "logging")
            );
            assert!(enabled_in(0, LogLevel::Warn, category));
            assert!(enabled_in(0, LogLevel::Error, category));
            assert!(!enabled_in(0, LogLevel::Debug, category));
        }
        assert!(!enabled_in(
            DEFAULT_MASK,
            LogLevel::Debug,
            LogCategory::from_scope("russh::client")
        ));
        assert!(!enabled_in(
            DEFAULT_MASK,
            LogLevel::Info,
            LogCategory::from_scope("ssh:session")
        ));
        for scope in ["app", "window", "app:connection:tab"] {
            assert!(enabled_in(
                DEFAULT_MASK,
                LogLevel::Info,
                LogCategory::from_scope(scope)
            ));
        }
        for scope in [
            "renderer:error",
            "renderer:performance",
            "terminal:output",
            "ssh:tab",
        ] {
            assert!(enabled_in(
                DEFAULT_MASK,
                LogLevel::Warn,
                LogCategory::from_scope(scope)
            ));
            assert!(enabled_in(
                DEFAULT_MASK,
                LogLevel::Error,
                LogCategory::from_scope(scope)
            ));
        }
        for scope in ["renderer:performance", "app:windows-performance"] {
            assert_eq!(LogCategory::from_scope(scope), LogCategory::Performance);
            assert!(!enabled_in(
                DEFAULT_MASK,
                LogLevel::Info,
                LogCategory::from_scope(scope)
            ));
            assert!(enabled_in(
                DEFAULT_MASK,
                LogLevel::Warn,
                LogCategory::from_scope(scope)
            ));
        }
    }

    #[test]
    fn saved_previous_defaults_migrate_once_without_replacing_custom_choices() {
        for mask in [
            ((1 << CATEGORIES.len()) - 1) & !(1 << 2) & !(1 << 4),
            (1 << 0) | (1 << 9) | (1 << 10) | (1 << 12),
            1 << 5,
        ] {
            let old = CATEGORIES
                .iter()
                .enumerate()
                .map(|(index, name)| ((*name).to_owned(), mask & (1 << index) != 0))
                .collect();
            assert_eq!(migrate_categories(old), default_categories());
        }
        let custom = BTreeMap::from([("connection".into(), true)]);
        assert_eq!(migrate_categories(custom.clone()), custom);
        for name in ["app", "security", "updates", "logging"] {
            assert!(enabled_in(0, LogLevel::Info, LogCategory::from_name(name)));
        }
    }

    #[test]
    fn partial_and_legacy_settings_fill_defaults_and_drop_unknown_categories() {
        let normalized = normalize_categories(BTreeMap::from([
            ("connection".into(), true),
            ("performance".into(), false),
            ("unknown".into(), true),
        ]));
        assert_eq!(normalized.len(), CATEGORIES.len());
        assert!(normalized["connection"]);
        assert!(!normalized["performance"]);
        assert!(!normalized["monitoring"]);
        assert!(!normalized["terminal"]);
        assert!(!normalized["app"]);
    }
}
