---
title: CLI overview
description: Every Addonova command at a glance.
---

# CLI overview

```bash
addonova <command> [options]
addonova init [directory] [options]
```

## Commands

| Command | Purpose |
| --- | --- |
| `init [directory]` | Scaffold a new extension from a bundled or remote template. |
| `build` | Build every configured browser target. |
| `dev` | Watch sources, rebuild, and preserve the last successful output. |
| `clean` | Stop the bundler service and remove generated output. |
| `info` | Print environment, configuration, targets, and entrypoints. |
| `doctor` | Diagnose Node.js, Guchho, configuration, browsers, and the browser API package. |
| `validate` | Validate configuration, manifests, and locales without writing output. |
| `pack` | Package a previously built extension. |
| `zip` | Package a previously built extension as a ZIP archive. |
| `analyze` | Report bundle inputs, outputs, dependencies, and total size. |

## Common options

| Option | Description |
| --- | --- |
| `--browser <target>` | Select a target. Repeat for multiple targets. |
| `--manifest-version <2\|3>` | Override the manifest version. |
| `--mode <mode>` | `development` or `production`. |
| `--config <path>` | Use an explicit configuration file. |
| `--outdir <path>` | Override the output directory. |
| `--minify` / `--no-minify` | Enable or disable minification. |
| `--sourcemap[=mode]` | Enable source maps or select a mode. |
| `--no-sourcemap` | Disable source maps. |
| `--browser-api <mode>` | `external` or `bundle`. |
| `--include <glob>` | Include files when packing. Repeatable. |
| `--exclude <glob>` | Exclude files when packing. Repeatable. |
| `--sources` | Also pack a Firefox source archive. |
| `--json` | Print JSON output from `analyze` or `doctor`. |
| `--verbose` | Print stack traces on failure. |
| `--debug` | Emit structured dev diagnostics to stderr. |
| `--no-color` | Disable colored output. |
| `-h`, `--help` | Show help. |
| `-V`, `--version` | Show the Addonova version. |

## Examples

```bash
npx addonova init my-extension --template react
npx addonova dev --browser chrome
npx addonova build --browser chrome --browser firefox
npx addonova validate
npx addonova analyze --json
npx addonova pack --sources
```

Per-command flags and examples live in the [CLI reference](../reference/cli/README.md).

Next: [Entrypoints](entrypoints.md).
