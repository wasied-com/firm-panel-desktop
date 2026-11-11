// Checks a Tauri updater signature (minisign format, Ed25519) against a public key, as an installed application
// does before it installs an update. The release is only published when every file passes (scripts/verify-release.mjs).
import { createHash, createPublicKey, verify } from "node:crypto";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Tauri stores the minisign files base64-encoded once more: decode that layer, then read the second line. */
function minisignPayload(text) {
  const decoded = Buffer.from(text.trim(), "base64").toString("utf8");
  const lines = decoded.split("\n").map((l) => l.trim());
  if (!lines[0]?.startsWith("untrusted comment:") || !lines[1]) throw new Error("not a minisign file");
  return { bytes: Buffer.from(lines[1], "base64"), trustedComment: lines[2] ?? "", globalSignature: lines[3] ?? "" };
}

export function readPublicKey(text) {
  const { bytes } = minisignPayload(text);
  if (bytes.length !== 42 || bytes.subarray(0, 2).toString("latin1") !== "Ed") throw new Error("not an Ed25519 key");
  return { keyId: bytes.subarray(2, 10), key: createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, bytes.subarray(10)]), format: "der", type: "spki" }) };
}

/** @returns {boolean} the signature is from this key and covers exactly these bytes (and its trusted comment). */
export function verifySignature(publicKeyText, signatureText, data) {
  const publicKey = readPublicKey(publicKeyText);
  const sig = minisignPayload(signatureText);
  if (sig.bytes.length !== 74) return false;
  const algorithm = sig.bytes.subarray(0, 2).toString("latin1");
  if (!sig.bytes.subarray(2, 10).equals(publicKey.keyId)) return false;
  const message = algorithm === "ED" ? createHash("blake2b512").update(data).digest() : algorithm === "Ed" ? data : null;
  if (message === null) return false;
  const signature = sig.bytes.subarray(10);
  if (!verify(null, message, publicKey.key, signature)) return false;
  // The trusted comment is signed too: signature || comment text.
  const comment = sig.trustedComment.replace(/^trusted comment:\s?/, "");
  const global = Buffer.from(sig.globalSignature, "base64");
  return verify(null, Buffer.concat([signature, Buffer.from(comment, "utf8")]), publicKey.key, global);
}
