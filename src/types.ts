// One editable node on the path: the anchor point plus any control handles
// that belong to it. We normalize all commands to absolute coordinates and
// collapse H/V/S/T into their L/C/Q equivalents so the editor only has to
// deal with five shapes.

export type Point = { x: number; y: number };

export type MoveNode = { kind: 'M'; p: Point };
export type LineNode = { kind: 'L'; p: Point };
export type CubicNode = { kind: 'C'; c1: Point; c2: Point; p: Point };
export type QuadNode = { kind: 'Q'; c: Point; p: Point };
export type CloseNode = { kind: 'Z' };

export type Node = MoveNode | LineNode | CubicNode | QuadNode | CloseNode;

export type Path = Node[];
