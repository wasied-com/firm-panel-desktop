// No console window next to the application on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    firm_panel_desktop_lib::run()
}
