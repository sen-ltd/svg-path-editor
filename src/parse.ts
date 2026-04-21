// Parse an SVG path `d` attribute into an absolute-coord, canonical AST.
//
// Normalizations applied:
//   H x     → L x currentY
//   V y     → L currentX y
//   S/s     → C using reflection of the previous cubic control point
//   T/t     → Q using reflection of the previous quadratic control point
//   Relative commands are resolved against the current point
//
// Arcs (A / a) are NOT supported. They can't be expressed as a handful of
// Bezier nodes and the editor UI would need a different gesture. We throw
// on `A` rather than silently dropping data.

import type { Path, Point } from './types';

type Cursor = { pos: number; src: string };

export function parsePath(d: string): Path {
  const cursor: Cursor = { pos: 0, src: d };
  const out: Path = [];

  let currentPoint: Point = { x: 0, y: 0 };
  let subpathStart: Point = { x: 0, y: 0 };
  // Reflection bookkeeping for S and T (empty when previous wasn't C/Q).
  let lastCubicC2: Point | null = null;
  let lastQuadC: Point | null = null;

  while (skipWsAndCommas(cursor), cursor.pos < cursor.src.length) {
    const cmd = cursor.src[cursor.pos++];
    const isRelative = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();

    // Z takes no args, so the implicit-repeat inner loop below would miss
    // it entirely (it gates on "next char is a number"). Handle it here.
    if (upper === 'Z') {
      out.push({ kind: 'Z' });
      currentPoint = subpathStart;
      lastCubicC2 = null;
      lastQuadC = null;
      continue;
    }

    // Multi-pair commands: the first pair uses the given command, but
    // subsequent pairs (until another command letter) implicitly repeat it,
    // with the subtle rule that `M x y x y` → the first is M, the rest are L.
    let firstIteration = true;

    while (true) {
      skipWsAndCommas(cursor);
      if (cursor.pos >= cursor.src.length) break;
      if (isCommandLetter(cursor.src[cursor.pos])) break;

      switch (upper) {
        case 'M': {
          const p = readPoint(cursor);
          const abs = isRelative && !firstIteration
            ? { x: currentPoint.x + p.x, y: currentPoint.y + p.y }
            : isRelative
            ? { x: currentPoint.x + p.x, y: currentPoint.y + p.y }
            : p;
          if (firstIteration) {
            out.push({ kind: 'M', p: abs });
            subpathStart = abs;
          } else {
            out.push({ kind: 'L', p: abs });
          }
          currentPoint = abs;
          lastCubicC2 = null;
          lastQuadC = null;
          break;
        }
        case 'L': {
          const p = readPoint(cursor);
          const abs = isRelative
            ? { x: currentPoint.x + p.x, y: currentPoint.y + p.y }
            : p;
          out.push({ kind: 'L', p: abs });
          currentPoint = abs;
          lastCubicC2 = null;
          lastQuadC = null;
          break;
        }
        case 'H': {
          const x = readNumber(cursor);
          const abs = { x: isRelative ? currentPoint.x + x : x, y: currentPoint.y };
          out.push({ kind: 'L', p: abs });
          currentPoint = abs;
          lastCubicC2 = null;
          lastQuadC = null;
          break;
        }
        case 'V': {
          const y = readNumber(cursor);
          const abs = { x: currentPoint.x, y: isRelative ? currentPoint.y + y : y };
          out.push({ kind: 'L', p: abs });
          currentPoint = abs;
          lastCubicC2 = null;
          lastQuadC = null;
          break;
        }
        case 'C': {
          const c1 = readPoint(cursor);
          const c2 = readPoint(cursor);
          const p = readPoint(cursor);
          const [absC1, absC2, absP] = isRelative
            ? [rel(currentPoint, c1), rel(currentPoint, c2), rel(currentPoint, p)]
            : [c1, c2, p];
          out.push({ kind: 'C', c1: absC1, c2: absC2, p: absP });
          currentPoint = absP;
          lastCubicC2 = absC2;
          lastQuadC = null;
          break;
        }
        case 'S': {
          const c2 = readPoint(cursor);
          const p = readPoint(cursor);
          const [absC2, absP] = isRelative
            ? [rel(currentPoint, c2), rel(currentPoint, p)]
            : [c2, p];
          // S reflects the previous C's c2. If previous wasn't C (or S), the
          // reflection degenerates to the current point per SVG spec.
          const absC1: Point = lastCubicC2
            ? reflect(currentPoint, lastCubicC2)
            : { x: currentPoint.x, y: currentPoint.y };
          out.push({ kind: 'C', c1: absC1, c2: absC2, p: absP });
          currentPoint = absP;
          lastCubicC2 = absC2;
          lastQuadC = null;
          break;
        }
        case 'Q': {
          const c = readPoint(cursor);
          const p = readPoint(cursor);
          const [absC, absP] = isRelative
            ? [rel(currentPoint, c), rel(currentPoint, p)]
            : [c, p];
          out.push({ kind: 'Q', c: absC, p: absP });
          currentPoint = absP;
          lastQuadC = absC;
          lastCubicC2 = null;
          break;
        }
        case 'T': {
          const p = readPoint(cursor);
          const absP: Point = isRelative ? rel(currentPoint, p) : p;
          const absC: Point = lastQuadC
            ? reflect(currentPoint, lastQuadC)
            : { x: currentPoint.x, y: currentPoint.y };
          out.push({ kind: 'Q', c: absC, p: absP });
          currentPoint = absP;
          lastQuadC = absC;
          lastCubicC2 = null;
          break;
        }
        case 'A':
          throw new Error(
            'Arc commands (A/a) are not supported in this editor — convert to cubic béziers first.',
          );
        default:
          throw new Error(`Unknown path command: ${cmd}`);
      }

      firstIteration = false;
    }
  }

  return out;
}

function skipWsAndCommas(cursor: Cursor): void {
  while (cursor.pos < cursor.src.length) {
    const ch = cursor.src[cursor.pos];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ',') {
      cursor.pos++;
    } else {
      break;
    }
  }
}

function isCommandLetter(ch: string): boolean {
  return /[MmLlHhVvCcSsQqTtAaZz]/.test(ch);
}

function readNumber(cursor: Cursor): number {
  skipWsAndCommas(cursor);
  const start = cursor.pos;
  const src = cursor.src;
  // Optional sign
  if (src[cursor.pos] === '+' || src[cursor.pos] === '-') cursor.pos++;
  // Integer part
  while (cursor.pos < src.length && /\d/.test(src[cursor.pos])) cursor.pos++;
  // Fractional part
  if (src[cursor.pos] === '.') {
    cursor.pos++;
    while (cursor.pos < src.length && /\d/.test(src[cursor.pos])) cursor.pos++;
  }
  // Exponent
  if (src[cursor.pos] === 'e' || src[cursor.pos] === 'E') {
    cursor.pos++;
    if (src[cursor.pos] === '+' || src[cursor.pos] === '-') cursor.pos++;
    while (cursor.pos < src.length && /\d/.test(src[cursor.pos])) cursor.pos++;
  }
  const slice = src.slice(start, cursor.pos);
  const n = parseFloat(slice);
  if (!Number.isFinite(n)) {
    throw new Error(`Expected number at position ${start}, got ${JSON.stringify(slice)}`);
  }
  return n;
}

function readPoint(cursor: Cursor): Point {
  const x = readNumber(cursor);
  const y = readNumber(cursor);
  return { x, y };
}

function rel(base: Point, offset: Point): Point {
  return { x: base.x + offset.x, y: base.y + offset.y };
}

function reflect(around: Point, p: Point): Point {
  return { x: 2 * around.x - p.x, y: 2 * around.y - p.y };
}
