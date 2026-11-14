---
title: CLI reference
description: Every Addonova command, argument, and option.
---

# CLI reference

```text
Usage:
  addonova <command> [options]
  addonova init [directory] [options]

Commands:
  init        Scaffold a new extension
  build       Build the extension
  dev         Watch sources and rebuild
  clean       Remove generated output
  info        Show environment and configuration details
  doctor      Diagnose the local build environment
  validate    Validate configuration, manifests, and locales
  pack        Package a built extension
  zip         Package a built extension as a zip archive
  analyze     Report bundle inputs, outputs, and dependencies
```

## Pages

| Command | Page |
| --- | --- |
| `init` | [init](init.md) |
| `build` | [build](build.md) |
| `dev` | [dev](dev.md) |
| `clean` | [clean](clean.md) |
| `info` | [info](info.md) |
| `doctor` | [doctor](doctor.md) |
| `validate` | [validate](validate.md) |
| `pack` | [pack](pack.md) |
| `zip` | [zip](zip.md) |
| `analyze` | [analyze](analyze.md) |

## Global options

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
| `--include <glob>` | Include matching files when packing. Repeatable. |
| `--exclude <glob>` | Exclude matching files when packing. Repeatable. |
| `--sources` | Also pack a Firefox source archive. |
| `--json` | Print JSON output from `analyze` or `doctor`. |
| `--verbose` | Print stack traces on failure. |
| `--debug` | Emit structured dev diagnostics to stderr. |
| `--no-color` | Disable colored output. |
| `-h`, `--help` | Show help. |
| `-V`, `--version` | Show the Addonova version. |

## Exit status

`0` means success. Any failure returns `1`. See [exit codes](../exit-codes.md).
