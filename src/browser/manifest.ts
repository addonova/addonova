import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import type {
  ManifestContext,
  ManifestInput,
  ResolvedBrowser,
  ResolvedEntrypoint,
} from '../core/config.ts';
import type { Diagnostic } from '../core/errors.ts';
import {
  inferEntrypointType,
  isEntrypointForBrowser,
} from '../core/entrypoints.ts';
import type { ManifestDefaults } from '../core/package.ts';
import { applyManifestDefaults } from '../core/package.ts';
import { collectCompatibilityDiagnostics } from './compatibility.ts';
import { convertManifest } from './convert.ts';
import { discoverIcons } from './icons.ts';
import { getBrowserTargetInfo } from './targets.ts';

export interface BuildManifestOptions {
  outdir?: string;
  checkFiles?: boolean;
  availableFiles?: Iterable<string>;
  mode?: 'development' | 'production';
  command?: string;
  defaults?: ManifestDefaults | undefined;
  entrypoints?: readonly ResolvedEntrypoint[];
  convertManifest?: boolean | undefined;
  iconDir?: string;
  contentScriptCss?: ReadonlyMap<string, readonly string[]>;
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
  baseManifest: ManifestInput,
  browser: ResolvedBrowser,
  options: BuildManifestOptions = {},
): BuiltManifest {
  const manifest = resolveManifestObject(baseManifest, browser, options);
  const entrypointDiagnostics =
    options.entrypoints === undefined
      ? []
      : applyEntrypointManifest(manifest, browser, options);
  const iconDiagnostics =
    options.iconDir === undefined
      ? []
      : applyDiscoveredIcons(manifest, options.iconDir);
  const conversionDiagnostics =
    options.convertManifest === true
      ? convertManifest(manifest, browser.manifestVersion, browser.target).map(
          (conversion): Diagnostic => ({
            code: 'ADDONOVA_MANIFEST_CONVERTED',
            severity: 'warning',
            message: conversion.message,
            suggestion:
              'Set convertManifest: false to manage manifest fields manually.',
          }),
        )
      : [];

  manifest.manifest_version = browser.manifestVersion;
  const target = getBrowserTargetInfo(browser.target);
  const diagnostics: Diagnostic[] = [
    ...conversionDiagnostics,
    ...entrypointDiagnostics,
    ...iconDiagnostics,
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

export function resolveManifestObject(
  input: ManifestInput,
  browser: ResolvedBrowser,
  options: BuildManifestOptions = {},
): Record<string, unknown> {
  const context = createManifestContext(browser, options);
  let resolved: Readonly<Record<string, unknown>>;

  if (typeof input === 'function') {
    const value = input(context);

    if (!isRecord(value)) {
      throw new Error(
        'The manifest function must return a manifest object.',
      );
    }

    resolved = value;
  } else {
    resolved = input;
  }

  let manifest = mergeManifest({}, resolved);

  if (options.defaults !== undefined) {
    manifest = applyManifestDefaults(manifest, options.defaults);
  }

  return mergeManifest(manifest, browser.manifestOverrides);
}

function createManifestContext(
  browser: ResolvedBrowser,
  options: BuildManifestOptions,
): ManifestContext {
  return {
    browser: browser.target,
    manifestVersion: browser.manifestVersion,
    mode: options.mode ?? 'production',
    command: options.command ?? 'build',
  };
}

function applyEntrypointManifest(
  manifest: Record<string, unknown>,
  browser: ResolvedBrowser,
  options: BuildManifestOptions,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const entrypoints = (options.entrypoints ?? []).filter((entrypoint) =>
    isEntrypointForBrowser(entrypoint, browser.target),
  );

  applyBackgroundEntrypoint(manifest, browser, entrypoints);
  applyContentScriptEntrypoints(
    manifest,
    browser,
    entrypoints,
    options,
    diagnostics,
  );
  applyPopupEntrypoint(manifest, browser, entrypoints);
  applyOptionsEntrypoint(manifest, entrypoints);
  applySidepanelEntrypoint(manifest, browser, entrypoints, diagnostics);
  applyDevtoolsEntrypoint(manifest, entrypoints);
  applyOverrideEntrypoints(manifest, entrypoints, diagnostics);
  applySandboxEntrypoints(manifest, entrypoints);

  return diagnostics;
}

function applyBackgroundEntrypoint(
  manifest: Record<string, unknown>,
  browser: ResolvedBrowser,
  entrypoints: readonly ResolvedEntrypoint[],
): void {
  if (manifest.background !== undefined) {
    return;
  }

  const background = entrypoints.find(
    (entrypoint) => getEntrypointType(entrypoint) === 'background',
  );

  if (background === undefined) {
    return;
  }

  const output = getEntrypointOutputPath(background);

  manifest.background =
    browser.manifestVersion === 2
      ? { scripts: [output] }
      : { service_worker: output };
}

function applyContentScriptEntrypoints(
  manifest: Record<string, unknown>,
  browser: ResolvedBrowser,
  entrypoints: readonly ResolvedEntrypoint[],
  options: BuildManifestOptions,
  diagnostics: Diagnostic[],
): void {
  const contentScripts = entrypoints.filter(
    (entrypoint) =>
      getEntrypointType(entrypoint) === 'content-script' &&
      entrypoint.manifestOptions?.registration !== 'runtime',
  );
  const contentStyles = entrypoints.filter(
    (entrypoint) => getEntrypointType(entrypoint) === 'content-style',
  );
  const pairedStyles = new Set<string>();

  for (const entrypoint of contentScripts) {
    const output = getEntrypointOutputPath(entrypoint);
    const existing = getContentScriptEntries(manifest);

    if (existing === null) {
      continue;
    }

    if (
      existing.some(
        (entry) => isRecord(entry) && asStringArray(entry.js).includes(output),
      )
    ) {
      continue;
    }

    const matches = entrypoint.manifestOptions?.matches;

    if (matches === undefined || matches.length === 0) {
      if (entrypoint.discovered === true) {
        diagnostics.push({
          code: 'ADDONOVA_MANIFEST_CONTENT_SCRIPT_MATCHES',
          severity: 'error',
          message: `Content script "${entrypoint.name}" does not declare any match patterns.`,
          location: { file: entrypoint.input },
          suggestion:
            'Pass matches to defineContentScript() or add a content_scripts entry to manifest.',
        });
      }

      continue;
    }

    const entry: Record<string, unknown> = {
      matches: [...matches],
      js: [output],
    };
    applyContentScriptOptions(entry, entrypoint, browser, diagnostics);
    const importedCss = options.contentScriptCss?.get(entrypoint.name);

    if (importedCss !== undefined && importedCss.length > 0) {
      entry.css = [...importedCss];
    }

    const style = contentStyles.find(
      (candidate) => candidate.name === entrypoint.name,
    );

    if (style !== undefined) {
      pairedStyles.add(style.name);
      entry.css = [
        ...asStringArray(entry.css),
        getEntrypointOutputPath(style),
      ];
    }

    existing.push(entry);
  }

  for (const entrypoint of contentStyles) {
    if (pairedStyles.has(entrypoint.name)) {
      continue;
    }

    const matches = entrypoint.manifestOptions?.matches;

    if (matches === undefined || matches.length === 0) {
      continue;
    }

    const existing = getContentScriptEntries(manifest);

    if (existing === null) {
      continue;
    }

    const output = getEntrypointOutputPath(entrypoint);

    if (
      existing.some(
        (entry) =>
          isRecord(entry) && asStringArray(entry.css).includes(output),
      )
    ) {
      continue;
    }

    existing.push({
      matches: [...matches],
      css: [output],
    });
  }
}

function applyContentScriptOptions(
  entry: Record<string, unknown>,
  entrypoint: ResolvedEntrypoint,
  browser: ResolvedBrowser,
  diagnostics: Diagnostic[],
): void {
  const options = entrypoint.manifestOptions ?? {};
  const mappings: ReadonlyArray<
    [
      keyof typeof options,
      string,
    ]
  > = [
    ['excludeMatches', 'exclude_matches'],
    ['includeGlobs', 'include_globs'],
    ['excludeGlobs', 'exclude_globs'],
    ['allFrames', 'all_frames'],
    ['runAt', 'run_at'],
    ['matchAboutBlank', 'match_about_blank'],
    ['matchOriginAsFallback', 'match_origin_as_fallback'],
  ];

  for (const [source, target] of mappings) {
    const value = options[source];

    if (value !== undefined) {
      entry[target] = value;
    }
  }

  if (options.world !== undefined) {
    if (browser.manifestVersion === 3) {
      entry.world = options.world;
    } else {
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_CONTENT_SCRIPT_WORLD',
        severity: 'warning',
        message: `Content script "${entrypoint.name}" uses world "${options.world}", which requires Manifest V3.`,
        location: { file: entrypoint.input },
        suggestion: 'Remove the world option or build for Manifest V3.',
      });
    }
  }
}

function applyPopupEntrypoint(
  manifest: Record<string, unknown>,
  browser: ResolvedBrowser,
  entrypoints: readonly ResolvedEntrypoint[],
): void {
  const popup = entrypoints.find(
    (entrypoint) => getEntrypointType(entrypoint) === 'popup',
  );

  if (popup === undefined) {
    return;
  }

  const declaredType = popup.manifestOptions?.type;
  let actionKey: string;

  if (declaredType === 'page_action') {
    actionKey = 'page_action';
  } else if (declaredType === 'browser_action') {
    actionKey = 'browser_action';
  } else if (isRecord(manifest.action)) {
    actionKey = 'action';
  } else if (isRecord(manifest.browser_action)) {
    actionKey = 'browser_action';
  } else if (
    browser.manifestVersion === 2 &&
    isRecord(manifest.page_action)
  ) {
    actionKey = 'page_action';
  } else {
    actionKey = 'action';
  }

  const action = ensureRecord(manifest, actionKey);

  if (action.default_popup === undefined) {
    action.default_popup = getEntrypointOutputPath(popup);
  }
}

function applyOptionsEntrypoint(
  manifest: Record<string, unknown>,
  entrypoints: readonly ResolvedEntrypoint[],
): void {
  const options = entrypoints.find(
    (entrypoint) => getEntrypointType(entrypoint) === 'options',
  );

  if (options === undefined || manifest.options_page !== undefined) {
    return;
  }

  const optionsUi = ensureRecord(manifest, 'options_ui');

  if (optionsUi.page === undefined) {
    optionsUi.page = getEntrypointOutputPath(options);
  }
}

function applySidepanelEntrypoint(
  manifest: Record<string, unknown>,
  browser: ResolvedBrowser,
  entrypoints: readonly ResolvedEntrypoint[],
  diagnostics: Diagnostic[],
): void {
  const sidepanel = entrypoints.find(
    (entrypoint) => getEntrypointType(entrypoint) === 'sidepanel',
  );

  if (sidepanel === undefined) {
    return;
  }

  const output = getEntrypointOutputPath(sidepanel);

  if (browser.target === 'firefox') {
    const sidebar = ensureRecord(manifest, 'sidebar_action');

    if (sidebar.default_panel === undefined) {
      sidebar.default_panel = output;
    }

    return;
  }

  if (browser.manifestVersion === 3) {
    const panel = ensureRecord(manifest, 'side_panel');

    if (panel.default_path === undefined) {
      panel.default_path = output;
    }

    return;
  }

  diagnostics.push({
    code: 'ADDONOVA_MANIFEST_SIDEPANEL_UNSUPPORTED',
    severity: 'warning',
    message: `Side panel entrypoint "${sidepanel.name}" is not supported by ${browser.target} Manifest V2.`,
    location: { file: sidepanel.input },
    suggestion: 'Build for Manifest V3 or target Firefox.',
  });
}

function applyDevtoolsEntrypoint(
  manifest: Record<string, unknown>,
  entrypoints: readonly ResolvedEntrypoint[],
): void {
  const devtools = entrypoints.find(
    (entrypoint) => getEntrypointType(entrypoint) === 'devtools',
  );

  if (devtools !== undefined && manifest.devtools_page === undefined) {
    manifest.devtools_page = getEntrypointOutputPath(devtools);
  }
}

function applyOverrideEntrypoints(
  manifest: Record<string, unknown>,
  entrypoints: readonly ResolvedEntrypoint[],
  diagnostics: Diagnostic[],
): void {
  const overrideKeys = new Set(['newtab', 'bookmarks', 'history']);

  for (const entrypoint of entrypoints) {
    if (getEntrypointType(entrypoint) !== 'override') {
      continue;
    }

    const key = entrypoint.name.toLowerCase().split('.')[0] ?? '';

    if (!overrideKeys.has(key)) {
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_OVERRIDE_UNKNOWN',
        severity: 'warning',
        message: `Override entrypoint "${entrypoint.name}" does not match a chrome_url_overrides key.`,
        location: { file: entrypoint.input },
        suggestion: 'Rename the entrypoint to newtab, bookmarks, or history.',
      });
      continue;
    }

    const overrides = ensureRecord(manifest, 'chrome_url_overrides');

    if (overrides[key] === undefined) {
      overrides[key] = getEntrypointOutputPath(entrypoint);
    }
  }
}

function applySandboxEntrypoints(
  manifest: Record<string, unknown>,
  entrypoints: readonly ResolvedEntrypoint[],
): void {
  const sandboxPages = entrypoints
    .filter((entrypoint) => getEntrypointType(entrypoint) === 'sandbox')
    .map((entrypoint) => getEntrypointOutputPath(entrypoint));

  if (sandboxPages.length === 0) {
    return;
  }

  const sandbox = ensureRecord(manifest, 'sandbox');
  const pages = asStringArray(sandbox.pages);

  for (const page of sandboxPages) {
    if (!pages.includes(page)) {
      pages.push(page);
    }
  }

  sandbox.pages = pages;
}

function applyDiscoveredIcons(
  manifest: Record<string, unknown>,
  iconDir: string,
): readonly Diagnostic[] {
  const discovered = discoverIcons(iconDir);

  if (
    manifest.icons === undefined &&
    Object.keys(discovered.icons).length > 0
  ) {
    manifest.icons = discovered.icons;
  }

  if (
    manifest.theme_icons === undefined &&
    discovered.themeIcons.length > 0
  ) {
    manifest.theme_icons = discovered.themeIcons;
  }

  return discovered.warnings.map((message) => ({
    code: 'ADDONOVA_MANIFEST_ICON_DISCOVERY',
    severity: 'warning',
    message,
    location: { file: iconDir },
  }));
}

function getContentScriptEntries(
  manifest: Record<string, unknown>,
): unknown[] | null {
  if (manifest.content_scripts === undefined) {
    const entries: unknown[] = [];
    manifest.content_scripts = entries;
    return entries;
  }

  return Array.isArray(manifest.content_scripts)
    ? manifest.content_scripts
    : null;
}

function getEntrypointType(entrypoint: ResolvedEntrypoint) {
  return entrypoint.type ?? inferEntrypointType(entrypoint.name, entrypoint.kind);
}

function getEntrypointOutputPath(entrypoint: ResolvedEntrypoint): string {
  if (entrypoint.kind === 'html') {
    return entrypoint.name.endsWith('.html')
      ? entrypoint.name
      : `${entrypoint.name}.html`;
  }

  if (entrypoint.kind === 'script') {
    return `${entrypoint.name}.js`;
  }

  if (entrypoint.kind === 'style') {
    return `${entrypoint.name}.css`;
  }

  return entrypoint.name;
}

function ensureRecord(
  manifest: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const existing = manifest[key];

  if (isRecord(existing)) {
    return existing;
  }

  const created: Record<string, unknown> = {};
  manifest[key] = created;

  return created;
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
      continue;
    }

    const matches = entry.matches;

    if (
      !Array.isArray(matches) ||
      matches.length === 0 ||
      !matches.every((match) => typeof match === 'string')
    ) {
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_CONTENT_SCRIPT_MATCHES',
        severity: 'error',
        message: `Manifest content_scripts[${index}] must declare at least one match pattern.`,
        suggestion:
          'Add a non-empty "matches" array to the content script entry.',
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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}
