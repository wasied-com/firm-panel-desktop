//! Desktop shell of the firm panel.
//!
//! One window, on the hosted application. The shell itself holds no business code: the application is the web page,
//! deployed on its own, so every change to it reaches the window on the next load. The shell keeps itself up to date
//! through the signed updater (see `startup` and `background_updates`).
//!
//! Security: the window has no IPC capability at all (`app.security.capabilities` is empty), so the hosted page cannot
//! call into the shell. The local start page is driven from Rust with `eval`, never the other way round.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::webview::{DownloadEvent, PageLoadEvent};
use tauri::{AppHandle, Manager, RunEvent, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_updater::{Update, UpdaterExt};
use url::Url;

/// Address of the hosted application, fixed at build time (`FIRM_PANEL_URL`), with the production one by default.
pub const APP_URL: &str = match option_env!("FIRM_PANEL_URL") {
    Some(url) => url,
    None => "https://panel-cabinet.wasied.net",
};

const WINDOW_LABEL: &str = "main";
const WINDOW_TITLE: &str = "Panel du cabinet";
/// The start of the application waits at most this long for the release server before it opens the page anyway.
const STARTUP_UPDATE_TIMEOUT: Duration = Duration::from_secs(8);
/// While the window stays open (for days, on a Mac), the shell looks for a new version this often.
const BACKGROUND_CHECK_EVERY: Duration = Duration::from_secs(4 * 60 * 60);

/// The start sequence runs once per process, on the first load of the local start page.
static STARTED: AtomicBool = AtomicBool::new(false);

/// An update downloaded while the window was open, installed when the application quits (macOS and Linux).
#[derive(Default)]
struct PendingUpdate(Mutex<Option<(Update, Vec<u8>)>>);

/// The origin of the hosted application: scheme, host and port.
fn app_origin() -> url::Origin {
    Url::parse(APP_URL)
        .expect("FIRM_PANEL_URL is a valid absolute URL")
        .origin()
}

/// The local start page: `tauri://localhost` on macOS and Linux, `http://tauri.localhost` on Windows.
fn is_local(url: &Url) -> bool {
    url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost")
}

/// What may load inside the window: the start page, the hosted application and the documents it generates.
/// Everything else (a link to a website, a mail address) opens in the default browser or mail client.
pub fn stays_in_window(url: &Url) -> bool {
    is_local(url) || url.origin() == app_origin() || matches!(url.scheme(), "about" | "blob" | "data")
}

/// A file name that does not overwrite one already in the folder: `statement.xlsx`, then `statement (2).xlsx`.
pub fn free_destination(folder: &Path, file_name: &str) -> PathBuf {
    let candidate = folder.join(file_name);
    if !candidate.exists() {
        return candidate;
    }
    let path = Path::new(file_name);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("document");
    let extension = path.extension().and_then(|s| s.to_str());
    (2..10_000)
        .map(|n| match extension {
            Some(ext) => folder.join(format!("{stem} ({n}).{ext}")),
            None => folder.join(format!("{stem} ({n})")),
        })
        .find(|p| !p.exists())
        .unwrap_or(candidate)
}

/// Runs a script in the start page. The page may already have left (the application is open): nothing to do then.
fn tell_start_page<R: Runtime>(window: &WebviewWindow<R>, script: &str) {
    let on_start_page = window.url().map(|u| is_local(&u)).unwrap_or(false);
    if on_start_page {
        let _ = window.eval(script);
    }
}

/// Start of the application: install a waiting update first (a few seconds, then a restart on the new version), then
/// open the hosted application. A release server that does not answer never keeps the firm out of its panel.
async fn startup<R: Runtime>(app: AppHandle<R>, window: WebviewWindow<R>) {
    let updater = app.updater_builder().timeout(STARTUP_UPDATE_TIMEOUT).build();
    if let Ok(updater) = updater {
        if let Ok(Some(update)) = updater.check().await {
            tell_start_page(&window, "window.firmPanel.phase('update')");
            if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
                app.restart();
            }
        }
    }
    let target = serde_json::to_string(APP_URL).expect("a string serialises");
    tell_start_page(&window, &format!("window.firmPanel.open({target})"));
}

/// While the window stays open: download a new version in the background. macOS and Linux install it when the
/// application quits; Windows installs it at the next start (its installer would close the window under the user).
fn background_updates<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(BACKGROUND_CHECK_EVERY);
        let pending = app.state::<PendingUpdate>();
        if pending.0.lock().map(|p| p.is_some()).unwrap_or(true) {
            continue;
        }
        let Ok(updater) = app.updater() else { continue };
        let found = tauri::async_runtime::block_on(async {
            let update = updater.check().await.ok()??;
            let bytes = update.download(|_, _| {}, || {}).await.ok()?;
            Some((update, bytes))
        });
        let Some(found) = found else { continue };
        if let Ok(mut slot) = pending.0.lock() {
            *slot = Some(found);
        };
    });
}

fn open_outside<R: Runtime>(app: &AppHandle<R>, url: &Url) {
    use tauri_plugin_opener::OpenerExt;
    let _ = app.opener().open_url(url.as_str(), None::<&str>);
}

fn build_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    let for_navigation = app.clone();
    WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::App("index.html".into()))
        .title(WINDOW_TITLE)
        .inner_size(1440.0, 900.0)
        .min_inner_size(1024.0, 680.0)
        .center()
        .on_navigation(move |url| {
            if stays_in_window(url) {
                return true;
            }
            open_outside(&for_navigation, url);
            false
        })
        .on_page_load(|window, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished)
                && is_local(payload.url())
                && !STARTED.swap(true, Ordering::SeqCst)
            {
                let app = window.app_handle().clone();
                tauri::async_runtime::spawn(startup(app, window));
            }
        })
        .on_download(|webview, event| {
            // A document of the application (a statement, an export) goes to the Downloads folder, under a free name,
            // and the folder opens on it once it is written.
            if let DownloadEvent::Requested { url, destination } = event {
                let name = destination
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .filter(|n| !n.is_empty())
                    .or_else(|| url.path_segments()?.next_back().map(str::to_owned))
                    .unwrap_or_else(|| "document".to_owned());
                if let Ok(folder) = webview.app_handle().path().download_dir() {
                    *destination = free_destination(&folder, &name);
                }
            } else if let DownloadEvent::Finished {
                path: Some(path),
                success: true,
                ..
            } = event
            {
                let _ = tauri_plugin_opener::reveal_item_in_dir(path);
            }
            true
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // First: a second launch brings the open window to the front instead of opening another one.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(PendingUpdate::default())
        .setup(|app| {
            build_window(app.handle())?;
            background_updates(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("the application starts");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            if cfg!(target_os = "windows") {
                return;
            }
            let taken = app.state::<PendingUpdate>().0.lock().ok().and_then(|mut p| p.take());
            if let Some((update, bytes)) = taken {
                let _ = update.install(bytes);
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn the_hosted_application_and_the_start_page_stay_in_the_window() {
        assert!(stays_in_window(&url(APP_URL)));
        assert!(stays_in_window(&url(&format!("{APP_URL}/closing?engagement=12"))));
        assert!(stays_in_window(&url("tauri://localhost/index.html")));
        assert!(stays_in_window(&url("http://tauri.localhost/index.html")));
        assert!(stays_in_window(&url("blob:https://panel-cabinet.wasied.net/0a1b")));
    }

    #[test]
    fn any_other_address_leaves_the_window() {
        assert!(!stays_in_window(&url("https://www.google.com/")));
        assert!(!stays_in_window(&url("mailto:someone@example.com")));
        // Same host name on another scheme or port is another origin.
        let other_port = {
            let mut u = url(APP_URL);
            u.set_port(Some(8443)).unwrap();
            u
        };
        assert!(!stays_in_window(&other_port));
        let mut plain = url(APP_URL);
        plain.set_scheme("http").unwrap();
        assert!(!stays_in_window(&plain));
        // A look-alike host is not the application.
        assert!(!stays_in_window(&url("https://panel-cabinet.wasied.net.example.com/")));
    }

    #[test]
    fn a_download_never_overwrites_a_file() {
        let folder = std::env::temp_dir().join(format!("fpd-test-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        assert_eq!(
            free_destination(&folder, "statement.xlsx"),
            folder.join("statement.xlsx")
        );
        std::fs::write(folder.join("statement.xlsx"), b"1").unwrap();
        assert_eq!(
            free_destination(&folder, "statement.xlsx"),
            folder.join("statement (2).xlsx")
        );
        std::fs::write(folder.join("statement (2).xlsx"), b"2").unwrap();
        assert_eq!(
            free_destination(&folder, "statement.xlsx"),
            folder.join("statement (3).xlsx")
        );
        std::fs::write(folder.join("README"), b"3").unwrap();
        assert_eq!(free_destination(&folder, "README"), folder.join("README (2)"));
        std::fs::remove_dir_all(&folder).unwrap();
    }
}
