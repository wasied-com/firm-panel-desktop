import assert from "node:assert/strict";
import { test } from "node:test";

import { levelOf, nextVersion } from "./version.mjs";

test("the type of each commit is its level", () => {
  assert.equal(levelOf("feat: download folder opens on the file"), 2);
  assert.equal(levelOf("feat(updater): background check"), 2);
  assert.equal(levelOf("fix: retry after a timeout"), 1);
  assert.equal(levelOf("perf: smaller binary"), 1);
  assert.equal(levelOf("security(csp): no inline script"), 1);
  for (const none of ["ci: cache cargo", "docs: readme", "chore: bump", "test: more", "build: lto", "style: fmt"]) {
    assert.equal(levelOf(none), 0, none);
  }
  assert.equal(levelOf("feat!: new window"), 3);
  assert.equal(levelOf("refactor: x\n\nBREAKING CHANGE: the URL moves"), 3);
  assert.equal(levelOf("Merge branch 'x'"), 0);
});

test("the next version follows the highest level since the last release", () => {
  assert.deepEqual(nextVersion("1.3.2", ["fix: a", "docs: b"]), { release: true, version: "1.3.3", previous: "1.3.2" });
  assert.deepEqual(nextVersion("1.3.2", ["fix: a", "feat: b"]), { release: true, version: "1.4.0", previous: "1.3.2" });
  assert.deepEqual(nextVersion("1.3.2", ["feat!: a"]), { release: true, version: "2.0.0", previous: "1.3.2" });
  assert.deepEqual(nextVersion("1.3.2", ["ci: a", "chore: b"]), { release: false, version: null, previous: "1.3.2" });
  assert.deepEqual(nextVersion("1.3.2", []), { release: false, version: null, previous: "1.3.2" });
});

test("the first release is 0.1.0", () => {
  assert.deepEqual(nextVersion(null, ["feat: first window"]), { release: true, version: "0.1.0", previous: null });
  assert.deepEqual(nextVersion(null, ["chore: init"]), { release: false, version: null, previous: null });
});

test("a Release-As trailer forces the version, never backwards", () => {
  assert.equal(nextVersion("1.3.2", ["chore: x\n\nRelease-As: 2.0.0"]).version, "2.0.0");
  assert.throws(() => nextVersion("1.3.2", ["fix: x\n\nRelease-As: 1.3.2"]), /not above/);
});
