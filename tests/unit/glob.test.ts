import { describe, expect, it } from '@guchho/test';

import {
  expandBraces,
  filterPaths,
  matchesAny,
  matchesDirectory,
  matchesGlob,
} from '../../src/core/glob.ts';

describe('glob matching', () => {
  it('matches nested and root paths with **', () => {
    expect(matchesGlob('manifest.json', '**/*')).toBe(true);
    expect(matchesGlob('icons/16/icon.svg', '**/*')).toBe(true);
    expect(matchesGlob('icons/16/icon.svg', 'icons/**')).toBe(true);
    expect(matchesGlob('icons/16/icon.svg', '**/*.svg')).toBe(true);
    expect(matchesGlob('background.js', '**/*.svg')).toBe(false);
  });

  it('keeps single stars within one path segment', () => {
    expect(matchesGlob('background.js', '*.js')).toBe(true);
    expect(matchesGlob('scripts/background.js', '*.js')).toBe(false);
    expect(matchesGlob('scripts/background.js', 'scripts/*.js')).toBe(true);
    expect(matchesGlob('scripts/deep/background.js', 'scripts/*.js')).toBe(
      false,
    );
  });

  it('treats plain paths as files or directory prefixes', () => {
    expect(matchesGlob('icons', 'icons')).toBe(true);
    expect(matchesGlob('icons/icon.svg', 'icons')).toBe(true);
    expect(matchesGlob('icons/icon.svg', 'icons/')).toBe(true);
    expect(matchesGlob('icons-extra/icon.svg', 'icons')).toBe(false);
  });

  it('supports question marks, character classes, and braces', () => {
    expect(matchesGlob('a1.js', 'a?.js')).toBe(true);
    expect(matchesGlob('a12.js', 'a?.js')).toBe(false);
    expect(matchesGlob('a1.js', 'a[0-9].js')).toBe(true);
    expect(matchesGlob('a9.js', 'a[!0-9].js')).toBe(false);
    expect(matchesGlob('main.css', '*.{js,css}')).toBe(true);
    expect(matchesGlob('styles/main.css', '*.{js,css}')).toBe(false);
    expect(matchesGlob('styles/main.css', '**/*.{js,css}')).toBe(true);
    expect(expandBraces('*.{js,css}')).toEqual(['*.js', '*.css']);
  });

  it('filters included paths and applies excludes', () => {
    const files = [
      'manifest.json',
      'background.js',
      'background.js.map',
      'icons/icon.svg',
    ];

    expect(
      filterPaths(files, ['**/*'], ['**/*.map', 'icons/**']),
    ).toEqual(['manifest.json', 'background.js']);
    expect(matchesAny('icons/icon.svg', ['**/*.svg', 'assets/**'])).toBe(true);
  });

  it('matches directory prefixes for exclude pruning', () => {
    expect(matchesDirectory('node_modules', ['node_modules/**'])).toBe(true);
    expect(
      matchesDirectory('packages/app/node_modules', ['**/node_modules/**']),
    ).toBe(true);
    expect(matchesDirectory('src', ['node_modules/**'])).toBe(false);
    expect(matchesDirectory('.git', ['.*'])).toBe(true);
  });
});
