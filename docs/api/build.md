---
title: Build API
description: buildProject, analyzeProject, cleanProject, and collectDoctorReport.
---

# Build API

These functions operate on a `ResolvedConfig`. The CLI resolves configuration
before calling them; integrations that already have a resolved config can invoke
them directly.

## `buildProject`

```ts
async function buildProject(
  config: ResolvedConfig,
  options?: BuildProjectOptions,
): Promise<readonly ProjectBuildResult[]>;
```

```ts
interface BuildProjectOptions {
  adapter?: BundlerAdapter;
  dispose?: boolean;
  transforms?: readonly BundlerTransform[];
}
```

```ts
interface ProjectBuildResult {
  browser: ResolvedBrowser;
  outdir: string;
  result: BundlerBuildResult;
  publicWarnings: readonly Diagnostic[];
  manifest: Readonly<Record<string, unknown>> | null;
  manifestPath: string | null;
  manifestDiagnostics: readonly Diagnostic[];
}
```

Builds every configured target, copies public assets, writes the manifest, and
invokes plugins and hooks. By default it disposes the adapter after building.

## `analyzeProject`

```ts
async function analyzeProject(
  config: ResolvedConfig,
  options?: AnalyzeProjectOptions,
): Promise<readonly ProjectAnalysis[]>;
```

```ts
interface ProjectAnalysis {
  browser: ResolvedBrowser;
  outdir: string;
  outputs: readonly BundlerOutput[];
  inputs: readonly BundlerInput[];
  dependencies: readonly string[];
  totalBytes: number;
}
```

Builds in memory with `write: false`. Output and input paths are relative to the
project root or target output directory.

## `extractDependencies`

```ts
function extractDependencies(metafile: unknown): readonly string[];
```

Reads output imports from a bundler metafile and returns unique dependency paths.

## `cleanProject`

```ts
async function cleanProject(
  config: ResolvedConfig,
  options?: CleanProjectOptions,
): Promise<CleanProjectResult>;
```

```ts
interface CleanProjectResult {
  outdir: string;
  removed: boolean;
}
```

Disposes the bundler service before removing the output directory.

## `assertSafeOutputDirectory`

```ts
function assertSafeOutputDirectory(config: ResolvedConfig): void;
```

Throws `ADDONOVA_CLEAN_UNSAFE_OUTDIR` when removing the directory would delete
the project root, an ancestor of it, the filesystem root, or source paths.

## `collectDoctorReport`

```ts
async function collectDoctorReport(
  options: DoctorOptions,
): Promise<DoctorReport>;
```

```ts
interface DoctorReport {
  ok: boolean;
  checks: readonly DoctorCheck[];
  summary: DoctorSummary;
}

interface DoctorCheck {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'fail' | 'skip';
  message: string;
  suggestion?: string;
}

interface DoctorSummary {
  passed: number;
  warnings: number;
  failures: number;
  skipped: number;
}
```

`DoctorOptions` also accepts overrides for testing: `env`, `platform`, `arch`,
`nodeVersion`, `nodeRange`, `addonovaVersion`, `packageManager`,
`guchhoVersion`, `findBrowser`, and `browserApiInstalled`.

## Helper exports

| Export | Description |
| --- | --- |
| `getEntrypointOutputName()` | Output path for an entrypoint. |
| `getOutputDirectory()` | Per-target output directory. |
| `toBundlerEntrypoints()` | Convert resolved entrypoints. |
| `writeGeneratedAssets()` | Write generated hook assets. |
| `copyPublicDirectory()` | Copy public assets into an output directory. |
