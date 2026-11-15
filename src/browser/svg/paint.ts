export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const NAMED_COLORS: Readonly<Record<string, string>> = {
  aliceblue: '#f0f8ff',
  antiquewhite: '#faebd7',
  aqua: '#00ffff',
  aquamarine: '#7fffd4',
  azure: '#f0ffff',
  beige: '#f5f5dc',
  black: '#000000',
  blue: '#0000ff',
  brown: '#a52a2a',
  chartreuse: '#7fff00',
  chocolate: '#d2691e',
  coral: '#ff7f50',
  cornflowerblue: '#6495ed',
  crimson: '#dc143c',
  cyan: '#00ffff',
  darkblue: '#00008b',
  darkgray: '#a9a9a9',
  darkgreen: '#006400',
  darkgrey: '#a9a9a9',
  darkorange: '#ff8c00',
  darkred: '#8b0000',
  deepskyblue: '#00bfff',
  dimgray: '#696969',
  dimgrey: '#696969',
  dodgerblue: '#1e90ff',
  firebrick: '#b22222',
  forestgreen: '#228b22',
  fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc',
  gold: '#ffd700',
  goldenrod: '#daa520',
  gray: '#808080',
  green: '#008000',
  grey: '#808080',
  hotpink: '#ff69b4',
  indigo: '#4b0082',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  lightblue: '#add8e6',
  lightgray: '#d3d3d3',
  lightgreen: '#90ee90',
  lightgrey: '#d3d3d3',
  lime: '#00ff00',
  limegreen: '#32cd32',
  magenta: '#ff00ff',
  maroon: '#800000',
  midnightblue: '#191970',
  navy: '#000080',
  olive: '#808000',
  orange: '#ffa500',
  orangered: '#ff4500',
  orchid: '#da70d6',
  pink: '#ffc0cb',
  plum: '#dda0dd',
  purple: '#800080',
  red: '#ff0000',
  royalblue: '#4169e1',
  salmon: '#fa8072',
  seagreen: '#2e8b57',
  sienna: '#a0522d',
  silver: '#c0c0c0',
  skyblue: '#87ceeb',
  slategray: '#708090',
  slategrey: '#708090',
  snow: '#fffafa',
  steelblue: '#4682b4',
  tan: '#d2b48c',
  teal: '#008080',
  tomato: '#ff6347',
  turquoise: '#40e0d0',
  violet: '#ee82ee',
  wheat: '#f5deb3',
  white: '#ffffff',
  whitesmoke: '#f5f5f5',
  yellow: '#ffff00',
  yellowgreen: '#9acd32',
};

export const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

export function parseColor(
  input: string,
  currentColor: Color = { r: 0, g: 0, b: 0, a: 1 },
): Color | null {
  const value = input.trim().toLowerCase();

  if (value === '' || value === 'none') {
    return null;
  }

  if (value === 'transparent') {
    return { ...TRANSPARENT };
  }

  if (value === 'currentcolor') {
    return { ...currentColor };
  }

  if (value.startsWith('#')) {
    return parseHexColor(value);
  }

  const functional = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(value);

  if (functional !== null) {
    return parseFunctionalColor(functional[1] ?? '', functional[2] ?? '', currentColor);
  }

  const named = NAMED_COLORS[value];

  if (named !== undefined) {
    return parseHexColor(named);
  }

  return null;
}

function parseHexColor(value: string): Color | null {
  const hex = value.slice(1);

  if (!/^[0-9a-f]+$/.test(hex)) {
    return null;
  }

  if (hex.length === 3 || hex.length === 4) {
    const r = Number.parseInt(hex[0]?.repeat(2) ?? '0', 16);
    const g = Number.parseInt(hex[1]?.repeat(2) ?? '0', 16);
    const b = Number.parseInt(hex[2]?.repeat(2) ?? '0', 16);
    const a = hex.length === 4 ? Number.parseInt(hex[3]?.repeat(2) ?? 'ff', 16) : 255;

    return { r, g, b, a: a / 255 };
  }

  if (hex.length === 6 || hex.length === 8) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255;

    return { r, g, b, a: a / 255 };
  }

  return null;
}

function parseFunctionalColor(
  name: string,
  body: string,
  currentColor: Color,
): Color | null {
  const parts = body
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter((part) => part !== '');

  if (parts.length < 3) {
    return null;
  }

  if (name === 'rgb' || name === 'rgba') {
    const r = parseChannel(parts[0] ?? '');
    const g = parseChannel(parts[1] ?? '');
    const b = parseChannel(parts[2] ?? '');
    const a = parts[3] === undefined ? 1 : parseAlpha(parts[3]);

    return { r, g, b, a };
  }

  if (name === 'hsl' || name === 'hsla') {
    const h = parseAngle(parts[0] ?? '');
    const s = parsePercentValue(parts[1] ?? '');
    const l = parsePercentValue(parts[2] ?? '');
    const a = parts[3] === undefined ? 1 : parseAlpha(parts[3]);

    return hslToColor(h, s, l, a);
  }

  void currentColor;

  return null;
}

function parseChannel(value: string): number {
  if (value.endsWith('%')) {
    return clampByte((Number.parseFloat(value) / 100) * 255);
  }

  return clampByte(Number.parseFloat(value));
}

function parseAlpha(value: string): number {
  if (value.endsWith('%')) {
    return clamp01(Number.parseFloat(value) / 100);
  }

  return clamp01(Number.parseFloat(value));
}

function parseAngle(value: string): number {
  return Number.parseFloat(value);
}

function parsePercentValue(value: string): number {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

function hslToColor(h: number, s: number, l: number, a: number): Color {
  const hue = ((h % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hp = hue / 60;
  const x = chroma * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hp >= 0 && hp < 1) {
    r = chroma;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = chroma;
  } else if (hp < 3) {
    g = chroma;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = chroma;
  } else if (hp < 5) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  const m = l - chroma / 2;

  return {
    r: clampByte((r + m) * 255),
    g: clampByte((g + m) * 255),
    b: clampByte((b + m) * 255),
    a,
  };
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(0, Math.min(1, value));
}

export function parseLength(value: string, percentBase: number): number | null {
  const trimmed = value.trim();

  if (trimmed === '') {
    return null;
  }

  const match = /^(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i.exec(trimmed);

  if (match === null) {
    return null;
  }

  const amount = Number.parseFloat(match[1] ?? '');

  if (!Number.isFinite(amount)) {
    return null;
  }

  const unit = (match[2] ?? '').toLowerCase();

  switch (unit) {
    case '':
    case 'px':
      return amount;
    case '%':
      return (amount / 100) * percentBase;
    case 'pt':
      return (amount * 96) / 72;
    case 'pc':
      return amount * 16;
    case 'in':
      return amount * 96;
    case 'cm':
      return (amount * 96) / 2.54;
    case 'mm':
      return (amount * 96) / 25.4;
    case 'em':
      return amount * 16;
    case 'ex':
      return amount * 8;
    default:
      return null;
  }
}

export function identity(): Matrix {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

export function multiply(left: Matrix, right: Matrix): Matrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

export function applyMatrix(
  matrix: Matrix,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

export function parseTransform(value: string | undefined): Matrix {
  if (value === undefined || value.trim() === '') {
    return identity();
  }

  let matrix = identity();
  const pattern = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const name = (match[1] ?? '').toLowerCase();
    const args = (match[2] ?? '')
      .split(/[\s,]+/)
      .filter((part) => part !== '')
      .map((part) => Number.parseFloat(part));

    matrix = multiply(matrix, transformMatrix(name, args));
  }

  return matrix;
}

function transformMatrix(name: string, args: number[]): Matrix {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = args;

  switch (name) {
    case 'matrix':
      return { a, b, c, d, e, f };
    case 'translate':
      return { a: 1, b: 0, c: 0, d: 1, e: args[0] ?? 0, f: args[1] ?? 0 };
    case 'scale':
      return {
        a: args[0] ?? 1,
        b: 0,
        c: 0,
        d: args[1] ?? args[0] ?? 1,
        e: 0,
        f: 0,
      };
    case 'rotate': {
      const radians = ((args[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const rotation: Matrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };

      if (args.length >= 3) {
        const cx = args[1] ?? 0;
        const cy = args[2] ?? 0;

        return multiply(
          multiply(
            { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy },
            rotation,
          ),
          { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy },
        );
      }

      return rotation;
    }
    case 'skewx':
      return {
        a: 1,
        b: 0,
        c: Math.tan(((args[0] ?? 0) * Math.PI) / 180),
        d: 1,
        e: 0,
        f: 0,
      };
    case 'skewy':
      return {
        a: 1,
        b: Math.tan(((args[0] ?? 0) * Math.PI) / 180),
        c: 0,
        d: 1,
        e: 0,
        f: 0,
      };
    default:
      return identity();
  }
}

export function toRgbaBytes(color: Color, opacity: number): [number, number, number, number] {
  return [
    color.r,
    color.g,
    color.b,
    Math.max(0, Math.min(1, color.a * opacity)),
  ];
}
