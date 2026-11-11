import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { readPublicKey, verifySignature } from "./minisign.mjs";

// A throwaway key made for this test only (`tauri signer generate`), and a file it signed (`tauri signer sign`).
const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url);
const publicKey = readFileSync(fixture("test-key.pub"), "utf8");
const signature = readFileSync(fixture("payload.bin.sig"), "utf8");
const payload = readFileSync(fixture("payload.bin"));
const releaseKey = readFileSync(new URL("../assets/updater.pub", import.meta.url), "utf8");

test("a file signed by the key passes", () => {
  assert.equal(verifySignature(publicKey, signature, payload), true);
});

test("one changed byte fails", () => {
  const tampered = Buffer.from(payload);
  tampered[0] ^= 1;
  assert.equal(verifySignature(publicKey, signature, tampered), false);
});

test("another key fails", () => {
  assert.equal(verifySignature(releaseKey, signature, payload), false);
});

test("the key of the releases is the one built into the application", () => {
  readPublicKey(releaseKey);
  const conf = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  assert.equal(conf.plugins.updater.pubkey, releaseKey.trim());
});
