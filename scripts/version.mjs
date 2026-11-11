// The version of a release is computed from the commits, never typed (Conventional Commits):
//   feat -> minor; fix, perf, security, refactor, revert -> patch; ci, docs, test, chore, build, style -> no release;
//   "type!:" or a "BREAKING CHANGE:" footer -> major; a "Release-As: X.Y.Z" trailer forces that version.
// The first release of the repository is 0.1.0.

const PATCH_TYPES = new Set(["fix", "perf", "security", "refactor", "revert"]);
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const HEADER = /^(?<type>[a-z]+)(?:\([^)]*\))?(?<bang>!)?:\s/;

export function parseVersion(text) {
  const match = SEMVER.exec(text);
  if (!match) throw new Error(`not a version: ${text}`);
  return match.slice(1, 4).map(Number);
}

/** The level a commit asks for: 3 major, 2 minor, 1 patch, 0 none. */
export function levelOf(message) {
  const [header = "", ...rest] = message.trim().split("\n");
  const match = HEADER.exec(header);
  if (/^BREAKING[ -]CHANGE:/m.test(rest.join("\n"))) return 3;
  if (!match) return 0;
  if (match.groups.bang) return 3;
  if (match.groups.type === "feat") return 2;
  return PATCH_TYPES.has(match.groups.type) ? 1 : 0;
}

/**
 * @param {string | null} previous the version of the last release, null before the first one
 * @param {string[]} messages the full messages of the commits since that release
 * @returns {{ release: boolean, version: string | null, previous: string | null }}
 */
export function nextVersion(previous, messages) {
  const forced = messages
    .map((m) => /^Release-As:\s*(\d+\.\d+\.\d+)\s*$/m.exec(m)?.[1])
    .filter(Boolean);
  if (forced.length > 0) {
    const version = forced[0];
    if (previous !== null && compare(parseVersion(version), parseVersion(previous)) <= 0) {
      throw new Error(`Release-As ${version} is not above the last release ${previous}`);
    }
    return { release: true, version, previous };
  }
  const level = Math.max(0, ...messages.map(levelOf));
  if (level === 0) return { release: false, version: null, previous };
  if (previous === null) return { release: true, version: "0.1.0", previous };
  const [major, minor, patch] = parseVersion(previous);
  const version =
    level === 3 ? `${major + 1}.0.0` : level === 2 ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
  return { release: true, version, previous };
}

function compare(a, b) {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
