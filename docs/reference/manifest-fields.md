---
title: Manifest fields
description: Fields Addonova generates, converts, and validates per target.
---

# Manifest fields

## Generated from entrypoints

| Entrypoint | Generated field |
| --- | --- |
| `background.ts` | `background.service_worker` (MV3) or `background.scripts` (MV2) |
| `content.ts` | `content_scripts[]` with `matches` and options |
| `content.css` | `content_scripts[].css` |
| `popup.html` | `action.default_popup` or `browser_action.default_popup` |
| `options.html` | `options_ui.page` |
| `sidepanel.html` | `side_panel.default_path` or `sidebar_action.default_panel` |
| `devtools.html` | `devtools_page` |
| `sandbox.html` | `sandbox.pages` |
| `newtab.html` | `chrome_url_overrides.newtab` |
| `bookmarks.html` | `chrome_url_overrides.bookmarks` |
| `history.html` | `chrome_url_overrides.history` |

## Defaults from package.json

| Field | Source |
| --- | --- |
| `name` | `package.json` name when manifest omits it |
| `version` | `package.json` version when manifest omits it |
| `version_name` | Original prerelease version |

## Icon discovery

- `public/icon-<size>.(png|svg)` and `public/icons/icon-<size>.(png|svg)`.
- `icon-light-*` and `icon-dark-*` pairs become `theme_icons`.
- Explicit `icons` in the manifest take precedence.

## Conversion

With `convertManifest: true`:

| MV3 field | MV2 field |
| --- | --- |
| `action` | `browser_action` |
| `background.service_worker` | `background.scripts` |
| `host_permissions` | `permissions` entries |
| `web_accessible_resources[].resources` | `web_accessible_resources[]` |
| `side_panel` | `sidebar_action` |

Unsupported fields are preserved and diagnosed.

## Validation

- Name and valid version are required.
- Referenced files must exist in final output.
- Background shape must match the manifest version.
- Permissions must be valid for the target.
- `__MSG_` references must exist in the default locale.
- Content scripts must declare `matches`.

## Firefox-specific

Firefox accepts `browser_specific_settings` and `sidebar_action` without a
compatibility warning:

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "my-extension@example.com",
      "strict_min_version": "120.0"
    }
  }
}
```
