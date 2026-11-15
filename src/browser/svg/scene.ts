import type { Color, Matrix } from './paint.ts';
import {
  applyMatrix,
  identity,
  multiply,
  parseColor,
  parseLength,
  parseTransform,
} from './paint.ts';
import { flattenPath } from './path.ts';
import type { Polyline } from './path.ts';
import { parseXml } from './xml.ts';
import type { XmlNode } from './xml.ts';

export interface GradientStop {
  offset: number;
  color: Color;
}

export interface Gradient {
  type: 'linear' | 'radial';
  stops: GradientStop[];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
  r: number;
  fx: number;
  fy: number;
}

export type Paint =
  | { kind: 'solid'; color: Color }
  | { kind: 'gradient'; gradient: Gradient };

export type FillRule = 'nonzero' | 'evenodd';
export type LineCap = 'butt' | 'round' | 'square';
export type LineJoin = 'miter' | 'round' | 'bevel';

export interface SceneShape {
  polylines: Polyline[];
  fill: Paint | null;
  stroke: Paint | null;
  strokeWidth: number;
  fillOpacity: number;
  strokeOpacity: number;
  opacity: number;
  fillRule: FillRule;
  lineCap: LineCap;
  lineJoin: LineJoin;
  clip: Polyline[] | null;
}

export interface Scene {
  width: number;
  height: number;
  viewBox: { x: number; y: number; width: number; height: number };
  shapes: SceneShape[];
  warnings: string[];
}

interface GradientDef {
  type: 'linear' | 'radial';
  units: 'userSpaceOnUse' | 'objectBoundingBox';
  transform: Matrix;
  coords: Record<string, number>;
  stops: GradientStop[];
  href?: string;
}

interface StyleContext {
  fill: string;
  stroke: string;
  strokeWidth: string;
  fillOpacity: string;
  strokeOpacity: string;
  opacity: string;
  fillRule: string;
  lineCap: string;
  lineJoin: string;
  color: string;
  clipPath: string;
}

const DEFAULT_STYLE: StyleContext = {
  fill: 'black',
  stroke: 'none',
  strokeWidth: '1',
  fillOpacity: '1',
  strokeOpacity: '1',
  opacity: '1',
  fillRule: 'nonzero',
  lineCap: 'butt',
  lineJoin: 'miter',
  color: 'black',
  clipPath: 'none',
};

export function parseSvg(source: string): Scene {
  const warnings: string[] = [];
  const root = parseXml(source);
  const svg = findElement(root, 'svg');

  if (svg === null) {
    throw new Error('SVG document does not contain an <svg> element.');
  }

  const idMap = new Map<string, XmlNode>();
  collectIds(svg, idMap);

  const gradientDefs = new Map<string, GradientDef>();
  collectGradients(svg, gradientDefs);

  const clipDefs = new Map<string, Polyline[]>();
  collectClips(svg, clipDefs);

  const viewBox = parseViewBox(svg);
  const width = parseLength(svg.attributes.width ?? '', viewBox.width) ?? viewBox.width;
  const height =
    parseLength(svg.attributes.height ?? '', viewBox.height) ?? viewBox.height;

  const scene: Scene = {
    width: width > 0 ? width : viewBox.width,
    height: height > 0 ? height : viewBox.height,
    viewBox,
    shapes: [],
    warnings,
  };

  const context: StyleContext = { ...DEFAULT_STYLE };
  walk(svg, identity(), context, scene, gradientDefs, clipDefs, idMap, warnings, 0);

  return scene;
}

function findElement(node: XmlNode, name: string): XmlNode | null {
  if (node.name === name) {
    return node;
  }

  for (const child of node.children) {
    const found = findElement(child, name);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

function collectIds(node: XmlNode, map: Map<string, XmlNode>): void {
  const id = node.attributes.id;

  if (id !== undefined && !map.has(id)) {
    map.set(id, node);
  }

  for (const child of node.children) {
    collectIds(child, map);
  }
}

function collectGradients(
  node: XmlNode,
  map: Map<string, GradientDef>,
): void {
  const name = node.name;

  if ((name === 'lineargradient' || name === 'radialgradient') && node.attributes.id) {
    map.set(node.attributes.id, toGradientDef(node, name === 'radialgradient' ? 'radial' : 'linear'));
  }

  for (const child of node.children) {
    collectGradients(child, map);
  }
}

function toGradientDef(node: XmlNode, type: 'linear' | 'radial'): GradientDef {
  const attributes = node.attributes;
  const coords: Record<string, number> = {};

  for (const key of ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy']) {
    const raw = attributes[key];

    if (raw !== undefined) {
      const parsed = parseLength(raw, 1);

      if (parsed !== null) {
        coords[key] = parsed;
      }
    }
  }

  const href = attributes.href ?? attributes['xlink:href'];
  const def: GradientDef = {
    type,
    units:
      attributes.gradientunits === 'userspaceonuse'
        ? 'userSpaceOnUse'
        : 'objectBoundingBox',
    transform: parseTransform(attributes.gradienttransform),
    coords,
    stops: collectStops(node),
  };

  if (href !== undefined && href.startsWith('#')) {
    def.href = href.slice(1);
  }

  return def;
}

function collectStops(node: XmlNode): GradientStop[] {
  const stops: GradientStop[] = [];

  for (const child of node.children) {
    if (child.name !== 'stop') {
      continue;
    }

    const style = parseStyle(child.attributes.style);
    const offsetRaw = child.attributes.offset ?? '0';
    const offset = offsetRaw.endsWith('%')
      ? Number.parseFloat(offsetRaw) / 100
      : Number.parseFloat(offsetRaw);
    const stopColor = style['stop-color'] ?? child.attributes['stop-color'] ?? 'black';
    const stopOpacity = Number.parseFloat(
      style['stop-opacity'] ?? child.attributes['stop-opacity'] ?? '1',
    );
    const color = parseColor(stopColor) ?? { r: 0, g: 0, b: 0, a: 1 };

    stops.push({
      offset: Number.isFinite(offset) ? Math.max(0, Math.min(1, offset)) : 0,
      color: {
        ...color,
        a: color.a * (Number.isFinite(stopOpacity) ? Math.max(0, Math.min(1, stopOpacity)) : 1),
      },
    });
  }

  return stops;
}

function collectClips(node: XmlNode, map: Map<string, Polyline[]>): void {
  if (node.name === 'clippath' && node.attributes.id) {
    const polylines: Polyline[] = [];

    for (const child of node.children) {
      const shapes = toShapePolylines(child, identity());

      polylines.push(...shapes);
    }

    map.set(node.attributes.id, polylines);
  }

  for (const child of node.children) {
    collectClips(child, map);
  }
}

function parseViewBox(node: XmlNode): { x: number; y: number; width: number; height: number } {
  const raw = node.attributes.viewbox;

  if (raw !== undefined) {
    const parts = raw
      .split(/[\s,]+/)
      .filter((part) => part !== '')
      .map((part) => Number.parseFloat(part));

    if (parts.length === 4) {
      const [x = 0, y = 0, width = 0, height = 0] = parts;

      if (width > 0 && height > 0) {
        return { x, y, width, height };
      }
    }
  }

  const width = parseLength(node.attributes.width ?? '', 0) ?? 24;
  const height = parseLength(node.attributes.height ?? '', 0) ?? 24;

  return { x: 0, y: 0, width: width > 0 ? width : 24, height: height > 0 ? height : 24 };
}

function walk(
  node: XmlNode,
  matrix: Matrix,
  inherited: StyleContext,
  scene: Scene,
  gradientDefs: Map<string, GradientDef>,
  clipDefs: Map<string, Polyline[]>,
  idMap: Map<string, XmlNode>,
  warnings: string[],
  depth: number,
): void {
  if (depth > 32) {
    return;
  }

  for (const child of node.children) {
    const name = child.name;

    if (name === 'defs' || name === 'clippath' || name === 'lineargradient' || name === 'radialgradient' || name === 'style') {
      if (name === 'style') {
        warnings.push('Ignored <style> CSS block; use presentation attributes instead.');
      }

      continue;
    }

    if (name === 'text' || name === 'image' || name === 'filter' || name === 'mask' || name === 'pattern' || name === 'foreignobject' || name === 'marker') {
      warnings.push(`Ignored unsupported <${name}> element.`);
      continue;
    }

    const style = mergeStyle(inherited, child);
    const childMatrix = multiply(matrix, parseTransform(child.attributes.transform));

    if (name === 'g' || name === 'svg' || name === 'a') {
      walk(child, childMatrix, style, scene, gradientDefs, clipDefs, idMap, warnings, depth + 1);
      continue;
    }

    if (name === 'use') {
      applyUse(child, childMatrix, style, scene, gradientDefs, clipDefs, idMap, warnings, depth);
      continue;
    }

    const polylines = toShapePolylines(child, childMatrix);

    if (polylines.length === 0) {
      continue;
    }

    const bbox = computeBounds(polylines);
    const clip = resolveClip(style.clipPath, clipDefs);

    scene.shapes.push({
      polylines,
      fill: resolvePaint(style.fill, style, bbox, gradientDefs),
      stroke: resolvePaint(style.stroke, style, bbox, gradientDefs),
      strokeWidth: scaleStrokeWidth(style.strokeWidth, childMatrix),
      fillOpacity: parseOpacity(style.fillOpacity),
      strokeOpacity: parseOpacity(style.strokeOpacity),
      opacity: parseOpacity(style.opacity),
      fillRule: style.fillRule === 'evenodd' ? 'evenodd' : 'nonzero',
      lineCap: toLineCap(style.lineCap),
      lineJoin: toLineJoin(style.lineJoin),
      clip,
    });
  }
}

function applyUse(
  node: XmlNode,
  matrix: Matrix,
  style: StyleContext,
  scene: Scene,
  gradientDefs: Map<string, GradientDef>,
  clipDefs: Map<string, Polyline[]>,
  idMap: Map<string, XmlNode>,
  warnings: string[],
  depth: number,
): void {
  const href = node.attributes.href ?? node.attributes['xlink:href'];

  if (href === undefined || !href.startsWith('#')) {
    return;
  }

  const target = idMap.get(href.slice(1));

  if (target === undefined) {
    warnings.push(`Ignored <use> reference to missing element "${href}".`);
    return;
  }

  const x = parseLength(node.attributes.x ?? '', 0) ?? 0;
  const y = parseLength(node.attributes.y ?? '', 0) ?? 0;
  const translated = multiply(matrix, { a: 1, b: 0, c: 0, d: 1, e: x, f: y });

  walk(
    { name: '#use', attributes: {}, children: [target] },
    translated,
    style,
    scene,
    gradientDefs,
    clipDefs,
    idMap,
    warnings,
    depth + 1,
  );
}

function toShapePolylines(
  node: XmlNode,
  matrix: Matrix,
): Polyline[] {
  const attributes = node.attributes;
  let polylines: Polyline[] = [];

  switch (node.name) {
    case 'rect': {
      const width = parseLength(attributes.width ?? '', 0) ?? 0;
      const height = parseLength(attributes.height ?? '', 0) ?? 0;

      if (width <= 0 || height <= 0) {
        return [];
      }

      const x = parseLength(attributes.x ?? '', 0) ?? 0;
      const y = parseLength(attributes.y ?? '', 0) ?? 0;
      const rx = Math.min(
        parseLength(attributes.rx ?? '', 0) ?? parseLength(attributes.ry ?? '', 0) ?? 0,
        width / 2,
      );
      const ry = Math.min(
        parseLength(attributes.ry ?? '', 0) ?? parseLength(attributes.rx ?? '', 0) ?? 0,
        height / 2,
      );

      polylines = [rectPolyline(x, y, width, height, rx, ry)];
      break;
    }
    case 'circle': {
      const cx = parseLength(attributes.cx ?? '', 0) ?? 0;
      const cy = parseLength(attributes.cy ?? '', 0) ?? 0;
      const r = parseLength(attributes.r ?? '', 0) ?? 0;

      if (r <= 0) {
        return [];
      }

      polylines = [ellipsePolyline(cx, cy, r, r)];
      break;
    }
    case 'ellipse': {
      const cx = parseLength(attributes.cx ?? '', 0) ?? 0;
      const cy = parseLength(attributes.cy ?? '', 0) ?? 0;
      const rx = parseLength(attributes.rx ?? '', 0) ?? 0;
      const ry = parseLength(attributes.ry ?? '', 0) ?? 0;

      if (rx <= 0 || ry <= 0) {
        return [];
      }

      polylines = [ellipsePolyline(cx, cy, rx, ry)];
      break;
    }
    case 'line': {
      const x1 = parseLength(attributes.x1 ?? '', 0) ?? 0;
      const y1 = parseLength(attributes.y1 ?? '', 0) ?? 0;
      const x2 = parseLength(attributes.x2 ?? '', 0) ?? 0;
      const y2 = parseLength(attributes.y2 ?? '', 0) ?? 0;

      polylines = [{ points: [x1, y1, x2, y2], closed: false }];
      break;
    }
    case 'polyline':
    case 'polygon': {
      const points = parsePoints(attributes.points ?? '');

      if (points.length >= 4) {
        polylines = [{ points, closed: node.name === 'polygon' }];
      }

      break;
    }
    case 'path': {
      const d = attributes.d;

      if (d !== undefined) {
        polylines = flattenPath(d);
      }

      break;
    }
    default:
      return [];
  }

  return polylines.map((polyline) => transformPolyline(polyline, matrix));
}

function transformPolyline(polyline: Polyline, matrix: Matrix): Polyline {
  const points: number[] = [];

  for (let index = 0; index + 1 < polyline.points.length; index += 2) {
    const x = polyline.points[index] ?? 0;
    const y = polyline.points[index + 1] ?? 0;
    const transformed = applyMatrix(matrix, x, y);

    points.push(transformed.x, transformed.y);
  }

  return { points, closed: polyline.closed };
}

function rectPolyline(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  ry: number,
): Polyline {
  if (rx <= 0 || ry <= 0) {
    return {
      points: [x, y, x + width, y, x + width, y + height, x, y + height],
      closed: true,
    };
  }

  const points: number[] = [];
  const arc = (cx: number, cy: number, start: number, end: number): void => {
    const steps = 8;

    for (let step = 0; step <= steps; step += 1) {
      const theta = start + ((end - start) * step) / steps;

      points.push(cx + rx * Math.cos(theta), cy + ry * Math.sin(theta));
    }
  };

  arc(x + width - rx, y + ry, -Math.PI / 2, 0);
  arc(x + width - rx, y + height - ry, 0, Math.PI / 2);
  arc(x + rx, y + height - ry, Math.PI / 2, Math.PI);
  arc(x + rx, y + ry, Math.PI, (3 * Math.PI) / 2);

  return { points, closed: true };
}

function ellipsePolyline(cx: number, cy: number, rx: number, ry: number): Polyline {
  const steps = 64;
  const points: number[] = [];

  for (let step = 0; step < steps; step += 1) {
    const theta = (step / steps) * Math.PI * 2;

    points.push(cx + rx * Math.cos(theta), cy + ry * Math.sin(theta));
  }

  return { points, closed: true };
}

function parsePoints(value: string): number[] {
  const parts = value
    .split(/[\s,]+/)
    .filter((part) => part !== '')
    .map((part) => Number.parseFloat(part));

  const points: number[] = [];

  for (let index = 0; index + 1 < parts.length; index += 2) {
    const x = parts[index];
    const y = parts[index + 1];

    if (x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y)) {
      points.push(x, y);
    }
  }

  return points;
}

function computeBounds(polylines: Polyline[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const polyline of polylines) {
    for (let index = 0; index + 1 < polyline.points.length; index += 2) {
      const x = polyline.points[index] ?? 0;
      const y = polyline.points[index + 1] ?? 0;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function resolveClip(
  reference: string,
  clipDefs: Map<string, Polyline[]>,
): Polyline[] | null {
  const match = /^url\(#(.+)\)$/.exec(reference.trim());

  if (match === null) {
    return null;
  }

  const polylines = clipDefs.get(match[1] ?? '');

  if (polylines === undefined) {
    return null;
  }

  return polylines;
}

function resolvePaint(
  value: string,
  style: StyleContext,
  bbox: { x: number; y: number; width: number; height: number },
  gradientDefs: Map<string, GradientDef>,
): Paint | null {
  const trimmed = value.trim();

  if (trimmed === '' || trimmed.toLowerCase() === 'none') {
    return null;
  }

  const match = /^url\(#(.+)\)$/.exec(trimmed);

  if (match !== null) {
    const def = gradientDefs.get(match[1] ?? '');

    if (def === undefined) {
      return null;
    }

    const gradient = resolveGradient(def, gradientDefs, bbox);

    return gradient === null ? null : { kind: 'gradient', gradient };
  }

  const currentColor = parseColor(style.color) ?? { r: 0, g: 0, b: 0, a: 1 };
  const color = parseColor(trimmed, currentColor);

  if (color === null) {
    return null;
  }

  return { kind: 'solid', color };
}

function resolveGradient(
  def: GradientDef,
  defs: Map<string, GradientDef>,
  bbox: { x: number; y: number; width: number; height: number },
  depth = 0,
): Gradient | null {
  if (depth > 8) {
    return null;
  }

  let stops = def.stops;
  let coords = def.coords;
  let units = def.units;
  let transform = def.transform;

  if (def.href !== undefined) {
    const parent = defs.get(def.href);

    if (parent !== undefined) {
      const resolvedParent = resolveGradient(parent, defs, bbox, depth + 1);

      if (stops.length === 0 && resolvedParent !== null) {
        stops = resolvedParent.stops;
      }

      if (Object.keys(coords).length === 0) {
        coords = parent.coords;
        units = parent.units;
        transform = parent.transform;
      }
    }
  }

  if (stops.length === 0) {
    return null;
  }

  const map = (nx: number, ny: number): { x: number; y: number } => {
    if (units === 'objectBoundingBox') {
      return {
        x: bbox.x + nx * bbox.width,
        y: bbox.y + ny * bbox.height,
      };
    }

    return { x: nx, y: ny };
  };

  const size = units === 'objectBoundingBox' ? Math.max(bbox.width, bbox.height) : 1;
  const transformPoint = (point: { x: number; y: number }): { x: number; y: number } =>
    applyMatrix(transform, point.x, point.y);

  const x1 = transformPoint(map(coords.x1 ?? 0, coords.y1 ?? 0));
  const x2 = transformPoint(map(coords.x2 ?? 1, coords.y2 ?? 0));
  const center = transformPoint(map(coords.cx ?? 0.5, coords.cy ?? 0.5));
  const focus = transformPoint(map(coords.fx ?? coords.cx ?? 0.5, coords.fy ?? coords.cy ?? 0.5));

  return {
    type: def.type,
    stops: [...stops].sort((left, right) => left.offset - right.offset),
    x1: x1.x,
    y1: x1.y,
    x2: x2.x,
    y2: x2.y,
    cx: center.x,
    cy: center.y,
    r: (coords.r ?? 0.5) * size,
    fx: focus.x,
    fy: focus.y,
  };
}

function mergeStyle(parent: StyleContext, node: XmlNode): StyleContext {
  const inline = parseStyle(node.attributes.style);
  const attributes = node.attributes;
  const next: StyleContext = { ...parent };

  const mappings: ReadonlyArray<readonly [keyof StyleContext, string]> = [
    ['fill', 'fill'],
    ['stroke', 'stroke'],
    ['strokeWidth', 'stroke-width'],
    ['fillOpacity', 'fill-opacity'],
    ['strokeOpacity', 'stroke-opacity'],
    ['opacity', 'opacity'],
    ['fillRule', 'fill-rule'],
    ['lineCap', 'stroke-linecap'],
    ['lineJoin', 'stroke-linejoin'],
    ['color', 'color'],
    ['clipPath', 'clip-path'],
  ];

  for (const [field, attribute] of mappings) {
    const inlineValue = inline[attribute];
    const attributeValue = attributes[attribute];

    if (inlineValue !== undefined) {
      next[field] = inlineValue;
    } else if (attributeValue !== undefined) {
      next[field] = attributeValue;
    }
  }

  return next;
}

function parseStyle(value: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};

  if (value === undefined) {
    return result;
  }

  for (const declaration of value.split(';')) {
    const separator = declaration.indexOf(':');

    if (separator === -1) {
      continue;
    }

    const property = declaration.slice(0, separator).trim().toLowerCase();
    const rawValue = declaration.slice(separator + 1).trim();

    if (property !== '') {
      result[property] = rawValue;
    }
  }

  return result;
}

function scaleStrokeWidth(value: string, matrix: Matrix): number {
  const base = parseLength(value, 1) ?? 1;
  const scale = Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c));

  return base * (Number.isFinite(scale) && scale > 0 ? scale : 1);
}

function parseOpacity(value: string): number {
  const parsed = value.endsWith('%')
    ? Number.parseFloat(value) / 100
    : Number.parseFloat(value);

  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 1;
}

function toLineCap(value: string): LineCap {
  return value === 'round' || value === 'square' ? value : 'butt';
}

function toLineJoin(value: string): LineJoin {
  return value === 'round' || value === 'bevel' ? value : 'miter';
}
