---
title: addonova build
description: Build every configured browser target.
---

# `addonova build`

```bash
addonova build [options]
```

Builds the extension for each configured target. Production is the default mode.

## Options

| Option | Description |
| --- | --- |
| `--browser <target>` | Build a target. Repeat for multiple targets. |
| `--manifest-version <2\|3>` | Override the manifest version. |
| `--mode <mode>` | `development` or `production`. |
| `--config <path>` | Use an explicit configuration file. |
| `--outdir <path>` | Override the output directory. |
| `--minify` / `--no-minify` | Enable or disable minification. |
| `--sourcemap[=mode]` | Enable source maps or select a mode. |
| `--no-sourcemap` | Disable source maps. |
| `--browser-api <mode>` | `external` or `bundle`. |

## Examples

```bash
addonova build
addonova build --browser chrome --browser firefox
addonova build --browser chrome --mode development
addonova build --browser chrome --no-minify
addonova build --browser chrome --sourcemap=inline
addonova build --outdir release
```

## Output

```text
dist/
├── chrome/
│   ├── manifest.json
│   ├── background.js
│   └── ...
└── firefox/
    ├── manifest.json
    └── ...
```

When a browser is built for both MV2 and MV3, directories become
`dist/<browser>-mv2` and `dist/<browser>-mv3`.

## Behavior

- Discovers entrypoints unless `entrypoints` is configured.
- Runs modules and entrypoint hooks.
- Builds target assets, then generates and validates the manifest.
- Copies public assets and generated hook files.
- Fails on duplicate output names, missing entrypoints, invalid manifests, or
  missing referenced files.

## Errors

| Code | Meaning |
| --- | --- |
| `ADDONOVA_BUILD_NO_ENTRYPOINTS` | No entrypoints were found. |
| `ADDONOVA_CONFIG_ENTRYPOINT_MISSING` | An entrypoint file is missing. |
| `ADDONOVA_CONFIG_DUPLICATE_ENTRYPOINT` | Two entrypoints share an output name. |
| `ADDONOVA_MANIFEST_REFERENCE_MISSING` | A manifest file reference is missing. |
| `ADDONOVA_BUNDLER_FAILED` | The bundler failed. |
