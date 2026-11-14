---
title: Diagnostics API
description: AddonovaError, Diagnostic, and conversion helpers.
---

# Diagnostics API

```ts
import {
  AddonovaError,
  createDiagnostic,
  isAddonovaError,
  toDiagnostic,
} from 'addonova';
```

## `Diagnostic`

```ts
type DiagnosticSeverity = 'error' | 'warning' | 'info';

interface DiagnosticLocation {
  file: string;
  line?: number;
  column?: number;
}

interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  location?: DiagnosticLocation;
  suggestion?: string;
  cause?: unknown;
}
```

## `AddonovaError`

```ts
class AddonovaError extends Error {
  readonly diagnostic: Diagnostic;
  get code(): string;
  get severity(): DiagnosticSeverity;
  get location(): DiagnosticLocation | undefined;
  get suggestion(): string | undefined;
}
```

```ts
try {
  await build();
} catch (error) {
  if (isAddonovaError(error)) {
    console.error(error.code, error.message);
  }
}
```

## `createDiagnostic`

```ts
function createDiagnostic(diagnostic: Diagnostic): Diagnostic;
```

Identity helper for typed diagnostics.

## `isAddonovaError`

```ts
function isAddonovaError(value: unknown): value is AddonovaError;
```

## `toDiagnostic`

```ts
function toDiagnostic(error: unknown, code = 'ADDONOVA_UNKNOWN'): Diagnostic;
```

Returns the wrapped diagnostic for `AddonovaError`, or wraps any `Error` or value
into an error diagnostic with an optional code.

## Severity behavior

- `error` fails commands and builds.
- `warning` is printed but does not change the exit code.
- `info` is informational output.

Codes are listed in [Error codes](../reference/error-codes.md).
