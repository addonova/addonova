---
title: addonova doctor
description: Diagnose Node.js, Guchho, configuration, browsers, and the browser API package.
---

# `addonova doctor`

```bash
addonova doctor [--json] [options]
```

Checks the local build environment and reports `ok`, `warn`, `fail`, and `skip`
statuses.

## Options

| Option | Description |
| --- | --- |
| `--json` | Print a machine-readable report. |
| `--config <path>` | Use an explicit configuration file. |

## Examples

```bash
addonova doctor
addonova doctor --json
addonova doctor --config ./configs/ci.ts
```

## Checks

- Node.js version against the package engine range.
- Guchho resolution.
- Configuration discovery and parsing.
- Entrypoint discovery.
- Browser binaries for every configured target.
- `@addonova/browser` when `browserApi` is `bundle`.

## Status behavior

- Missing browsers are `warn`.
- Missing required dependencies are `fail` and exit with code 1.
- JSON output includes each check, its status, message, suggestion, and a
  summary.

## Example JSON

```json
{
  "ok": true,
  "checks": [
    {
      "id": "node",
      "label": "Node.js",
      "status": "ok",
      "message": "Node.js 20.11.0 satisfies >=20"
    }
  ],
  "summary": { "passed": 1, "warnings": 0, "failures": 0, "skipped": 0 }
}
```
