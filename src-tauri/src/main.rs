// Use the Windows GUI subsystem in release builds so no console window opens next to the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() { md_viewer_lib::run() }
