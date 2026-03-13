// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Capture panics to stderr before the log plugin is ready
    std::panic::set_hook(Box::new(|info| {
        eprintln!("PANIC: {info}");
        // Also attempt to write to the log file (may fail if logger panicked)
        log::error!("PANIC: {info}");
    }));

    desktop_lib::run()
}
