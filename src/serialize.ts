// Convert a canonical Path AST back to a `d` attribute string.
//
// We always emit absolute commands and a single space separator. Coordinates
// are rounded to `precision` fractional digits (trailing zeros trimmed) so
// edits don't blow up the string with 17-digit floats.

import type { Path, Point } from './types';

export function serializePath(path: Path, precision = 2): string {
  const parts: string[] = [];
  for (const n of path) {
    switch (n.kind) {
      case 'M':
        parts.push(`M ${fmt(n.p, precision)}`);
        break;
      case 'L':
        parts.push(`L ${fmt(n.p, precision)}`);
        break;
      case 'C':
        parts.push(
          `C ${fmt(n.c1, precision)} ${fmt(n.c2, precision)} ${fmt(n.p, precision)}`,
        );
        break;
      case 'Q':
        parts.push(`Q ${fmt(n.c, precision)} ${fmt(n.p, precision)}`);
        break;
      case 'Z':
        parts.push('Z');
        break;
    }
  }
  return parts.join(' ');
}

function fmt(p: Point, precision: number): string {
  return `${num(p.x, precision)} ${num(p.y, precision)}`;
}

function num(n: number, precision: number): string {
  const s = n.toFixed(precision);
  // Strip trailing zeros and a dangling decimal point for readability.
  return s.replace(/\.?0+$/, '');
}
