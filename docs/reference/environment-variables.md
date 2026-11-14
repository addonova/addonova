---
title: Environment variables
description: Dotenv loading order, exposed defines, and CLI environment variables.
---

# Environment variables

## Dotenv order

Addonova loads these files from the project root, with later files overriding
earlier ones:

1. `.env`
2. `.env.local`
3. `.env.<mode>`
4. `.env.<mode>.local`
5. `.env.<browser>`
6. `.env.<browser>.local`

`<mode>` is `development` or `production`. `<browser>` is `chrome`, `chromium`,
`edge`, or `firefox`.

## Exposed to `import.meta.env`

Only prefixed variables are exposed:

- `ADDONOVA_*`
- `VITE_*`

Along with built-ins:

| Name | Value |
| --- | --- |
| `MODE` | `development` or `production` |
| `DEV` | `true` in development |
| `PROD` | `true` in production |
| `BROWSER` | Selected target |
| `MANIFEST_VERSION` | `2` or `3` |

Unprefixed variables are never exposed.

```bash
# .env
ADDONOVA_API_URL=https://api.example.com
VITE_ANALYTICS_ID=abc123
SECRET_TOKEN=not-exposed
```

```ts
console.log(import.meta.env.ADDONOVA_API_URL);
console.log(import.meta.env.BROWSER);
```

## CLI environment controls

| Variable | Description |
| --- | --- |
| `NO_COLOR` | Disable colored output. |
| `FORCE_COLOR` | Force colored output. |

## Build-time target defines

In bundle mode, `__ADDONOVA_BROWSER__` is defined as the target name. Disable it
with `browserApi: { mode: 'bundle', define: false }`.
