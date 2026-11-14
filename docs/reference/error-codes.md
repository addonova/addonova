---
title: Error codes
description: Stable ADDONOVA_* diagnostics, grouped by area.
---

# Error codes

Error codes are part of the public interface. Do not rename them in patch
releases. Diagnostics also carry a severity, message, optional location, and an
optional suggestion.

## CLI

| Code | Meaning |
| --- | --- |
| `ADDONOVA_CLI_INVALID_VALUE` | An option received an invalid value. |
| `ADDONOVA_CLI_MISSING_VALUE` | An option that requires a value was omitted. |
| `ADDONOVA_CLI_UNEXPECTED_ARGUMENT` | Unexpected positional argument. |
| `ADDONOVA_CLI_UNKNOWN_COMMAND` | Unknown command. |
| `ADDONOVA_CLI_UNKNOWN_OPTION` | Unknown option. |

## Configuration

| Code | Meaning |
| --- | --- |
| `ADDONOVA_CONFIG_NOT_FOUND` | Explicit configuration file does not exist. |
| `ADDONOVA_CONFIG_LOAD_FAILED` | Configuration threw during loading. |
| `ADDONOVA_CONFIG_INVALID` | Configuration shape is invalid. |
| `ADDONOVA_CONFIG_BROWSER` | Invalid browser target. |
| `ADDONOVA_CONFIG_BROWSER_API` | Invalid browser API configuration. |
| `ADDONOVA_CONFIG_ENTRYPOINTS` | Invalid entrypoints configuration. |
| `ADDONOVA_CONFIG_ENTRYPOINT_MISSING` | Entrypoint file is missing. |
| `ADDONOVA_CONFIG_DUPLICATE_ENTRYPOINT` | Duplicate output name. |
| `ADDONOVA_CONFIG_MANIFEST` | Invalid manifest configuration. |
| `ADDONOVA_CONFIG_HOOKS` | Invalid hooks configuration. |
| `ADDONOVA_CONFIG_MODULES` | Invalid modules configuration. |
| `ADDONOVA_CONFIG_PACK` | Invalid pack configuration. |

## Build and bundler

| Code | Meaning |
| --- | --- |
| `ADDONOVA_BUILD_NO_ENTRYPOINTS` | No entrypoints were found. |
| `ADDONOVA_BUNDLER_ENTRYPOINT_DUPLICATE` | Duplicate bundler entrypoint. |
| `ADDONOVA_BUNDLER_ENTRYPOINT_INVALID` | Invalid bundler entrypoint. |
| `ADDONOVA_BUNDLER_NO_ENTRYPOINTS` | Bundler received no entrypoints. |
| `ADDONOVA_BUNDLER_FAILED` | Build failed. |
| `ADDONOVA_BUNDLER_ERROR` | Bundler error. |
| `ADDONOVA_BUNDLER_WARNING` | Bundler warning. |
| `ADDONOVA_BUNDLER_SERVICE_FAILED` | Bundler service failed. |
| `ADDONOVA_GENERATED_ASSET_INVALID` | Hook-generated asset path is invalid. |
| `ADDONOVA_PUBLIC_SKIPPED` | Public file collided with generated output. |
| `ADDONOVA_PUBLIC_SYMLINK_SKIPPED` | Public symlink was skipped. |

## Manifest

| Code | Meaning |
| --- | --- |
| `ADDONOVA_MANIFEST_REQUIRED_FIELD` | Missing name or version. |
| `ADDONOVA_MANIFEST_INVALID_FIELD` | Invalid manifest field. |
| `ADDONOVA_MANIFEST_REFERENCE_MISSING` | Referenced file is missing. |
| `ADDONOVA_MANIFEST_REFERENCE_INVALID` | Referenced path is invalid. |
| `ADDONOVA_MANIFEST_VERSION` | Invalid or unsupported manifest version. |
| `ADDONOVA_MANIFEST_DEPRECATED_VERSION` | MV2 is deprecated for the target. |
| `ADDONOVA_MANIFEST_BACKGROUND_VERSION` | Background shape does not match the version. |
| `ADDONOVA_MANIFEST_ACTION_VERSION` | `action`/`browser_action` mismatch. |
| `ADDONOVA_MANIFEST_CONTENT_SCRIPT_MATCHES` | Missing or invalid matches. |
| `ADDONOVA_MANIFEST_CONTENT_SCRIPT_WORLD` | Invalid content script world. |
| `ADDONOVA_MANIFEST_PERMISSION` | Permission is not valid for the target. |
| `ADDONOVA_MANIFEST_TARGET_FIELD` | Field is browser-specific. |
| `ADDONOVA_MANIFEST_OVERRIDE_UNKNOWN` | Unknown URL override. |
| `ADDONOVA_MANIFEST_SIDEPANEL_UNSUPPORTED` | Side panel not supported by target. |
| `ADDONOVA_MANIFEST_EXTERNAL_REFERENCE` | External manifest reference. |
| `ADDONOVA_MANIFEST_CONVERTED` | Field was converted between versions. |
| `ADDONOVA_MANIFEST_ICON_DISCOVERY` | Icon discovery warning. |

## Locales

| Code | Meaning |
| --- | --- |
| `ADDONOVA_LOCALES_INVALID` | Locale source is invalid. |
| `ADDONOVA_LOCALES_DUPLICATE` | Locale is defined by both source layouts. |
| `ADDONOVA_MANIFEST_DEFAULT_LOCALE` | Missing or invalid `default_locale`. |
| `ADDONOVA_MANIFEST_LOCALES_MISSING` | Locales exist but `default_locale` is missing. |
| `ADDONOVA_MANIFEST_LOCALE_MESSAGE_MISSING` | `__MSG_` key is missing. |

## Hooks, modules, and plugins

| Code | Meaning |
| --- | --- |
| `ADDONOVA_HOOK_FAILED` | A lifecycle hook threw. |
| `ADDONOVA_MODULE_LOAD_FAILED` | Module could not be imported. |
| `ADDONOVA_MODULE_INVALID` | Invalid module default export. |
| `ADDONOVA_MODULE_SETUP_FAILED` | Module setup threw. |
| `ADDONOVA_MODULE_DUPLICATE` | Duplicate module name. |
| `ADDONOVA_PLUGIN_INVALID` | Invalid plugin. |
| `ADDONOVA_PLUGIN_DUPLICATE_NAME` | Duplicate plugin name. |
| `ADDONOVA_PLUGIN_BUILD_START_FAILED` | Plugin `buildStart` failed. |
| `ADDONOVA_PLUGIN_TRANSFORM_FAILED` | Plugin `transform` failed. |
| `ADDONOVA_PLUGIN_BUILD_END_FAILED` | Plugin `buildEnd` failed. |

## Development and browsers

| Code | Meaning |
| --- | --- |
| `ADDONOVA_DEV_CONTEXT_UNSUPPORTED` | Dev context could not be created. |
| `ADDONOVA_DEV_RELOAD_CLIENT_UNAVAILABLE` | Reload client could not be injected. |
| `ADDONOVA_BROWSER_NOT_FOUND` | No browser executable found. |
| `ADDONOVA_BROWSER_LAUNCH_FAILED` | Browser failed to launch. |
| `ADDONOVA_BROWSER_EXTENSION_LOAD_FAILED` | Extension could not be loaded. |
| `ADDONOVA_BROWSER_ARG_IGNORED` | Conflicting browser argument ignored. |
| `ADDONOVA_BROWSER_API_NOT_FOUND` | `@addonova/browser` is missing in bundle mode. |
| `ADDONOVA_WEB_EXT_CONFIG_INVALID` | `webExt` configuration is invalid. |

## Init

| Code | Meaning |
| --- | --- |
| `ADDONOVA_INIT_DIRECTORY_INVALID` | Invalid target directory. |
| `ADDONOVA_INIT_DIRECTORY_NOT_EMPTY` | Target directory has files. |
| `ADDONOVA_INIT_TEMPLATE_INVALID` | Invalid template source. |
| `ADDONOVA_INIT_TEMPLATE_UNKNOWN` | Unknown template. |
| `ADDONOVA_INIT_TEMPLATES_MISSING` | Bundled templates are missing. |
| `ADDONOVA_INIT_DOWNLOAD_FAILED` | Remote template download failed. |
| `ADDONOVA_INIT_OFFLINE` | Remote template requested offline. |

## Clean, pack, analyze, doctor

| Code | Meaning |
| --- | --- |
| `ADDONOVA_CLEAN_UNSAFE_OUTDIR` | Output directory is unsafe to remove. |
| `ADDONOVA_PACK_EMPTY` | Nothing to pack. |
| `ADDONOVA_PACK_FAILED` | Packing failed. |
| `ADDONOVA_PACK_WARNING` | Packing warning. |
| `ADDONOVA_PACK_OUTPUT_MISSING` | Build output is missing. |
| `ADDONOVA_PACK_OUTPUT_EXISTS` | Archive exists and overwrite is off. |
| `ADDONOVA_PACK_MANIFEST_EXCLUDED` | Filters remove `manifest.json`. |
| `ADDONOVA_PACK_OUTFILE_AMBIGUOUS` | `outFile` used with multiple targets. |
| `ADDONOVA_PACK_SOURCES_EMPTY` | No source files matched. |
| `ADDONOVA_PACK_SOURCES_FAILED` | Source archive failed. |
| `ADDONOVA_PACK_SOURCES_MISSING` | Source root is missing. |
| `ADDONOVA_PACK_SOURCES_UNSUPPORTED` | Sources requested without Firefox. |
| `ADDONOVA_ANALYZE_FAILED` | Analysis failed. |
| `ADDONOVA_NODE_RANGE` | Node.js version is outside the supported range. |
| `ADDONOVA_UNKNOWN` | Unexpected error. |

## Diagnostic shape

```ts
interface Diagnostic {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: { file?: string; line?: number; column?: number };
  suggestion?: string;
}
```

Use `isAddonovaError()` and `toDiagnostic()` from `addonova` when handling
errors in integrations.
