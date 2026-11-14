---
title: addonova validate
description: Validate configuration, manifests, and locales without writing output.
---

# `addonova validate`

```bash
addonova validate [options]
```

Runs the same configuration, manifest, locale, and referenced-file checks as a
build, but writes nothing.

## Options

| Option | Description |
| --- | --- |
| `--browser <target>` | Validate a target. Repeat for multiple targets. |
| `--manifest-version <2\|3>` | Override the manifest version. |
| `--config <path>` | Use an explicit configuration file. |

## Examples

```bash
addonova validate
addonova validate --browser chrome --browser firefox
addonova validate --manifest-version 2
```

## Checks

- Configuration shape and unknown fields.
- Entrypoint existence and duplicate output names.
- Manifest required fields, target fields, permissions, and background shape.
- Manifest file references against the final output list.
- `_locales` collection, duplicate locales, `default_locale`, and `__MSG_`
  references.

## Common errors

| Code | Meaning |
| --- | --- |
| `ADDONOVA_CONFIG_INVALID` | Configuration failed validation. |
| `ADDONOVA_MANIFEST_REQUIRED_FIELD` | Name or version is missing. |
| `ADDONOVA_MANIFEST_REFERENCE_MISSING` | A referenced file is missing. |
| `ADDONOVA_MANIFEST_LOCALES_MISSING` | Locales exist but `default_locale` is missing. |
| `ADDONOVA_LOCALES_DUPLICATE` | A locale is defined twice. |
