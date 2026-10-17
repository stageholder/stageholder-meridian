use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind, RotationStrategy};
use log::LevelFilter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first so a second launch focuses the existing
        // window instead of opening a duplicate one. With the `deep-link`
        // feature it also forwards a `meridian://auth/callback?...` launch
        // (Windows/Linux deliver deep links as a second process) to the
        // running instance; macOS delivers them to it natively.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        // Sign-in runs in the SYSTEM browser (RFC 8252); Hub redirects back to
        // `meridian://auth/callback`, which the webview picks up via the JS
        // `onOpenUrl`/`getCurrent` API (`apps/pwa/src/lib/desktop-auth.ts`).
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::LogDir {
                        file_name: Some("meridian".into()),
                    }),
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Webview),
                ])
                .max_file_size(5_000_000) // 5 MB per file
                .rotation_strategy(RotationStrategy::KeepOne)
                .level(LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|_app| {
            log::info!("Meridian desktop app started");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
