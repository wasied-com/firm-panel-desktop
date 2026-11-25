# firm-panel-desktop - rules for sessions

The pre-push hook (`.githooks/pre-push`) runs `~/.claude/shared/hooks/no-new-french.py` and refuses French ADDED to code (comments, identifiers, file names, JSON keys, internal log and error strings); text shown to people stays French; a real exception takes `lang-ok: <reason> (YYYY-MM-DD)` on the line, reviewed (2026-11-25).
