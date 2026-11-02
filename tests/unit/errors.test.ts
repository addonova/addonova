import { describe, expect, it } from '@guchho/test';

import {
  AddonovaError,
  createDiagnostic,
  isAddonovaError,
  toDiagnostic,
} from '../../src/core/errors.js';

describe('diagnostics', () => {
  it('wraps a diagnostic in an error', () => {
    const diagnostic = createDiagnostic({
      code: 'ADDONOVA_TEST',
      severity: 'warning',
      message: 'Example warning',
      location: { file: 'addonova.config.ts', line: 4, column: 2 },
      suggestion: 'Change the example value.',
    });
    const error = new AddonovaError(diagnostic);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AddonovaError');
    expect(error.code).toBe('ADDONOVA_TEST');
    expect(error.severity).toBe('warning');
    expect(error.location).toEqual({ file: 'addonova.config.ts', line: 4, column: 2 });
    expect(error.suggestion).toBe('Change the example value.');
  });

  it('detects Addonova errors', () => {
    const error = new AddonovaError({
      code: 'ADDONOVA_TEST',
      severity: 'error',
      message: 'Example error',
    });

    expect(isAddonovaError(error)).toBe(true);
    expect(isAddonovaError(new Error('plain'))).toBe(false);
  });

  it('converts unknown failures into diagnostics', () => {
    const diagnostic = toDiagnostic(new Error('plain failure'), 'ADDONOVA_TEST');

    expect(diagnostic.code).toBe('ADDONOVA_TEST');
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.message).toBe('plain failure');
    expect(diagnostic.cause).toBeInstanceOf(Error);
  });
});
