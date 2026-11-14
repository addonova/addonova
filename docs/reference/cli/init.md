---
title: addonova init
description: Scaffold a new extension from a bundled or remote template.
---

# `addonova init`

```bash
addonova init [directory] [options]
```

Creates a project without loading an existing configuration. The default
directory is derived from the template.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `-t`, `--template <name>` | `vanilla-ts` | Bundled template, alias, or `gh:` source. |
| `--pm <manager>` | detected | `npm`, `pnpm`, `yarn`, or `bun`. |
| `--git` / `--no-git` | enabled | Initialize a git repository. |
| `--force` | false | Scaffold into a non-empty directory. |
| `--offline` | false | Use bundled templates only. |

Bundled templates: `vanilla-ts`, `vanilla-js`, `react`. The alias `vanilla`
maps to `vanilla-ts`. Remote templates use
`gh:owner/repo[/path][#ref]`.

## Examples

```bash
addonova init my-extension
addonova init my-extension --template react
addonova init my-extension --template vanilla-js --pm pnpm
addonova init my-extension --template gh:owner/repo/templates/react
addonova init existing --force --offline
```

## Behavior

- Refuses a non-empty directory unless `--force` is passed.
- Writes template files, `package.json`, locales, and an Addonova config.
- Installs nothing; it prints the next install command.
- Runs `git init` unless `--no-git` is passed.

## Errors

| Code | Meaning |
| --- | --- |
| `ADDONOVA_INIT_DIRECTORY_NOT_EMPTY` | Target directory has files. |
| `ADDONOVA_INIT_TEMPLATE_UNKNOWN` | Template name is not bundled or valid. |
| `ADDONOVA_INIT_DOWNLOAD_FAILED` | Remote template download failed. |
| `ADDONOVA_INIT_OFFLINE` | A remote template was requested with `--offline`. |
