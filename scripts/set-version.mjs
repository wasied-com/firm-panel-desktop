// Writes the computed version into the two files that carry it, for the build only (never committed).
// Usage: node scripts/set-version.mjs 1.4.0
import { readFileSync, writeFileSync } from "node:fs";

import { parseVersion } from "./version.mjs";

const version = process.argv[2] ?? "";
parseVersion(version);
const confFile = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const conf = JSON.parse(readFileSync(confFile, "utf8"));
conf.version = version;
writeFileSync(confFile, `${JSON.stringify(conf, null, 2)}\n`);
const cargoFile = new URL("../src-tauri/Cargo.toml", import.meta.url);
const cargo = readFileSync(cargoFile, "utf8");
const next = cargo.replace(/^version = "[^"]*"/m, `version = "${version}"`);
if (next === cargo && !cargo.includes(`version = "${version}"`)) throw new Error("no version line in Cargo.toml");
writeFileSync(cargoFile, next);
console.log(`version ${version}`);
