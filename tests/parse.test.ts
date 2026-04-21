import { describe, it, expect } from 'vitest';
import { parsePath } from '../src/parse';
import { serializePath } from '../src/serialize';
import type { Path } from '../src/types';

function roundTrip(d: string): string {
  return serializePath(parsePath(d));
}

describe('parsePath', () => {
  it('parses simple M L Z', () => {
    expect(parsePath('M 10 20 L 30 40 Z')).toEqual([
      { kind: 'M', p: { x: 10, y: 20 } },
      { kind: 'L', p: { x: 30, y: 40 } },
      { kind: 'Z' },
    ]);
  });

  it('resolves relative moves against the current point', () => {
    expect(parsePath('M 10 10 l 5 0 l 0 5')).toEqual([
      { kind: 'M', p: { x: 10, y: 10 } },
      { kind: 'L', p: { x: 15, y: 10 } },
      { kind: 'L', p: { x: 15, y: 15 } },
    ]);
  });

  it('treats a second M-pair as an implicit L', () => {
    // "M 0 0 10 10" => M 0,0 then L 10,10 (per SVG spec)
    expect(parsePath('M 0 0 10 10')).toEqual([
      { kind: 'M', p: { x: 0, y: 0 } },
      { kind: 'L', p: { x: 10, y: 10 } },
    ]);
  });

  it('normalizes H and V to L', () => {
    expect(parsePath('M 0 0 H 10 V 10')).toEqual([
      { kind: 'M', p: { x: 0, y: 0 } },
      { kind: 'L', p: { x: 10, y: 0 } },
      { kind: 'L', p: { x: 10, y: 10 } },
    ]);
  });

  it('parses cubic bezier', () => {
    expect(parsePath('M 0 0 C 10 0 20 10 30 10')).toEqual([
      { kind: 'M', p: { x: 0, y: 0 } },
      {
        kind: 'C',
        c1: { x: 10, y: 0 },
        c2: { x: 20, y: 10 },
        p: { x: 30, y: 10 },
      },
    ]);
  });

  it('expands S by reflecting the previous cubic control point', () => {
    // C's c2 is (20,10), next anchor starts at (30,10), S reflects c2
    // around (30,10) → c1 = (40, 10)
    const parsed = parsePath('M 0 0 C 10 0 20 10 30 10 S 50 20 60 20');
    expect(parsed[2]).toEqual({
      kind: 'C',
      c1: { x: 40, y: 10 },
      c2: { x: 50, y: 20 },
      p: { x: 60, y: 20 },
    });
  });

  it('parses quadratic bezier', () => {
    expect(parsePath('M 0 0 Q 10 10 20 0')).toEqual([
      { kind: 'M', p: { x: 0, y: 0 } },
      { kind: 'Q', c: { x: 10, y: 10 }, p: { x: 20, y: 0 } },
    ]);
  });

  it('expands T by reflecting the previous quadratic control point', () => {
    // Q's c is (10,10), next anchor at (20,0), T reflects c around (20,0)
    // → new c = (30, -10)
    const parsed = parsePath('M 0 0 Q 10 10 20 0 T 40 0');
    expect(parsed[2]).toEqual({
      kind: 'Q',
      c: { x: 30, y: -10 },
      p: { x: 40, y: 0 },
    });
  });

  it('throws on arcs', () => {
    expect(() => parsePath('M 0 0 A 10 10 0 0 0 20 20')).toThrow(
      /Arc commands/,
    );
  });

  it('handles commas as number separators', () => {
    expect(parsePath('M10,20 L30,40')).toEqual([
      { kind: 'M', p: { x: 10, y: 20 } },
      { kind: 'L', p: { x: 30, y: 40 } },
    ]);
  });

  it('handles decimals with no leading zero', () => {
    expect(parsePath('M .5 .5 L 1 1')).toEqual([
      { kind: 'M', p: { x: 0.5, y: 0.5 } },
      { kind: 'L', p: { x: 1, y: 1 } },
    ]);
  });

  it('resets current point to subpath start after Z', () => {
    // M 10 10 L 20 20 Z M 30 30 — second subpath starts fresh
    const parsed = parsePath('M 10 10 L 20 20 Z M 30 30 l 5 0');
    // Last relative L should be relative to (30,30), not (20,20)
    expect(parsed[4]).toEqual({ kind: 'L', p: { x: 35, y: 30 } });
  });
});

describe('serializePath', () => {
  it('emits absolute commands only', () => {
    const p: Path = [
      { kind: 'M', p: { x: 0, y: 0 } },
      { kind: 'L', p: { x: 10, y: 10 } },
      { kind: 'Z' },
    ];
    expect(serializePath(p)).toBe('M 0 0 L 10 10 Z');
  });

  it('trims trailing zeros after rounding', () => {
    const p: Path = [
      { kind: 'M', p: { x: 1.5, y: 2 } },
      { kind: 'L', p: { x: 3.25, y: 4.125 } },
    ];
    // Precision 2: 1.5 → "1.5", 2 → "2", 3.25 → "3.25", 4.125 → "4.13"
    expect(serializePath(p)).toBe('M 1.5 2 L 3.25 4.13');
  });
});

describe('round-trip', () => {
  it.each([
    'M 0 0 L 10 10 Z',
    'M 100 100 C 150 100 200 150 200 200 Z',
    'M 0 0 Q 50 50 100 0',
    'M 20 20 L 40 20 L 40 40 L 20 40 Z',
  ])('serialize(parse(%s)) stabilizes', (d) => {
    // The first pass may normalize whitespace/case; subsequent passes must
    // be byte-identical.
    const once = serializePath(parsePath(d));
    const twice = roundTrip(once);
    expect(twice).toBe(once);
  });
});
