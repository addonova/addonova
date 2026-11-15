import type { Color } from './paint.ts';
import type { Gradient, LineCap, Paint, Scene, SceneShape } from './scene.ts';
import type { Polyline } from './path.ts';
import type { RgbaImage } from './png.ts';

const SUPERSAMPLE = 4;

export function rasterizeScene(scene: Scene, size: number): RgbaImage {
  const high = renderScene(scene, size * SUPERSAMPLE, size * SUPERSAMPLE);

  return downsample(high, size, size);
}

export function renderScene(scene: Scene, width: number, height: number): RgbaImage {
  const data = new Float32Array(width * height * 4);
  const viewport = createViewport(scene, width, height);

  for (const shape of scene.shapes) {
    renderShape(shape, data, width, height, viewport);
  }

  const bytes = new Uint8Array(width * height * 4);

  for (let index = 0; index < data.length; index += 1) {
    bytes[index] = Math.round(Math.max(0, Math.min(1, data[index] ?? 0)) * 255);
  }

  return { width, height, data: bytes };
}

export function downsample(
  image: RgbaImage,
  targetWidth: number,
  targetHeight: number,
): RgbaImage {
  if (image.width === targetWidth && image.height === targetHeight) {
    return image;
  }

  const output = new Uint8Array(targetWidth * targetHeight * 4);
  const scaleX = image.width / targetWidth;
  const scaleY = image.height / targetHeight;

  for (let y = 0; y < targetHeight; y += 1) {
    const y0 = Math.floor(y * scaleY);
    const y1 = Math.min(image.height, Math.max(y0 + 1, Math.ceil((y + 1) * scaleY)));

    for (let x = 0; x < targetWidth; x += 1) {
      const x0 = Math.floor(x * scaleX);
      const x1 = Math.min(image.width, Math.max(x0 + 1, Math.ceil((x + 1) * scaleX)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const offset = (sy * image.width + sx) * 4;
          const alpha = (image.data[offset + 3] ?? 0) / 255;

          r += (image.data[offset] ?? 0) * alpha;
          g += (image.data[offset + 1] ?? 0) * alpha;
          b += (image.data[offset + 2] ?? 0) * alpha;
          a += alpha;
          count += 1;
        }
      }

      const target = (y * targetWidth + x) * 4;
      const averageAlpha = a / count;

      if (averageAlpha > 0) {
        output[target] = Math.round(r / count / averageAlpha);
        output[target + 1] = Math.round(g / count / averageAlpha);
        output[target + 2] = Math.round(b / count / averageAlpha);
      }

      output[target + 3] = Math.round(averageAlpha * 255);
    }
  }

  return { width: targetWidth, height: targetHeight, data: output };
}

interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function createViewport(scene: Scene, width: number, height: number): Viewport {
  const viewBox = scene.viewBox;
  const scale = Math.min(width / viewBox.width, height / viewBox.height);

  return {
    scale,
    offsetX: (width - viewBox.width * scale) / 2 - viewBox.x * scale,
    offsetY: (height - viewBox.height * scale) / 2 - viewBox.y * scale,
  };
}

function renderShape(
  shape: SceneShape,
  data: Float32Array,
  width: number,
  height: number,
  viewport: Viewport,
): void {
  const bounds = shapeBounds(shape);

  if (bounds === null) {
    return;
  }

  const x0 = Math.max(0, Math.floor(bounds.x0 * viewport.scale + viewport.offsetX));
  const y0 = Math.max(0, Math.floor(bounds.y0 * viewport.scale + viewport.offsetY));
  const x1 = Math.min(width - 1, Math.ceil(bounds.x1 * viewport.scale + viewport.offsetX));
  const y1 = Math.min(height - 1, Math.ceil(bounds.y1 * viewport.scale + viewport.offsetY));

  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const userX = (px + 0.5 - viewport.offsetX) / viewport.scale;
      const userY = (py + 0.5 - viewport.offsetY) / viewport.scale;

      if (shape.clip !== null && !insideFill(shape.clip, userX, userY, 'nonzero')) {
        continue;
      }

      const offset = (py * width + px) * 4;

      if (shape.fill !== null && insideFill(shape.polylines, userX, userY, shape.fillRule)) {
        const color = samplePaint(shape.fill, userX, userY);

        if (color !== null) {
          blend(data, offset, color, shape.fillOpacity * shape.opacity);
        }
      }

      if (
        shape.stroke !== null &&
        shape.strokeWidth > 0 &&
        insideStroke(shape.polylines, userX, userY, shape.strokeWidth / 2, shape.lineCap)
      ) {
        const color = samplePaint(shape.stroke, userX, userY);

        if (color !== null) {
          blend(data, offset, color, shape.strokeOpacity * shape.opacity);
        }
      }
    }
  }
}

function shapeBounds(
  shape: SceneShape,
): { x0: number; y0: number; x1: number; y1: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const polyline of shape.polylines) {
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
    return null;
  }

  const pad = shape.stroke !== null ? shape.strokeWidth / 2 + 1 : 0;

  return { x0: minX - pad, y0: minY - pad, x1: maxX + pad, y1: maxY + pad };
}

function insideFill(
  polylines: Polyline[],
  px: number,
  py: number,
  rule: 'nonzero' | 'evenodd',
): boolean {
  if (rule === 'evenodd') {
    let crossings = 0;

    for (const polyline of polylines) {
      const points = polyline.points;

      for (let index = 0; index + 3 < points.length; index += 2) {
        const x1 = points[index] ?? 0;
        const y1 = points[index + 1] ?? 0;
        const x2 = points[index + 2] ?? 0;
        const y2 = points[index + 3] ?? 0;

        if (y1 > py !== y2 > py) {
          const x = x1 + ((py - y1) / (y2 - y1)) * (x2 - x1);

          if (px < x) {
            crossings += 1;
          }
        }
      }
    }

    return crossings % 2 === 1;
  }

  let winding = 0;

  for (const polyline of polylines) {
    const points = polyline.points;

    for (let index = 0; index + 3 < points.length; index += 2) {
      const x1 = points[index] ?? 0;
      const y1 = points[index + 1] ?? 0;
      const x2 = points[index + 2] ?? 0;
      const y2 = points[index + 3] ?? 0;

      if (y1 <= py) {
        if (y2 > py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) > 0) {
          winding += 1;
        }
      } else if (y2 <= py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) < 0) {
        winding -= 1;
      }
    }
  }

  return winding !== 0;
}

function insideStroke(
  polylines: Polyline[],
  px: number,
  py: number,
  halfWidth: number,
  cap: LineCap,
): boolean {
  for (const polyline of polylines) {
    const points = polyline.points;
    const count = Math.floor(points.length / 2);

    for (let index = 0; index + 1 < count; index += 1) {
      const ax = points[index * 2] ?? 0;
      const ay = points[index * 2 + 1] ?? 0;
      const bx = points[(index + 1) * 2] ?? 0;
      const by = points[(index + 1) * 2 + 1] ?? 0;

      if (segmentCovers(px, py, ax, ay, bx, by, halfWidth, cap)) {
        return true;
      }
    }
  }

  return false;
}

function segmentCovers(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  halfWidth: number,
  cap: LineCap,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(px - ax, py - ay) <= halfWidth;
  }

  const t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;

  if (t >= 0 && t <= 1) {
    const closestX = ax + t * dx;
    const closestY = ay + t * dy;

    return Math.hypot(px - closestX, py - closestY) <= halfWidth;
  }

  if (cap === 'round') {
    const endX = t < 0 ? ax : bx;
    const endY = t < 0 ? ay : by;

    return Math.hypot(px - endX, py - endY) <= halfWidth;
  }

  if (cap === 'square') {
    const endX = t < 0 ? ax : bx;
    const endY = t < 0 ? ay : by;
    const along = Math.abs((px - endX) * (dx / Math.sqrt(lengthSquared)) + (py - endY) * (dy / Math.sqrt(lengthSquared)));
    const perp = Math.abs((px - endX) * (-dy / Math.sqrt(lengthSquared)) + (py - endY) * (dx / Math.sqrt(lengthSquared)));

    return along <= halfWidth && perp <= halfWidth;
  }

  return false;
}

function samplePaint(paint: Paint, x: number, y: number): Color | null {
  if (paint.kind === 'solid') {
    return paint.color;
  }

  return sampleGradient(paint.gradient, x, y);
}

function sampleGradient(gradient: Gradient, x: number, y: number): Color | null {
  const stops = gradient.stops;

  if (stops.length === 0) {
    return null;
  }

  let t: number;

  if (gradient.type === 'linear') {
    const dx = gradient.x2 - gradient.x1;
    const dy = gradient.y2 - gradient.y1;
    const lengthSquared = dx * dx + dy * dy;

    t = lengthSquared === 0 ? 0 : ((x - gradient.x1) * dx + (y - gradient.y1) * dy) / lengthSquared;
  } else {
    const distance = Math.hypot(x - gradient.cx, y - gradient.cy);

    t = gradient.r === 0 ? 0 : distance / gradient.r;
  }

  t = Math.max(0, Math.min(1, t));

  const first = stops[0];

  if (first === undefined) {
    return null;
  }

  if (t <= first.offset) {
    return first.color;
  }

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const current = stops[index];

    if (previous === undefined || current === undefined) {
      continue;
    }

    if (t <= current.offset) {
      const span = current.offset - previous.offset;
      const local = span === 0 ? 0 : (t - previous.offset) / span;

      return {
        r: previous.color.r + (current.color.r - previous.color.r) * local,
        g: previous.color.g + (current.color.g - previous.color.g) * local,
        b: previous.color.b + (current.color.b - previous.color.b) * local,
        a: previous.color.a + (current.color.a - previous.color.a) * local,
      };
    }
  }

  return stops[stops.length - 1]?.color ?? null;
}

function blend(data: Float32Array, offset: number, color: Color, opacity: number): void {
  const alpha = Math.max(0, Math.min(1, color.a * opacity));

  if (alpha <= 0) {
    return;
  }

  const dr = data[offset] ?? 0;
  const dg = data[offset + 1] ?? 0;
  const db = data[offset + 2] ?? 0;
  const da = data[offset + 3] ?? 0;

  const outA = alpha + da * (1 - alpha);

  if (outA <= 0) {
    return;
  }

  data[offset] = (color.r / 255) * alpha + dr * (1 - alpha);
  data[offset + 1] = (color.g / 255) * alpha + dg * (1 - alpha);
  data[offset + 2] = (color.b / 255) * alpha + db * (1 - alpha);
  data[offset + 3] = outA;
}
