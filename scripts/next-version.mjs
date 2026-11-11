// Prints the release decision of HEAD as JSON: {"release": true, "version": "1.4.0", "previous": "1.3.2"}.
// Reads the last tag vX.Y.Z reachable from HEAD and every commit message since. The CI writes the result to
// $GITHUB_OUTPUT when that variable is set.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

import { nextVersion } from "./version.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

let previousTag = null;
try {
  previousTag = git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*.[0-9]*.[0-9]*", "HEAD").trim();
} catch {
  previousTag = null;
}
const range = previousTag === null ? ["HEAD"] : [`${previousTag}..HEAD`];
const messages = git("log", "--format=%B%x00", ...range)
  .split("\0")
  .map((m) => m.trim())
  .filter(Boolean);
const decision = nextVersion(previousTag === null ? null : previousTag.slice(1), messages);
const line = JSON.stringify(decision);
console.log(line);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `release=${decision.release}\nversion=${decision.version ?? ""}\nprevious=${decision.previous ?? ""}\n`,
  );
}
