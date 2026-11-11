# Panel du cabinet (desktop)

Desktop application (Windows, macOS, Linux) of the firm panel. It holds no business code: it opens one window on the
hosted application (`FIRM_PANEL_URL`, `https://panel-cabinet.wasied.net` by default) and keeps itself up to date.

## Download

| System | Installer |
| --- | --- |
| Windows 10 and 11 | [Panel-du-cabinet-windows-setup.exe](https://github.com/wasied-com/firm-panel-desktop/releases/latest/download/Panel-du-cabinet-windows-setup.exe) |
| macOS 11 and later (Apple silicon and Intel) | [Panel-du-cabinet-macos.dmg](https://github.com/wasied-com/firm-panel-desktop/releases/latest/download/Panel-du-cabinet-macos.dmg) |
| Linux (x86_64) | [Panel-du-cabinet-linux.AppImage](https://github.com/wasied-com/firm-panel-desktop/releases/latest/download/Panel-du-cabinet-linux.AppImage) |

These links always give the latest release.

## How it stays up to date

- **The application itself** (screens, rules, everything the firm sees) is the hosted web application: each deployment
  of `wasied-com/firm-panel` reaches every window at its next load, without any install.
- **This shell** updates through the signed Tauri updater. At start it reads
  `releases/latest/download/latest.json` (8 s at most, then it opens the panel anyway); a newer version is downloaded,
  checked against the public key built into the application (`assets/updater.pub`), installed, and the application
  restarts on it. While the window stays open, it checks every 4 hours: macOS and Linux install on quit, Windows at the
  next start.

## Release pipeline

`.github/workflows/release.yml`, on every push to `main`:

1. **check**: repository checks, release script tests, `cargo fmt`, `cargo clippy -D warnings`, `cargo test`.
2. **version**: computed from the commits since the last tag (`scripts/version.mjs`, Conventional Commits: `feat` minor,
   `fix`/`perf`/`security`/`refactor`/`revert` patch, `!` major, `ci`/`docs`/`chore`/`test`/`build`/`style` no release;
   `Release-As: X.Y.Z` trailer to force). No releasable commit, no release.
3. **build**: macOS universal (`.dmg` + updater archive), Windows x64 (NSIS, per-user install, no admin rights), Linux
   (`.AppImage` + `.deb`), each signed with the updater key.
4. **publish**: `latest.json` is written, every file is verified against `assets/updater.pub`, the release is created
   as a draft, filled, then made public.
5. **verify**: the public `latest.json` is read back and every file it names is downloaded and verified again.

Secrets live in the `production` environment (deployments from `main` only): `TAURI_SIGNING_PRIVATE_KEY`,
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and for a signed and notarised macOS build `APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_P8`.
Without the Apple secrets the macOS build is signed ad hoc.

## Security

- The window has no IPC capability: the hosted page cannot call into the shell.
- Only the start page and the origin of `FIRM_PANEL_URL` load inside the window; any other link opens in the default
  browser.
- Downloads go to the Downloads folder under a name that never overwrites a file.

## Development

```sh
npm ci
npm run check && npm test
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
FIRM_PANEL_URL=http://localhost:5173 npx tauri dev   # against a local panel
```

Icons: `python3 scripts/draw-icon.py && npx tauri icon assets/icon.png -o src-tauri/icons`.
