#!/bin/sh
# Point this clone's git hooks at the versioned .githooks/ directory. Run once per clone
# (git cannot do it on clone). Hook: pre-push = the English-only gate (see CLAUDE.md).
set -e
git config core.hooksPath .githooks
chmod +x .githooks/pre-push 2>/dev/null || true
echo "Hooks installed (core.hooksPath=.githooks): pre-push refuses French added to code."
