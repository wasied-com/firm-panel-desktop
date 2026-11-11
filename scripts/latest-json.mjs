// Writes dist/latest.json, the file every installed application reads to learn about a new version
// (Tauri updater, static JSON format), from the signatures collected in dist/.
// Usage: node scripts/latest-json.mjs <version> <notes file>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [version, notesFile] = process.argv.slice(2);
if (!version || !notesFile) throw new Error("usage: latest-json <version> <notes file>");
const dist = path.resolve(import.meta.dirname, "..", "dist");
const download = `https://github.com/wasied-com/firm-panel-desktop/releases/download/v${version}`;
const base = `Panel-du-cabinet-${version}`;

function entry(file) {
  return {
    signature: readFileSync(path.join(dist, `${file}.sig`), "utf8").trim(),
    url: `${download}/${file}`,
  };
}

const mac = entry(`${base}-macos-universal.app.tar.gz`);
const latest = {
  version,
  notes: readFileSync(notesFile, "utf8").trim(),
  pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  platforms: {
    "darwin-aarch64": mac,
    "darwin-x86_64": mac,
    "windows-x86_64": entry(`${base}-windows-x64-setup.exe`),
    "linux-x86_64": entry(`${base}-linux-x86_64.AppImage`),
  },
};
writeFileSync(path.join(dist, "latest.json"), `${JSON.stringify(latest, null, 2)}\n`);
console.log(JSON.stringify(Object.keys(latest.platforms)));
