---
title: Exit codes
description: What Addonova returns to the shell.
---

# Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. Warnings may still have been printed. |
| `1` | Failure. A command or diagnostic reported an error. |

## Behavior

- Argument parsing errors return `1`.
- Configuration, build, manifest, locale, and packaging errors return `1`.
- `doctor` returns `1` when a required check fails; missing browsers are
  warnings and do not fail the command.
- `validate` returns `1` when any error-severity diagnostic is found.
- `dev` keeps running after build or launcher warnings; it exits non-zero only
  when the session itself fails.

Warnings alone do not change the exit code.
