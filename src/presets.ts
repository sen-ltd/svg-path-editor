// Starter paths people might want to play with. All use the absolute,
// canonical subset (M/L/C/Q/Z) so they round-trip cleanly through the
// parser.

export type Preset = { name: string; d: string };

export const PRESETS: Preset[] = [
  {
    name: 'Heart',
    d: 'M 100 40 C 60 0 0 40 100 140 C 200 40 140 0 100 40 Z',
  },
  {
    name: 'Star',
    d: 'M 100 20 L 120 80 L 180 80 L 130 120 L 150 180 L 100 140 L 50 180 L 70 120 L 20 80 L 80 80 Z',
  },
  {
    name: 'Arrow',
    d: 'M 20 100 L 140 100 L 140 60 L 200 120 L 140 180 L 140 140 L 20 140 Z',
  },
  {
    name: 'Wave',
    d: 'M 10 100 Q 60 40 110 100 Q 160 160 210 100',
  },
  {
    name: 'Cloud',
    d: 'M 40 140 C 20 140 20 100 50 100 C 50 80 100 60 120 90 C 140 70 180 90 170 120 C 210 120 210 160 170 160 L 60 160 C 20 160 20 140 40 140 Z',
  },
];
