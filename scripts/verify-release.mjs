// Proves a release before and after it is published, the way an installed application will read it.
//   node scripts/verify-release.mjs local <version>   dist/latest.json names this version, and every file it points
//                                                      to is in dist/ with a signature from the key built into the app.
//   node scripts/verify-release.mjs public <version>  the public "latest" file names this version, and every file it
//                                                      points to downloads with a valid signature.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { verifySignature } from "./minisign.mjs";

const [mode, version] = process.argv.slice(2);
if (!["local", "public"].includes(mode) || !version) throw new Error("usage: verify-release <local|public> <version>");
const root = path.resolve(import.meta.dirname, "..");
const publicKey = readFileSync(path.join(root, "assets", "updater.pub"), "utf8");
const conf = JSON.parse(readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
if (conf.plugins.updater.pubkey !== publicKey.trim()) throw new Error("the application does not carry assets/updater.pub");
const PLATFORMS = ["darwin-aarch64", "darwin-x86_64", "windows-x86_64", "linux-x86_64"];

async function fetchBytes(url) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, { redirect: "follow", cache: "no-store" });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (attempt >= 5) throw new Error(`${url}: HTTP ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }
}

const latest =
  mode === "local"
    ? JSON.parse(readFileSync(path.join(root, "dist", "latest.json"), "utf8"))
    : JSON.parse(
        (await fetchBytes(conf.plugins.updater.endpoints[0])).toString("utf8"),
      );
const problems = [];
if (latest.version !== version) problems.push(`latest.json names ${latest.version}, expected ${version}`);
for (const platform of PLATFORMS) {
  const item = latest.platforms?.[platform];
  if (!item?.url || !item?.signature) {
    problems.push(`${platform}: missing`);
    continue;
  }
  if (!item.url.includes(`/v${version}/`)) problems.push(`${platform}: ${item.url} is not in release v${version}`);
  const name = decodeURIComponent(item.url.split("/").pop());
  let data;
  if (mode === "local") {
    const file = path.join(root, "dist", name);
    if (!existsSync(file)) {
      problems.push(`${platform}: ${name} is not in dist/`);
      continue;
    }
    data = readFileSync(file);
  } else {
    data = await fetchBytes(item.url);
  }
  const ok = verifySignature(publicKey, item.signature, data);
  const digest = createHash("sha256").update(data).digest("hex").slice(0, 16);
  console.log(`${ok ? "ok  " : "FAIL"} ${platform.padEnd(15)} ${name} (${data.length} bytes, sha256 ${digest})`);
  if (!ok) problems.push(`${platform}: the signature does not match the key of the application`);
}
for (const problem of problems) console.error(`FAIL ${problem}`);
process.exit(problems.length === 0 ? 0 : 1);
