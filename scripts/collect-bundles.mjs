// Gathers what `tauri build` produced for one platform into dist/, under stable ASCII names:
//   versioned names for the release page, and an unversioned copy of the installer so that
//   https://github.com/wasied-com/firm-panel-desktop/releases/latest/download/<name> always gives the newest one.
// Usage: node scripts/collect-bundles.mjs <macos|windows|linux> <version> <rust target>
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const [platform, version, target] = process.argv.slice(2);
if (!["macos", "windows", "linux"].includes(platform) || !version || !target) {
  throw new Error("usage: collect-bundles <macos|windows|linux> <version> <rust target>");
}
const root = path.resolve(import.meta.dirname, "..");
const bundle = path.join(root, "src-tauri", "target", target, "release", "bundle");
const dist = path.join(root, "dist");
mkdirSync(dist, { recursive: true });
const base = `Panel-du-cabinet-${version}`;

/** The one file of `folder` whose name ends with `suffix`: none or several is a broken build. */
function single(folder, suffix) {
  const dir = path.join(bundle, folder);
  const found = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(suffix)) : [];
  if (found.length !== 1) throw new Error(`expected one *${suffix} in ${dir}, found ${found.length}: ${found.join(", ")}`);
  return path.join(dir, found[0]);
}

function put(source, name) {
  copyFileSync(source, path.join(dist, name));
  console.log(`${name}  <-  ${path.relative(root, source)}`);
}

if (platform === "macos") {
  put(single("dmg", ".dmg"), `${base}-macos-universal.dmg`);
  put(single("dmg", ".dmg"), "Panel-du-cabinet-macos.dmg");
  put(single("macos", ".app.tar.gz"), `${base}-macos-universal.app.tar.gz`);
  put(single("macos", ".app.tar.gz.sig"), `${base}-macos-universal.app.tar.gz.sig`);
} else if (platform === "windows") {
  put(single("nsis", "-setup.exe"), `${base}-windows-x64-setup.exe`);
  put(single("nsis", "-setup.exe"), "Panel-du-cabinet-windows-setup.exe");
  put(single("nsis", "-setup.exe.sig"), `${base}-windows-x64-setup.exe.sig`);
} else {
  put(single("appimage", ".AppImage"), `${base}-linux-x86_64.AppImage`);
  put(single("appimage", ".AppImage"), "Panel-du-cabinet-linux.AppImage");
  put(single("appimage", ".AppImage.sig"), `${base}-linux-x86_64.AppImage.sig`);
  put(single("deb", ".deb"), `${base}-linux-amd64.deb`);
}
