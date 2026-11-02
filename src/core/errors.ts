export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticLocation {
  file: string;
  line?: number;
  column?: number;
}

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  location?: DiagnosticLocation;
  suggestion?: string;
  cause?: unknown;
}

export class AddonovaError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(diagnostic: Diagnostic) {
    super(diagnostic.message);
    this.name = 'AddonovaError';
    this.diagnostic = diagnostic;
  }

  get code(): string {
    return this.diagnostic.code;
  }

  get severity(): DiagnosticSeverity {
    return this.diagnostic.severity;
  }

  get location(): DiagnosticLocation | undefined {
    return this.diagnostic.location;
  }

  get suggestion(): string | undefined {
    return this.diagnostic.suggestion;
  }
}

export function createDiagnostic(diagnostic: Diagnostic): Diagnostic {
  return diagnostic;
}

export function isAddonovaError(value: unknown): value is AddonovaError {
  return value instanceof AddonovaError;
}

export function toDiagnostic(error: unknown, code = 'ADDONOVA_UNKNOWN'): Diagnostic {
  if (error instanceof AddonovaError) {
    return error.diagnostic;
  }

  if (error instanceof Error) {
    return {
      code,
      severity: 'error',
      message: error.message,
      cause: error,
    };
  }

  return {
    code,
    severity: 'error',
    message: String(error),
    cause: error,
  };
}
