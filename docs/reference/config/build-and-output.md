---
title: Build and output
description: outdir, publicDir, mode, minify, sourcemap, and browserApi.
---

# Build and output

## `outdir`

Type: `string` - default `dist`.

Output directory, resolved from the configuration file.

```ts
export default defineConfig({
  outdir: 'build',
});
```

## `publicDir`

Type: `string` - default `public`.

Files copied into each target after a successful build. A collision with a
generated path produces a warning; generated output wins.

```ts
export default defineConfig({
  publicDir: 'static',
});
```

## `mode`

Type: `development | production` - default `production`.

`dev` defaults to `development`. Mode affects defaults, environment defines,
and development-only manifest additions.

```ts
export default defineConfig({
  mode: 'development',
});
```

## `minify`

Type: `boolean`.

Default: `true` in production, `false` in development.

```ts
export default defineConfig({
  minify: false,
});
```

## `sourcemap`

Type: `boolean | 'none' | 'inline' | 'external' | 'linked' | 'both'`.

Default: `true` in development, `false` in production.

```ts
export default defineConfig({
  sourcemap: 'linked',
});
```

CLI forms:

```bash
addonova build --sourcemap
addonova build --sourcemap=inline
addonova build --no-sourcemap
```

## `browserApi`

Type: `'external' | 'bundle' | { mode?, package?, define? }`

Default: `'external'`.

```ts
export default defineConfig({
  browserApi: 'bundle',
});
```

Object form:

```ts
export default defineConfig({
  browserApi: {
    mode: 'bundle',
    package: '@addonova/browser',
    define: true,
  },
});
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `external` or `bundle` | `external` | Integration mode. |
| `package` | string | `@addonova/browser` | Package to alias in bundle mode. |
| `define` | boolean | `true` | Define `__ADDONOVA_BROWSER__`. |

External mode keeps the package out of the bundle. Bundle mode aliases the
package root to the target adapter and sets the target define.

## Environment defines

Dotenv files load in this order, later files winning:

1. `.env`
2. `.env.local`
3. `.env.<mode>`
4. `.env.<mode>.local`
5. `.env.<browser>`
6. `.env.<browser>.local`

Only `ADDONOVA_*` and `VITE_*` variables are exposed, alongside `MODE`, `DEV`,
`PROD`, `BROWSER`, and `MANIFEST_VERSION`.
