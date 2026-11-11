// Static checks of the repository, run by the CI before any build:
//   - the start page loads no inline script or style (the CSP of the window forbids them);
//   - every file the start page names exists;
//   - no long dash (U+2013, U+2014) in any text of the repository.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const problems = [];

const page = readFileSync(path.join(root, "src", "index.html"), "utf8");
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(page)) problems.push("src/index.html: inline <script>");
if (/<style\b|\sstyle="/i.test(page)) problems.push("src/index.html: inline style");
for (const [, ref] of page.matchAll(/\b(?:src|href)="([^"#:]+)"/g)) {
  if (!existsSync(path.join(root, "src", ref))) problems.push(`src/index.html names a missing file: ${ref}`);
}

const SKIP = new Set([".git", "node_modules", "target", "dist", "icons", "fixtures", "gen"]);
const TEXT = /\.(rs|toml|json|mjs|js|css|html|md|yml|yaml|svg|py)$/;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (TEXT.test(name) && /[\u2013\u2014]/.test(readFileSync(full, "utf8"))) {
      problems.push(`${path.relative(root, full)}: long dash (use "-")`);
    }
  }
}
walk(root);

for (const problem of problems) console.error(`FAIL ${problem}`);
console.log(problems.length === 0 ? "ok   repository checks" : `${problems.length} problem(s)`);
process.exit(problems.length === 0 ? 0 : 1);
