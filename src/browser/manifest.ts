import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import type { ResolvedBrowser } from '../core/config.ts';
import type { Diagnostic } from '../core/errors.ts';
import { collectCompatibilityDiagnostics } from './compatibility.ts';
import { getBrowserTargetInfo } from './targets.ts';

export interface BuildManifestOptions {
  outdir?: string;
  checkFiles?: boolean;
  availableFiles?: Iterable<string>;
}

export interface BuiltManifest {
  manifest: Record<string, unknown>;
  diagnostics: readonly Diagnostic[];
  hasErrors: boolean;
}

interface FileReference {
  field: string;
  value: string;
}

export function buildManifest(
  baseManifest: Readonly<Record<string, unknown>>,
  browser: ResolvedBrowser,
  options: BuildManifestOptions = {},
): BuiltManifest {
  const manifest: Record<string, unknown> = mergeManifest(
    baseManifest,
    browser.manifestOverrides,
  );
  manifest.manifest_version = browser.manifestVersion;
  const target = getBrowserTargetInfo(browser.target);
  const diagnostics: Diagnostic[] = [
    ...collectCompatibilityDiagnostics(manifest, browser, target),
    ...validateManifestStructure(manifest),
  ];

  if (options.checkFiles === true) {
    if (options.availableFiles !== undefined) {
      diagnostics.push(
        ...validateFileReferences(manifest, {
          availableFiles: new Set(
            [...options.availableFiles].map(normalizeManifestPath),
          ),
        }),
      );
    } else {
      if (options.outdir === undefined) {
        throw new Error(
          'Manifest file validation requires an output directory or an available file list.',
        );
      }

      diagnostics.push(...validateFileReferences(manifest, { outdir: options.outdir }));
    }
  }

  return {
    manifest,
    diagnostics,
    hasErrors: diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
  };
}

export function writeManifest(
  outdir: string,
  manifest: Readonly<Record<string, unknown>>,
): string {
  mkdirSync(outdir, { recursive: true });

  const manifestPath = path.join(outdir, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return manifestPath;
}

function validateManifestStructure(
  manifest: Readonly<Record<string, unknown>>,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const field of ['name', 'version'] as const) {
    const value = manifest[field];

    if (typeof value !== 'string' || value.trim() === '') {
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_REQUIRED_FIELD',
        severity: 'error',
        message: `Manifest "${field}" is required and must be a non-empty string.`,
        suggestion: `Set manifest.${field} in addonova.config.ts.`,
      });
    }
  }

  const version = manifest.version;

  if (typeof version === 'string' && version !== '' && !isValidVersion(version)) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_VERSION',
      severity: 'error',
      message: `Manifest version "${version}" is invalid.`,
      suggestion:
        'Use one to four dot-separated integers, each between 0 and 65535.',
    });
  }

  if (
    manifest.description !== undefined &&
    typeof manifest.description !== 'string'
  ) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_INVALID_FIELD',
      severity: 'error',
      message: 'Manifest "description" must be a string.',
      suggestion: 'Provide a string description.',
    });
  }

  validateObjectField(manifest, 'background', diagnostics);
  validateObjectField(manifest, 'action', diagnostics);
  validateObjectField(manifest, 'browser_action', diagnostics);
  validateObjectField(manifest, 'page_action', diagnostics);
  validateObjectField(manifest, 'icons', diagnostics);
  validateObjectField(manifest, 'options_ui', diagnostics);
  validateObjectField(manifest, 'side_panel', diagnostics);
  validateObjectField(manifest, 'sidebar_action', diagnostics);
  validateObjectField(manifest, 'declarative_net_request', diagnostics);
  validateStringArrayField(manifest, 'permissions', diagnostics);
  validateStringArrayField(manifest, 'host_permissions', diagnostics);
  validateContentScripts(manifest, diagnostics);
  validateWebAccessibleResources(manifest, diagnostics);

  return diagnostics;
}

function validateObjectField(
  manifest: Readonly<Record<string, unknown>>,
  field: string,
  diagnostics: Diagnostic[],
): void {
  const value = manifest[field];

  if (value !== undefined && !isRecord(value)) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_INVALID_FIELD',
      severity: 'error',
      message: `Manifest "${field}" must be an object.`,
      suggestion: `Provide an object for manifest.${field}.`,
    });
  }
}

function validateStringArrayField(
  manifest: Readonly<Record<string, unknown>>,
  field: string,
  diagnostics: Diagnostic[],
): void {
  const value = manifest[field];

  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_INVALID_FIELD',
      severity: 'error',
      message: `Manifest "${field}" must be an array of strings.`,
      suggestion: `Provide string entries for manifest.${field}.`,
    });
  }
}

function validateContentScripts(
  manifest: Readonly<Record<string, unknown>>,
  diagnostics: Diagnostic[],
): void {
  const contentScripts = manifest.content_scripts;

  if (contentScripts === undefined) {
    return;
  }

  if (!Array.isArray(contentScripts)) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_INVALID_FIELD',
      severity: 'error',
      message: 'Manifest "content_scripts" must be an array.',
      suggestion: 'Provide an array of content script objects.',
    });
    return;
  }

  for (const [index, entry] of contentScripts.entries()) {
    if (!isRecord(entry)) {
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_INVALID_FIELD',
        severity: 'error',
        message: `Manifest content_scripts[${index}] must be an object.`,
        suggestion: 'Provide an object with matches, js, or css fields.',
      });
    }
  }
}

function validateWebAccessibleResources(
  manifest: Readonly<Record<string, unknown>>,
  diagnostics: Diagnostic[],
): void {
  const resources = manifest.web_accessible_resources;

  if (resources !== undefined && !Array.isArray(resources)) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_INVALID_FIELD',
      severity: 'error',
      message: 'Manifest "web_accessible_resources" must be an array.',
      suggestion: 'Provide the MV2 string array or MV3 resource objects.',
    });
  }
}

interface FileValidationContext {
  outdir?: string;
  availableFiles?: ReadonlySet<string>;
}

function validateFileReferences(
  manifest: Readonly<Record<string, unknown>>,
  context: FileValidationContext,
): readonly Diagnostic[] {
  const references: FileReference[] = [];
  const background = asRecord(manifest.background);
  const action = asRecord(manifest.action);
  const browserAction = asRecord(manifest.browser_action);
  const pageAction = asRecord(manifest.page_action);
  const optionsUi = asRecord(manifest.options_ui);
  const sidePanel = asRecord(manifest.side_panel);
  const sidebarAction = asRecord(manifest.sidebar_action);
  const declarativeNetRequest = asRecord(manifest.declarative_net_request);

  addStringReference(references, 'background.service_worker', background?.service_worker);
  addStringReference(references, 'background.page', background?.page);
  addStringArrayReferences(references, 'background.scripts', background?.scripts);
  addStringReference(references, 'action.default_popup', action?.default_popup);
  addStringReference(
    references,
    'browser_action.default_popup',
    browserAction?.default_popup,
  );
  addStringReference(
    references,
    'page_action.default_popup',
    pageAction?.default_popup,
  );
  addIconReferences(references, 'icons', manifest.icons);
  addIconReferences(references, 'action.default_icon', action?.default_icon);
  addIconReferences(
    references,
    'browser_action.default_icon',
    browserAction?.default_icon,
  );
  addIconReferences(
    references,
    'page_action.default_icon',
    pageAction?.default_icon,
  );
  addStringReference(references, 'options_ui.page', optionsUi?.page);
  addStringReference(references, 'options_page', manifest.options_page);
  addStringReference(references, 'devtools_page', manifest.devtools_page);
  addStringReference(
    references,
    'side_panel.default_path',
    sidePanel?.default_path,
  );
  addStringReference(
    references,
    'sidebar_action.default_panel',
    sidebarAction?.default_panel,
  );
  addPageMapReferences(
    references,
    'chrome_url_overrides',
    manifest.chrome_url_overrides,
  );
  addStringArrayReferences(
    references,
    'sandbox.pages',
    asRecord(manifest.sandbox)?.pages,
  );
  addStringReference(
    references,
    'storage.managed_schema',
    asRecord(manifest.storage)?.managed_schema,
  );
  addContentScriptReferences(references, manifest.content_scripts);
  addWebAccessibleResourceReferences(
    references,
    manifest.web_accessible_resources,
  );
  addRuleResourceReferences(
    references,
    declarativeNetRequest?.rule_resources,
  );

  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();

  for (const reference of references) {
    const key = `${reference.field}\0${reference.value}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    diagnostics.push(...validateFileReference(reference, context));
  }

  return diagnostics;
}

function addStringReference(
  references: FileReference[],
  field: string,
  value: unknown,
): void {
  if (typeof value === 'string' && value !== '') {
    references.push({ field, value });
  }
}

function addStringArrayReferences(
  references: FileReference[],
  field: string,
  value: unknown,
): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    if (typeof entry === 'string' && entry !== '') {
      references.push({ field, value: entry });
    }
  }
}

function addIconReferences(
  references: FileReference[],
  field: string,
  value: unknown,
): void {
  if (typeof value === 'string') {
    references.push({ field, value });
    return;
  }

  if (isRecord(value)) {
    for (const entry of Object.values(value)) {
      if (typeof entry === 'string') {
        references.push({ field, value: entry });
      }
    }
  }
}

function addPageMapReferences(
  references: FileReference[],
  field: string,
  value: unknown,
): void {
  if (!isRecord(value)) {
    return;
  }

  for (const entry of Object.values(value)) {
    if (typeof entry === 'string') {
      references.push({ field, value: entry });
    }
  }
}

function addContentScriptReferences(
  references: FileReference[],
  value: unknown,
): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    addStringArrayReferences(references, 'content_scripts.js', entry.js);
    addStringArrayReferences(references, 'content_scripts.css', entry.css);
  }
}

function addWebAccessibleResourceReferences(
  references: FileReference[],
  value: unknown,
): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    if (typeof entry === 'string') {
      references.push({ field: 'web_accessible_resources', value: entry });
      continue;
    }

    if (isRecord(entry)) {
      addStringArrayReferences(
        references,
        'web_accessible_resources.resources',
        entry.resources,
      );
    }
  }
}

function addRuleResourceReferences(
  references: FileReference[],
  value: unknown,
): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    if (isRecord(entry)) {
      addStringReference(
        references,
        'declarative_net_request.rule_resources.path',
        entry.path,
      );
    }
  }
}

function validateFileReference(
  reference: FileReference,
  context: FileValidationContext,
): readonly Diagnostic[] {
  const value = reference.value.trim();

  if (isExternalReference(value)) {
    return [
      {
        code: 'ADDONOVA_MANIFEST_EXTERNAL_REFERENCE',
        severity: 'warning',
        message: `Manifest field "${reference.field}" points outside the extension: ${value}`,
        suggestion:
          'Use a packaged extension path so the referenced file is available offline.',
      },
    ];
  }

  if (value.includes('*')) {
    return [];
  }

  const relativeValue = normalizeManifestPath(value);

  if (relativeValue === '' || relativeValue.startsWith('..')) {
    return [invalidReference(reference, value)];
  }

  if (context.availableFiles !== undefined) {
    return context.availableFiles.has(relativeValue)
      ? []
      : [missingReference(reference, value)];
  }

  if (context.outdir === undefined) {
    throw new Error('Manifest file validation requires an output directory.');
  }

  const root = path.resolve(context.outdir);
  const resolved = path.resolve(root, relativeValue);
  const relative = path.relative(root, resolved);

  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return [invalidReference(reference, value)];
  }

  if (!existsSync(resolved)) {
    return [missingReference(reference, value)];
  }

  return [];
}

function invalidReference(
  reference: FileReference,
  value: string,
): Diagnostic {
  return {
    code: 'ADDONOVA_MANIFEST_REFERENCE_INVALID',
    severity: 'error',
    message: `Manifest field "${reference.field}" points outside the output directory: ${value}`,
    suggestion: 'Use a relative path inside the extension output.',
  };
}

function missingReference(
  reference: FileReference,
  value: string,
): Diagnostic {
  return {
    code: 'ADDONOVA_MANIFEST_REFERENCE_MISSING',
    severity: 'error',
    message: `Manifest field "${reference.field}" references a missing file: ${value}`,
    suggestion:
      'Add the file as an entrypoint or public asset, or correct the manifest path.',
  };
}

function normalizeManifestPath(value: string): string {
  return value.trim().replaceAll('\\', '/').replace(/^\/+/, '');
}

function isExternalReference(value: string): boolean {
  return /^(?:https?|data|blob|moz-extension|chrome-extension):/i.test(value);
}

function isValidVersion(version: string): boolean {
  if (!/^(0|[1-9]\d*)(?:\.(0|[1-9]\d*)){0,3}$/.test(version)) {
    return false;
  }

  return version
    .split('.')
    .every((part) => Number(part) <= 65535);
}

function mergeManifest(
  base: Readonly<Record<string, unknown>>,
  overrides: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    const existing = merged[key];

    if (isRecord(existing) && isRecord(value)) {
      merged[key] = mergeManifest(existing, value);
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
