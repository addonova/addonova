export const BROWSER_TARGETS = ['chrome', 'chromium', 'edge', 'firefox'] as const;

export type BrowserTarget = (typeof BROWSER_TARGETS)[number];

export type ManifestVersion = 2 | 3;

export type BuildMode = 'development' | 'production';

export type SourcemapOption =
  | boolean
  | 'none'
  | 'inline'
  | 'external'
  | 'linked'
  | 'both';

export type EntrypointKind = 'script' | 'html' | 'style' | 'asset';

export type ArchiveFormat = 'zip' | 'tar' | 'tar.gz';

export const ARCHIVE_FORMATS: readonly ArchiveFormat[] = ['zip', 'tar', 'tar.gz'];

export const DEFAULT_BROWSER: BrowserTarget = 'chrome';

export const DEFAULT_MANIFEST_VERSION: Readonly<Record<BrowserTarget, ManifestVersion>> = {
  chrome: 3,
  chromium: 3,
  edge: 3,
  firefox: 3,
};

const SOURCEMAP_OPTIONS: readonly SourcemapOption[] = [
  true,
  false,
  'none',
  'inline',
  'external',
  'linked',
  'both',
];

export function isBrowserTarget(value: unknown): value is BrowserTarget {
  return typeof value === 'string' && (BROWSER_TARGETS as readonly string[]).includes(value);
}

export function isManifestVersion(value: unknown): value is ManifestVersion {
  return value === 2 || value === 3;
}

export function isBuildMode(value: unknown): value is BuildMode {
  return value === 'development' || value === 'production';
}

export function isSourcemapOption(value: unknown): value is SourcemapOption {
  return SOURCEMAP_OPTIONS.includes(value as SourcemapOption);
}

export function isArchiveFormat(value: unknown): value is ArchiveFormat {
  return ARCHIVE_FORMATS.includes(value as ArchiveFormat);
}
