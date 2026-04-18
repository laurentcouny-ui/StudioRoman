// Prevents extra console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(windows)]
    {
        if let Err(msg) = scriptor_lib::webview2::ensure_runtime_or_fail() {
            scriptor_lib::webview2::show_webview2_help(&msg);
            std::process::exit(1);
        }
    }

    scriptor_lib::run();
}
