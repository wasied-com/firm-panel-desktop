fn main() {
    // The address of the hosted application is fixed at build time (see src/lib.rs, APP_URL).
    println!("cargo:rerun-if-env-changed=FIRM_PANEL_URL");
    tauri_build::build()
}
