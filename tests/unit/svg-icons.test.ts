import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import { convertSvgIcons } from '../../src/browser/svg-icons.ts';
import { parseSvg } from '../../src/browser/svg/scene.ts';
import { renderScene } from '../../src/browser/svg/rasterize.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createOutdir(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-svg-'));
  tempDirs.push(root);
  return root;
}

function writeSvg(root: string, relativePath: string, contents: string): void {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, 'utf8');
}

function pixel(
  image: { width: number; data: Uint8Array },
  x: number,
  y: number,
): [number, number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [
    image.data[offset] ?? 0,
    image.data[offset + 1] ?? 0,
    image.data[offset + 2] ?? 0,
    image.data[offset + 3] ?? 0,
  ];
}

describe('svg rasterizer', () => {
  it('fills shapes with solid colors', () => {
    const scene = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ff0000"/></svg>',
    );
    const image = renderScene(scene, 8, 8);
    const [r, g, b, a] = pixel(image, 4, 4);

    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(40);
    expect(b).toBeLessThan(40);
    expect(a).toBe(255);
  });

  it('renders linear gradients across the shape', () => {
    const scene = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#ff0000"/>' +
        '<stop offset="1" stop-color="#0000ff"/>' +
        '</linearGradient></defs>' +
        '<rect width="100" height="100" fill="url(#g)"/>' +
        '</svg>',
    );
    const image = renderScene(scene, 16, 16);
    const left = pixel(image, 1, 8);
    const right = pixel(image, 14, 8);

    expect(left[0]).toBeGreaterThan(right[0]);
    expect(right[2]).toBeGreaterThan(left[2]);
  });

  it('honors transform attributes', () => {
    const scene = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
        '<rect width="50" height="50" fill="#00ff00" transform="translate(50 50)"/>' +
        '</svg>',
    );
    const image = renderScene(scene, 8, 8);
    const bottomRight = pixel(image, 7, 7);
    const topLeft = pixel(image, 0, 0);

    expect(bottomRight[1]).toBeGreaterThan(200);
    expect(topLeft[3]).toBe(0);
  });

  it('reports unsupported elements as warnings', () => {
    const scene = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="0" y="0">hi</text></svg>',
    );

    expect(scene.warnings).toHaveLength(1);
    expect(scene.warnings[0]).toContain('unsupported <text>');
  });
});

describe('svg icon conversion', () => {
  const rectSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#0f766e"/></svg>';

  it('converts string references into sized icon maps', () => {
    const root = createOutdir();
    writeSvg(root, 'icons/icon.svg', rectSvg);

    const result = convertSvgIcons(
      { icons: 'icons/icon.svg' },
      { sizes: [32, 48, 64, 128], outdir: root },
    );

    expect(result.manifest.icons).toEqual({
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '64': 'icons/icon-64.png',
      '128': 'icons/icon-128.png',
    });
    expect(result.generated).toHaveLength(4);
    expect(result.diagnostics.every((item) => item.severity === 'info')).toBe(true);

    for (const size of [32, 48, 64, 128]) {
      const file = path.join(root, `icons/icon-${size}.png`);

      expect(existsSync(file)).toBe(true);
      expect([...readFileSync(file).subarray(0, 8)]).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
    }
  });

  it('rewrites sized dictionaries, action icons, and theme icons', () => {
    const root = createOutdir();
    writeSvg(root, 'icons/icon.svg', rectSvg);
    writeSvg(root, 'icons/icon-light.svg', rectSvg);
    writeSvg(root, 'icons/icon-dark.svg', rectSvg);

    const result = convertSvgIcons(
      {
        icons: { '48': 'icons/icon.svg' },
        action: { default_icon: { '16': 'icons/icon.svg' } },
        theme_icons: [
          {
            light: 'icons/icon-light.svg',
            dark: 'icons/icon-dark.svg',
            size: 96,
          },
        ],
      },
      { sizes: [32, 48, 64, 128], outdir: root },
    );

    expect(result.manifest.icons).toEqual({ '48': 'icons/icon-48.png' });
    expect(
      (result.manifest.action as { default_icon: Record<string, string> })
        .default_icon,
    ).toEqual({ '16': 'icons/icon-16.png' });
    expect(result.manifest.theme_icons).toEqual([
      {
        light: 'icons/icon-light-96.png',
        dark: 'icons/icon-dark-96.png',
        size: 96,
      },
    ]);
  });

  it('reports missing and invalid SVG sources', () => {
    const root = createOutdir();
    writeSvg(root, 'icons/broken.svg', 'not xml at all');

    const result = convertSvgIcons(
      {
        icons: {
          '48': 'icons/missing.svg',
          '96': 'icons/broken.svg',
        },
      },
      { sizes: [32, 48], outdir: root },
    );

    const codes = result.diagnostics.map((item) => item.code);

    expect(codes).toContain('ADDONOVA_ICON_SVG_MISSING');
    expect(codes).toContain('ADDONOVA_ICON_SVG_INVALID');
    expect(result.generated).toHaveLength(0);
  });

  it('surfaces unsupported element warnings', () => {
    const root = createOutdir();
    writeSvg(
      root,
      'icons/icon.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="0" y="0">hi</text></svg>',
    );

    const result = convertSvgIcons(
      { icons: 'icons/icon.svg' },
      { sizes: [32], outdir: root },
    );

    expect(result.diagnostics.some((item) => item.code === 'ADDONOVA_ICON_SVG_UNSUPPORTED')).toBe(
      true,
    );
  });
});
