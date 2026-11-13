import { readdirSync } from 'node:fs';
import path from 'node:path';

export interface ThemeIcon {
  light: string;
  dark: string;
  size: number;
}

export interface DiscoveredIcons {
  icons: Record<string, string>;
  themeIcons: ThemeIcon[];
  warnings: string[];
}

const ICON_PATTERN = /^icon[-_]?(\d+)\.(png|svg)$/i;
const THEME_PATTERN = /^icon-(light|dark)[-_]?(\d+)\.(png|svg)$/i;

export function discoverIcons(directory: string): DiscoveredIcons {
  const icons: Record<string, string> = {};
  const themeIcons: ThemeIcon[] = [];
  const warnings: string[] = [];
  const light = new Map<number, string>();
  const dark = new Map<number, string>();

  walk('', 0);

  const sizes = new Set([...light.keys(), ...dark.keys()]);

  for (const size of [...sizes].sort((left, right) => left - right)) {
    const lightPath = light.get(size);
    const darkPath = dark.get(size);

    if (lightPath !== undefined && darkPath !== undefined) {
      themeIcons.push({ light: lightPath, dark: darkPath, size });
      continue;
    }

    warnings.push(
      lightPath !== undefined
        ? `Icon "${lightPath}" has no matching dark theme icon for size ${size}.`
        : `Icon "${darkPath}" has no matching light theme icon for size ${size}.`,
    );
  }

  return { icons, themeIcons, warnings };

  function walk(relativeDirectory: string, depth: number): void {
    if (depth > 1) {
      return;
    }

    let entries;

    try {
      entries = readdirSync(path.join(directory, relativeDirectory), {
        withFileTypes: true,
      });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relativePath = path
        .join(relativeDirectory, entry.name)
        .split(path.sep)
        .join('/');

      if (entry.isDirectory()) {
        if (entry.name.toLowerCase() === 'icons') {
          walk(relativePath, depth + 1);
        }

        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const themeMatch = THEME_PATTERN.exec(entry.name);

      if (themeMatch !== null) {
        const variant = themeMatch[1]?.toLowerCase();
        const size = Number(themeMatch[2]);

        if (!Number.isFinite(size) || size <= 0) {
          warnings.push(
            `Ignored theme icon "${relativePath}" because its size is invalid.`,
          );
          continue;
        }

        if (variant === 'light') {
          light.set(size, relativePath);
        } else if (variant === 'dark') {
          dark.set(size, relativePath);
        }

        continue;
      }

      const iconMatch = ICON_PATTERN.exec(entry.name);

      if (iconMatch === null) {
        if (/^icon[-_]/i.test(entry.name)) {
          warnings.push(
            `Ignored unsupported icon file "${relativePath}". Use icon-<size>.(png|svg) or icon-(light|dark)-<size>.(png|svg).`,
          );
        }

        continue;
      }

      const size = Number(iconMatch[1]);

      if (!Number.isFinite(size) || size <= 0) {
        warnings.push(
          `Ignored icon "${relativePath}" because its size is invalid.`,
        );
        continue;
      }

      if (icons[String(size)] !== undefined) {
        warnings.push(
          `Ignored duplicate icon "${relativePath}" for size ${size}.`,
        );
        continue;
      }

      icons[String(size)] = relativePath;
    }
  }
}
