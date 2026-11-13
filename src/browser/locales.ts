import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import path from 'node:path';

import type { Diagnostic, DiagnosticSeverity } from '../core/errors.ts';

export interface LocalePlaceholder {
  content: string;
  example?: string;
}

export interface LocaleMessage {
  message: string;
  description?: string;
  placeholders?: Record<string, LocalePlaceholder>;
}

export type LocaleMessages = Record<string, LocaleMessage>;

export interface LocaleCatalog {
  locale: string;
  source: string;
  messages: LocaleMessages;
  normalizedKeys: ReadonlySet<string>;
}

export interface LocaleOutputFile {
  path: string;
  contents: string;
}

export interface LocaleCollection {
  catalogs: ReadonlyMap<string, LocaleCatalog>;
  files: readonly LocaleOutputFile[];
  diagnostics: readonly Diagnostic[];
}

export interface CollectLocalesOptions {
  root: string;
  srcDir: string;
  publicDir: string;
  defaultLocale?: string | undefined;
}

export interface LocaleParseResult {
  messages: LocaleMessages;
  diagnostics: readonly Diagnostic[];
}

export interface ManifestMessageReference {
  field: string;
  key: string;
  token: string;
}

const LOCALE_CODE_PATTERN = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/;
const MESSAGE_KEY_PATTERN = /^[A-Za-z0-9_]+$/;
const MESSAGE_REFERENCE_PATTERN = /__MSG_([A-Za-z0-9_]+)__/g;

export function collectLocales(
  options: CollectLocalesOptions,
): LocaleCollection {
  const catalogs = new Map<string, LocaleCatalog>();
  const files: LocaleOutputFile[] = [];
  const diagnostics: Diagnostic[] = [];

  collectStandardLocales(
    path.resolve(options.publicDir, '_locales'),
    options.defaultLocale,
    catalogs,
    diagnostics,
  );
  collectFlatLocales(
    path.resolve(options.root, options.srcDir, '_locales'),
    options.defaultLocale,
    catalogs,
    files,
    diagnostics,
  );

  return { catalogs, files, diagnostics };
}

export function getManifestDefaultLocale(
  manifest: Readonly<Record<string, unknown>>,
): string | undefined {
  const value = manifest.default_locale;

  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

export function validateManifestLocales(
  manifest: Readonly<Record<string, unknown>>,
  collection?: LocaleCollection,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const references = collectManifestMessageReferences(manifest);
  const rawDefaultLocale = manifest.default_locale;
  const defaultLocale =
    typeof rawDefaultLocale === 'string' ? rawDefaultLocale.trim() : '';
  const hasLocales = (collection?.catalogs.size ?? 0) > 0;

  if (
    rawDefaultLocale !== undefined &&
    (typeof rawDefaultLocale !== 'string' || defaultLocale === '')
  ) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_DEFAULT_LOCALE',
      severity: 'error',
      message: 'Manifest "default_locale" must be a non-empty string.',
      suggestion:
        'Set manifest.default_locale to a locale available under _locales, such as "en".',
    });
  } else if (defaultLocale !== '' && !isValidLocaleCode(defaultLocale)) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_DEFAULT_LOCALE',
      severity: 'error',
      message: `Manifest "default_locale" is not a valid locale code: ${defaultLocale}`,
      suggestion:
        'Use a locale code such as "en", "en_GB", or "zh-CN".',
    });
  } else if (hasLocales && collection !== undefined) {
    if (rawDefaultLocale === undefined) {
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_DEFAULT_LOCALE',
        severity: 'error',
        message:
          'Manifest "default_locale" is required when _locales messages are provided.',
        suggestion: defaultLocaleSuggestion(collection),
      });
    } else if (defaultLocale !== '') {
      const normalizedDefault = normalizeLocale(defaultLocale);
      const defaultCatalog = collection?.catalogs.get(normalizedDefault);

      if (defaultCatalog === undefined) {
        diagnostics.push({
          code: 'ADDONOVA_MANIFEST_DEFAULT_LOCALE',
          severity: 'error',
          message: `Manifest "default_locale" points to a missing locale: ${defaultLocale}`,
          suggestion: defaultLocaleSuggestion(collection),
        });
      } else {
        diagnostics.push(
          ...validateDefaultReferences(references, defaultCatalog),
        );
        diagnostics.push(
          ...validateOtherLocaleReferences(
            references,
            defaultCatalog,
            collection,
          ),
        );
      }
    }
  } else if (collection !== undefined) {
    if (rawDefaultLocale !== undefined) {
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_LOCALES_MISSING',
        severity: 'error',
        message:
          'Manifest declares "default_locale" but no _locales messages were found.',
        suggestion:
          'Add src/_locales/<locale>.i18n or public/_locales/<locale>/messages.json.',
      });
    } else if (references.length > 0) {
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_LOCALES_MISSING',
        severity: 'error',
        message:
          'Manifest uses __MSG_ localized fields but no _locales messages were found.',
        suggestion:
          'Add src/_locales/<locale>.i18n or public/_locales/<locale>/messages.json.',
      });
    }
  }

  return diagnostics;
}

export function collectManifestMessageReferences(
  manifest: Readonly<Record<string, unknown>>,
): readonly ManifestMessageReference[] {
  const references: ManifestMessageReference[] = [];
  const seen = new Set<string>();

  walk(manifest, '');

  return references;

  function walk(value: unknown, field: string): void {
    if (typeof value === 'string') {
      MESSAGE_REFERENCE_PATTERN.lastIndex = 0;

      for (const match of value.matchAll(MESSAGE_REFERENCE_PATTERN)) {
        const key = match[1];

        if (key === undefined) {
          continue;
        }

        const normalized = normalizeMessageKey(key);
        const identity = `${field}\0${normalized}`;

        if (seen.has(identity)) {
          continue;
        }

        seen.add(identity);
        references.push({
          field: field === '' ? 'manifest' : field,
          key,
          token: match[0],
        });
      }

      return;
    }

    if (Array.isArray(value)) {
      for (const [index, entry] of value.entries()) {
        walk(entry, `${field}[${index}]`);
      }

      return;
    }

    if (isRecord(value)) {
      for (const [key, entry] of Object.entries(value)) {
        walk(entry, field === '' ? key : `${field}.${key}`);
      }
    }
  }
}

export function parseI18nMessages(
  source: string,
  file: string,
  severity: DiagnosticSeverity = 'warning',
): LocaleParseResult {
  const messages: LocaleMessages = {};
  const diagnostics: Diagnostic[] = [];
  const seenKeys = new Map<string, string>();
  let currentKey: string | null = null;
  let currentLine = 0;
  let currentLines: string[] = [];
  let reportedPreamble = false;

  const flush = (): void => {
    if (currentKey === null) {
      return;
    }

    const message = currentLines
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .join(' ');

    if (message === '') {
      diagnostics.push({
        code: 'ADDONOVA_LOCALES_INVALID',
        severity,
        message: `Locale message "${currentKey}" has no text.`,
        location: { file, line: currentLine },
        suggestion: `Add message text below @${currentKey}.`,
      });
    }

    const normalizedKey = normalizeMessageKey(currentKey);
    const previous = seenKeys.get(normalizedKey);

    if (previous !== undefined) {
      diagnostics.push({
        code: 'ADDONOVA_LOCALES_DUPLICATE',
        severity,
        message: `Locale message "${currentKey}" is defined more than once.`,
        location: { file, line: currentLine },
        suggestion: `Remove the duplicate @${currentKey} block or rename it.`,
      });
    }

    seenKeys.set(normalizedKey, currentKey);
    messages[currentKey] = { message };
    currentKey = null;
    currentLines = [];
  };

  const normalizedSource = source.replaceAll('\r\n', '\n').replaceAll('\r', '\n');

  for (const [index, rawLine] of normalizedSource.split('\n').entries()) {
    const line = rawLine.trim();
    const lineNumber = index + 1;

    if (line.startsWith('@')) {
      flush();

      const key = line.slice(1).trim();

      if (key === '') {
        diagnostics.push({
          code: 'ADDONOVA_LOCALES_INVALID',
          severity,
          message: 'Locale message key is empty.',
          location: { file, line: lineNumber },
          suggestion: 'Add a message name after @, such as @app_name.',
        });
        continue;
      }

      if (!MESSAGE_KEY_PATTERN.test(key)) {
        diagnostics.push({
          code: 'ADDONOVA_LOCALES_INVALID',
          severity,
          message: `Locale message key "${key}" is invalid.`,
          location: { file, line: lineNumber },
          suggestion:
            'Use only letters, numbers, and underscores in message names.',
        });
      }

      currentKey = key;
      currentLine = lineNumber;
      currentLines = [];
      continue;
    }

    if (line === '') {
      continue;
    }

    if (currentKey === null) {
      if (!reportedPreamble) {
        diagnostics.push({
          code: 'ADDONOVA_LOCALES_INVALID',
          severity: 'warning',
          message: 'Locale text appears before the first @message key.',
          location: { file, line: lineNumber },
          suggestion: 'Start each message with a line such as @app_name.',
        });
        reportedPreamble = true;
      }

      continue;
    }

    currentLines.push(line);
  }

  flush();

  return { messages, diagnostics };
}

export function parseMessagesJson(
  source: string,
  file: string,
  severity: DiagnosticSeverity = 'warning',
): LocaleParseResult {
  const messages: LocaleMessages = {};
  const diagnostics: Diagnostic[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch (error) {
    diagnostics.push({
      code: 'ADDONOVA_LOCALES_INVALID',
      severity,
      message: `Locale messages file is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
      location: { file },
      suggestion: 'Fix the JSON syntax in messages.json.',
    });

    return { messages, diagnostics };
  }

  if (!isRecord(parsed)) {
    diagnostics.push({
      code: 'ADDONOVA_LOCALES_INVALID',
      severity,
      message: 'Locale messages file must contain a JSON object.',
      location: { file },
      suggestion: 'Use an object mapping message names to message objects.',
    });

    return { messages, diagnostics };
  }

  const seenKeys = new Set<string>();

  for (const [key, value] of Object.entries(parsed)) {
    const normalizedKey = normalizeMessageKey(key);

    if (seenKeys.has(normalizedKey)) {
      diagnostics.push({
        code: 'ADDONOVA_LOCALES_DUPLICATE',
        severity,
        message: `Locale message "${key}" is defined more than once.`,
        location: { file },
        suggestion: `Remove the duplicate "${key}" entry.`,
      });
    }

    seenKeys.add(normalizedKey);

    if (!MESSAGE_KEY_PATTERN.test(key)) {
      diagnostics.push({
        code: 'ADDONOVA_LOCALES_INVALID',
        severity,
        message: `Locale message key "${key}" is invalid.`,
        location: { file },
        suggestion:
          'Use only letters, numbers, and underscores in message names.',
      });
    }

    if (!isRecord(value)) {
      diagnostics.push({
        code: 'ADDONOVA_LOCALES_INVALID',
        severity,
        message: `Locale message "${key}" must be an object.`,
        location: { file },
        suggestion: 'Provide an object with a non-empty "message" field.',
      });
      continue;
    }

    const rawMessage = value.message;

    if (typeof rawMessage !== 'string' || rawMessage.trim() === '') {
      diagnostics.push({
        code: 'ADDONOVA_LOCALES_INVALID',
        severity,
        message: `Locale message "${key}" must contain a non-empty "message" string.`,
        location: { file },
        suggestion: 'Set "message" to the localized text.',
      });
      continue;
    }

    const message: LocaleMessage = { message: rawMessage };

    if (value.description !== undefined) {
      if (typeof value.description === 'string') {
        message.description = value.description;
      } else {
        diagnostics.push({
          code: 'ADDONOVA_LOCALES_INVALID',
          severity,
          message: `Locale message "${key}" has a non-string "description".`,
          location: { file },
          suggestion: 'Set "description" to a string.',
        });
      }
    }

    if (value.placeholders !== undefined) {
      const placeholders = parsePlaceholders(key, value.placeholders, file, severity, diagnostics);

      if (placeholders !== undefined) {
        message.placeholders = placeholders;
      }
    }

    messages[key] = message;
  }

  return { messages, diagnostics };
}

export function formatLocaleMessages(messages: LocaleMessages): string {
  return `${JSON.stringify(messages, null, 2)}\n`;
}

export function isValidLocaleCode(locale: string): boolean {
  return LOCALE_CODE_PATTERN.test(locale);
}

function collectStandardLocales(
  directory: string,
  defaultLocale: string | undefined,
  catalogs: Map<string, LocaleCatalog>,
  diagnostics: Diagnostic[],
): void {
  if (!existsSync(directory)) {
    return;
  }

  let entries;

  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    diagnostics.push({
      code: 'ADDONOVA_LOCALES_INVALID',
      severity: 'error',
      message: `Cannot read the public _locales directory: ${
        error instanceof Error ? error.message : String(error)
      }`,
      location: { file: directory },
      suggestion: 'Check directory permissions and the publicDir setting.',
    });
    return;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (entry.name.startsWith('.') || !entry.isDirectory()) {
      continue;
    }

    const locale = entry.name;
    const severity = getLocaleSeverity(locale, defaultLocale);

    if (!isValidLocaleCode(locale)) {
      diagnostics.push(invalidLocaleCodeDiagnostic(locale, severity, path.join(directory, entry.name)));
      continue;
    }

    const messagesPath = path.join(directory, entry.name, 'messages.json');

    if (!existsSync(messagesPath)) {
      diagnostics.push({
        code: 'ADDONOVA_LOCALES_INVALID',
        severity,
        message: `Locale directory "${locale}" does not contain messages.json.`,
        location: { file: path.join(directory, entry.name) },
        suggestion: 'Add messages.json to the locale directory.',
      });
      continue;
    }

    let source: string;

    try {
      source = readFileSync(messagesPath, 'utf8');
    } catch (error) {
      diagnostics.push({
        code: 'ADDONOVA_LOCALES_INVALID',
        severity,
        message: `Cannot read locale messages for "${locale}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        location: { file: messagesPath },
        suggestion: 'Check file permissions.',
      });
      continue;
    }

    const normalizedLocale = normalizeLocale(locale);
    const existing = catalogs.get(normalizedLocale);

    if (existing !== undefined) {
      diagnostics.push(duplicateLocaleDiagnostic(existing, locale, messagesPath));
      continue;
    }

    const parsed = parseMessagesJson(source, messagesPath, severity);

    diagnostics.push(...parsed.diagnostics);
    catalogs.set(normalizedLocale, {
      locale,
      source: messagesPath,
      messages: parsed.messages,
      normalizedKeys: new Set(
        Object.keys(parsed.messages).map((key) => normalizeMessageKey(key)),
      ),
    });
  }
}

function collectFlatLocales(
  directory: string,
  defaultLocale: string | undefined,
  catalogs: Map<string, LocaleCatalog>,
  files: LocaleOutputFile[],
  diagnostics: Diagnostic[],
): void {
  if (!existsSync(directory)) {
    return;
  }

  let entries;

  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    diagnostics.push({
      code: 'ADDONOVA_LOCALES_INVALID',
      severity: 'error',
      message: `Cannot read the source _locales directory: ${
        error instanceof Error ? error.message : String(error)
      }`,
      location: { file: directory },
      suggestion: 'Check directory permissions and the srcDir setting.',
    });
    return;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (
      entry.name.startsWith('.') ||
      !entry.isFile() ||
      !entry.name.toLowerCase().endsWith('.i18n')
    ) {
      continue;
    }

    const locale = entry.name.slice(0, -'.i18n'.length);
    const sourcePath = path.join(directory, entry.name);
    const severity = getLocaleSeverity(locale, defaultLocale);

    if (!isValidLocaleCode(locale)) {
      diagnostics.push(invalidLocaleCodeDiagnostic(locale, severity, sourcePath));
      continue;
    }

    const normalizedLocale = normalizeLocale(locale);
    const existing = catalogs.get(normalizedLocale);

    if (existing !== undefined) {
      diagnostics.push(duplicateLocaleDiagnostic(existing, locale, sourcePath));
      continue;
    }

    let source: string;

    try {
      source = readFileSync(sourcePath, 'utf8');
    } catch (error) {
      diagnostics.push({
        code: 'ADDONOVA_LOCALES_INVALID',
        severity,
        message: `Cannot read locale messages for "${locale}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        location: { file: sourcePath },
        suggestion: 'Check file permissions.',
      });
      continue;
    }

    const parsed = parseI18nMessages(source, sourcePath, severity);

    diagnostics.push(...parsed.diagnostics);
    catalogs.set(normalizedLocale, {
      locale,
      source: sourcePath,
      messages: parsed.messages,
      normalizedKeys: new Set(
        Object.keys(parsed.messages).map((key) => normalizeMessageKey(key)),
      ),
    });
    files.push({
      path: `_locales/${locale}/messages.json`,
      contents: formatLocaleMessages(parsed.messages),
    });
  }
}

function parsePlaceholders(
  messageKey: string,
  value: unknown,
  file: string,
  severity: DiagnosticSeverity,
  diagnostics: Diagnostic[],
): Record<string, LocalePlaceholder> | undefined {
  if (!isRecord(value)) {
    diagnostics.push({
      code: 'ADDONOVA_LOCALES_INVALID',
      severity,
      message: `Locale message "${messageKey}" has invalid "placeholders".`,
      location: { file },
      suggestion: 'Set "placeholders" to an object.',
    });
    return undefined;
  }

  const placeholders: Record<string, LocalePlaceholder> = {};

  for (const [name, placeholder] of Object.entries(value)) {
    if (!isRecord(placeholder)) {
      diagnostics.push({
        code: 'ADDONOVA_LOCALES_INVALID',
        severity,
        message: `Locale placeholder "${name}" in message "${messageKey}" must be an object.`,
        location: { file },
        suggestion: 'Provide an object with a non-empty "content" field.',
      });
      continue;
    }

    const content = placeholder.content;

    if (typeof content !== 'string' || content.trim() === '') {
      diagnostics.push({
        code: 'ADDONOVA_LOCALES_INVALID',
        severity,
        message: `Locale placeholder "${name}" in message "${messageKey}" must contain a non-empty "content" string.`,
        location: { file },
        suggestion: 'Set "content" to the placeholder replacement text.',
      });
      continue;
    }

    const parsed: LocalePlaceholder = { content };

    if (placeholder.example !== undefined) {
      if (typeof placeholder.example === 'string') {
        parsed.example = placeholder.example;
      } else {
        diagnostics.push({
          code: 'ADDONOVA_LOCALES_INVALID',
          severity,
          message: `Locale placeholder "${name}" in message "${messageKey}" has a non-string "example".`,
          location: { file },
          suggestion: 'Set "example" to a string.',
        });
      }
    }

    placeholders[name] = parsed;
  }

  return Object.keys(placeholders).length === 0 ? undefined : placeholders;
}

function validateDefaultReferences(
  references: readonly ManifestMessageReference[],
  defaultCatalog: LocaleCatalog,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const reference of references) {
    if (defaultCatalog.normalizedKeys.has(normalizeMessageKey(reference.key))) {
      continue;
    }

    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_LOCALE_MESSAGE_MISSING',
      severity: 'error',
      message: `Manifest field "${reference.field}" references missing default-locale message "${reference.token}".`,
      suggestion: `Add @${reference.key} to the ${defaultCatalog.locale} locale source.`,
    });
  }

  return diagnostics;
}

function validateOtherLocaleReferences(
  references: readonly ManifestMessageReference[],
  defaultCatalog: LocaleCatalog,
  collection: LocaleCollection,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const normalizedDefault = normalizeLocale(defaultCatalog.locale);

  for (const catalog of collection.catalogs.values()) {
    if (normalizeLocale(catalog.locale) === normalizedDefault) {
      continue;
    }

    for (const reference of references) {
      if (catalog.normalizedKeys.has(normalizeMessageKey(reference.key))) {
        continue;
      }

      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_LOCALE_MESSAGE_MISSING',
        severity: 'warning',
        message: `Locale "${catalog.locale}" is missing message "${reference.key}" referenced by manifest field "${reference.field}".`,
        location: { file: catalog.source },
        suggestion: `Add @${reference.key} to the ${catalog.locale} locale source.`,
      });
    }
  }

  return diagnostics;
}

function invalidLocaleCodeDiagnostic(
  locale: string,
  severity: DiagnosticSeverity,
  file: string,
): Diagnostic {
  return {
    code: 'ADDONOVA_LOCALES_INVALID',
    severity,
    message: `Locale code "${locale}" is invalid.`,
    location: { file },
    suggestion: 'Use a locale code such as "en", "en_GB", or "zh-CN".',
  };
}

function duplicateLocaleDiagnostic(
  existing: LocaleCatalog,
  locale: string,
  file: string,
): Diagnostic {
  return {
    code: 'ADDONOVA_LOCALES_DUPLICATE',
    severity: 'error',
    message: `Locale "${locale}" is defined more than once.`,
    location: { file },
    suggestion: `Remove one of the definitions: ${existing.source} and ${file}.`,
  };
}

function defaultLocaleSuggestion(
  collection: LocaleCollection | undefined,
): string {
  const locales = [...(collection?.catalogs.values() ?? [])]
    .map((catalog) => catalog.locale)
    .sort((left, right) => left.localeCompare(right));

  if (locales.length === 0) {
    return 'Set manifest.default_locale to a locale available under _locales.';
  }

  return `Set manifest.default_locale to one of: ${locales.join(', ')}.`;
}

function getLocaleSeverity(
  locale: string,
  defaultLocale: string | undefined,
): DiagnosticSeverity {
  return defaultLocale !== undefined &&
    normalizeLocale(locale) === normalizeLocale(defaultLocale)
    ? 'error'
    : 'warning';
}

function normalizeLocale(locale: string): string {
  return locale.toLowerCase().replaceAll('-', '_');
}

function normalizeMessageKey(key: string): string {
  return key.toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
