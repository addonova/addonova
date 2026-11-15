export interface Polyline {
  points: number[];
  closed: boolean;
}

export function flattenPath(d: string, tolerance = 0.25): Polyline[] {
  const tokens = tokenizePath(d);
  const polylines: Polyline[] = [];
  let current: Polyline | null = null;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let lastControlX = 0;
  let lastControlY = 0;
  let lastCommand = '';
  let index = 0;

  const ensure = (): Polyline => {
    if (current === null) {
      current = { points: [cx, cy], closed: false };
      polylines.push(current);
    }

    return current;
  };

  const lineTo = (x: number, y: number): void => {
    ensure().points.push(x, y);
    cx = x;
    cy = y;
  };

  while (index < tokens.length) {
    const token = tokens[index];

    if (token === undefined) {
      break;
    }

    if (typeof token === 'string') {
      index += 1;
      lastCommand = token;
    } else if (lastCommand === '') {
      index += 1;
      continue;
    }

    const command = lastCommand;
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    const indexBefore = index;

    const num = (): number => {
      const value = tokens[index];

      index += 1;

      return typeof value === 'number' ? value : 0;
    };

    const hasNumber = (): boolean => typeof tokens[index] === 'number';

    switch (upper) {
      case 'M': {
        if (!hasNumber()) {
          break;
        }

        const x = relative ? cx + num() : num();
        const y = relative ? cy + num() : num();

        current = { points: [x, y], closed: false };
        polylines.push(current);
        cx = x;
        cy = y;
        startX = x;
        startY = y;
        lastCommand = relative ? 'l' : 'L';

        while (hasNumber()) {
          const lx = relative ? cx + num() : num();
          const ly = relative ? cy + num() : num();

          lineTo(lx, ly);
        }

        break;
      }
      case 'L': {
        while (hasNumber()) {
          lineTo(relative ? cx + num() : num(), relative ? cy + num() : num());
        }

        break;
      }
      case 'H': {
        while (hasNumber()) {
          lineTo(relative ? cx + num() : num(), cy);
        }

        break;
      }
      case 'V': {
        while (hasNumber()) {
          lineTo(cx, relative ? cy + num() : num());
        }

        break;
      }
      case 'C': {
        while (hasNumber()) {
          const x1 = relative ? cx + num() : num();
          const y1 = relative ? cy + num() : num();
          const x2 = relative ? cx + num() : num();
          const y2 = relative ? cy + num() : num();
          const x = relative ? cx + num() : num();
          const y = relative ? cy + num() : num();

          flattenCubic(
            ensure().points,
            cx,
            cy,
            x1,
            y1,
            x2,
            y2,
            x,
            y,
            tolerance,
            0,
          );
          lastControlX = x2;
          lastControlY = y2;
          cx = x;
          cy = y;
        }

        break;
      }
      case 'S': {
        while (hasNumber()) {
          const x2 = relative ? cx + num() : num();
          const y2 = relative ? cy + num() : num();
          const x = relative ? cx + num() : num();
          const y = relative ? cy + num() : num();
          const reflectX =
            'CS'.includes(lastCommand.toUpperCase()) ? 2 * cx - lastControlX : cx;
          const reflectY =
            'CS'.includes(lastCommand.toUpperCase()) ? 2 * cy - lastControlY : cy;

          flattenCubic(
            ensure().points,
            cx,
            cy,
            reflectX,
            reflectY,
            x2,
            y2,
            x,
            y,
            tolerance,
            0,
          );
          lastControlX = x2;
          lastControlY = y2;
          cx = x;
          cy = y;
        }

        break;
      }
      case 'Q': {
        while (hasNumber()) {
          const x1 = relative ? cx + num() : num();
          const y1 = relative ? cy + num() : num();
          const x = relative ? cx + num() : num();
          const y = relative ? cy + num() : num();

          flattenQuadratic(ensure().points, cx, cy, x1, y1, x, y, tolerance, 0);
          lastControlX = x1;
          lastControlY = y1;
          cx = x;
          cy = y;
        }

        break;
      }
      case 'T': {
        while (hasNumber()) {
          const x = relative ? cx + num() : num();
          const y = relative ? cy + num() : num();
          const reflectX =
            'QT'.includes(lastCommand.toUpperCase()) ? 2 * cx - lastControlX : cx;
          const reflectY =
            'QT'.includes(lastCommand.toUpperCase()) ? 2 * cy - lastControlY : cy;

          flattenQuadratic(
            ensure().points,
            cx,
            cy,
            reflectX,
            reflectY,
            x,
            y,
            tolerance,
            0,
          );
          lastControlX = reflectX;
          lastControlY = reflectY;
          cx = x;
          cy = y;
        }

        break;
      }
      case 'A': {
        while (hasNumber()) {
          const rx = num();
          const ry = num();
          const rotation = num();
          const largeArc = num() !== 0;
          const sweep = num() !== 0;
          const x = relative ? cx + num() : num();
          const y = relative ? cy + num() : num();

          flattenArc(
            ensure().points,
            cx,
            cy,
            rx,
            ry,
            rotation,
            largeArc,
            sweep,
            x,
            y,
            tolerance,
          );
          cx = x;
          cy = y;
        }

        break;
      }
      case 'Z': {
        if (current !== null) {
          current.closed = true;
          current.points.push(startX, startY);
        }

        cx = startX;
        cy = startY;
        break;
      }
      default: {
        index += 1;
        break;
      }
    }

    if (upper === 'Z') {
      index += 1;
    } else if (index === indexBefore) {
      index += 1;
    }
  }

  return polylines.filter((polyline) => polyline.points.length >= 4);
}

function flattenCubic(
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  tolerance: number,
  depth: number,
): void {
  if (depth >= 16 || cubicIsFlat(x0, y0, x1, y1, x2, y2, x3, y3, tolerance)) {
    out.push(x3, y3);
    return;
  }

  const x01 = (x0 + x1) / 2;
  const y01 = (y0 + y1) / 2;
  const x12 = (x1 + x2) / 2;
  const y12 = (y1 + y2) / 2;
  const x23 = (x2 + x3) / 2;
  const y23 = (y2 + y3) / 2;
  const x012 = (x01 + x12) / 2;
  const y012 = (y01 + y12) / 2;
  const x123 = (x12 + x23) / 2;
  const y123 = (y12 + y23) / 2;
  const xm = (x012 + x123) / 2;
  const ym = (y012 + y123) / 2;

  flattenCubic(out, x0, y0, x01, y01, x012, y012, xm, ym, tolerance, depth + 1);
  flattenCubic(out, xm, ym, x123, y123, x23, y23, x3, y3, tolerance, depth + 1);
}

function flattenQuadratic(
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  tolerance: number,
  depth: number,
): void {
  const cx1 = x0 + (2 / 3) * (x1 - x0);
  const cy1 = y0 + (2 / 3) * (y1 - y0);
  const cx2 = x2 + (2 / 3) * (x1 - x2);
  const cy2 = y2 + (2 / 3) * (y1 - y2);

  flattenCubic(out, x0, y0, cx1, cy1, cx2, cy2, x2, y2, tolerance, depth);
}

function cubicIsFlat(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  tolerance: number,
): boolean {
  const length =
    distance(x0, y0, x1, y1) +
    distance(x1, y1, x2, y2) +
    distance(x2, y2, x3, y3);
  const chord = distance(x0, y0, x3, y3);

  return length - chord <= tolerance;
}

function flattenArc(
  out: number[],
  x0: number,
  y0: number,
  rxInput: number,
  ryInput: number,
  rotationDegrees: number,
  largeArc: boolean,
  sweep: boolean,
  x: number,
  y: number,
  tolerance: number,
): void {
  let rx = Math.abs(rxInput);
  let ry = Math.abs(ryInput);

  if (rx === 0 || ry === 0) {
    out.push(x, y);
    return;
  }

  const phi = (rotationDegrees * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);

  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }

  const sign = largeArc === sweep ? -1 : 1;
  const numerator =
    rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (coef * (rx * y1p)) / ry;
  const cyp = (coef * -(ry * x1p)) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y) / 2;

  const startAngle = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let deltaAngle = angle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );

  if (!sweep && deltaAngle > 0) {
    deltaAngle -= 2 * Math.PI;
  } else if (sweep && deltaAngle < 0) {
    deltaAngle += 2 * Math.PI;
  }

  const radius = Math.max(rx, ry);
  const steps = Math.max(
    2,
    Math.min(256, Math.ceil(Math.abs(deltaAngle) / (tolerance / radius + 0.01))),
  );

  for (let step = 1; step <= steps; step += 1) {
    const theta = startAngle + (deltaAngle * step) / steps;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    out.push(
      cx + rx * cosTheta * cosPhi - ry * sinTheta * sinPhi,
      cy + rx * cosTheta * sinPhi + ry * sinTheta * cosPhi,
    );
  }
}

function angle(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const length = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  const value = Math.acos(Math.min(1, Math.max(-1, dot / length)));

  return ux * vy - uy * vx < 0 ? -value : value;
}

function distance(x0: number, y0: number, x1: number, y1: number): number {
  return Math.hypot(x1 - x0, y1 - y0);
}

function tokenizePath(d: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  let index = 0;

  while (index < d.length) {
    const char = d[index];

    if (char === undefined) {
      break;
    }

    if (/[a-zA-Z]/.test(char)) {
      tokens.push(char);
      index += 1;
      continue;
    }

    if (/[\s,]/.test(char)) {
      index += 1;
      continue;
    }

    const start = index;

    if (char === '+' || char === '-') {
      index += 1;
    }

    let seenDot = false;

    while (index < d.length) {
      const current = d[index];

      if (current === '.') {
        if (seenDot) {
          break;
        }

        seenDot = true;
        index += 1;
        continue;
      }

      if (/[0-9]/.test(current ?? '')) {
        index += 1;
        continue;
      }

      if (current === 'e' || current === 'E') {
        index += 1;

        if (d[index] === '+' || d[index] === '-') {
          index += 1;
        }

        continue;
      }

      break;
    }

    const value = Number.parseFloat(d.slice(start, index));

    if (Number.isFinite(value)) {
      tokens.push(value);
    }
  }

  return tokens;
}
