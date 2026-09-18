import type { PowerKind } from "./contracts";

// One set of filled vector silhouettes drives both the arena meshes and HUD SVGs.
// Coordinates use a 24 × 24 canvas; cutouts use the dark backing color.
export type IconCommand =
  | ["M" | "L", number, number]
  | ["C", number, number, number, number, number, number]
  | ["Z"];
export interface IconShape {
  commands: IconCommand[];
  cutout?: boolean;
}

function polygon(points: [number, number][], cutout = false): IconShape {
  return {
    commands: points.map(([x, y], index) => [index ? "L" : "M", x, y]),
    cutout,
  };
}

function disc(x: number, y: number, radius: number, cutout = false): IconShape {
  const c = radius * 0.552285;
  return {
    cutout,
    commands: [
      ["M", x + radius, y],
      ["C", x + radius, y + c, x + c, y + radius, x, y + radius],
      ["C", x - c, y + radius, x - radius, y + c, x - radius, y],
      ["C", x - radius, y - c, x - c, y - radius, x, y - radius],
      ["C", x + c, y - radius, x + radius, y - c, x + radius, y],
    ],
  };
}

export const POWER_ART: Record<
  PowerKind,
  { color: number; shapes: IconShape[] }
> = {
  giant: {
    color: 0xa970ff,
    shapes: [
      disc(12, 12, 5.6),
      polygon([
        [1, 8],
        [1, 1],
        [8, 1],
        [8, 3.5],
        [5.3, 3.5],
        [8, 6.2],
        [6.2, 8],
        [3.5, 5.3],
        [3.5, 8],
      ]),
      polygon([
        [23, 16],
        [23, 23],
        [16, 23],
        [16, 20.5],
        [18.7, 20.5],
        [16, 17.8],
        [17.8, 16],
        [20.5, 18.7],
        [20.5, 16],
      ]),
    ],
  },
  wide: {
    color: 0x45e4ed,
    shapes: [
      polygon([
        [1, 7],
        [6, 2],
        [6, 5.5],
        [18, 5.5],
        [18, 2],
        [23, 7],
        [18, 12],
        [18, 8.5],
        [6, 8.5],
        [6, 12],
      ]),
      polygon([
        [4, 15],
        [20, 15],
        [22, 17],
        [22, 20],
        [2, 20],
        [2, 17],
      ]),
    ],
  },
  multi: {
    color: 0x3c83ff,
    shapes: [disc(12, 5.5, 4.5), disc(5, 18, 4.5), disc(19, 18, 4.5)],
  },
  fire: {
    color: 0xff741c,
    shapes: [
      {
        commands: [
          ["M", 13, 0.5],
          ["C", 13.5, 6, 20, 6.5, 18.5, 12],
          ["C", 21, 11, 21, 8, 21, 8],
          ["C", 26, 16, 20, 23.5, 12, 23.5],
          ["C", 3, 23.5, 0, 17, 3.5, 11],
          ["C", 4, 14, 6, 14.5, 6.5, 14.5],
          ["C", 5, 8, 11, 7, 13, 0.5],
        ],
      },
      disc(12, 16, 4, true),
    ],
  },
  shield: {
    color: 0x50e38a,
    shapes: [
      {
        commands: [
          ["M", 12, 0.8],
          ["L", 22, 4.5],
          ["L", 22, 11],
          ["C", 22, 17, 17, 21, 12, 23.5],
          ["C", 7, 21, 2, 17, 2, 11],
          ["L", 2, 4.5],
        ],
      },
      polygon(
        [
          [10.5, 6],
          [13.5, 6],
          [13.5, 10],
          [17.5, 10],
          [17.5, 13],
          [13.5, 13],
          [13.5, 17],
          [10.5, 17],
          [10.5, 13],
          [6.5, 13],
          [6.5, 10],
          [10.5, 10],
        ],
        true,
      ),
    ],
  },
};

export function powerIconSvg(kind: PowerKind): string {
  const paths = POWER_ART[kind].shapes.map(
    ({ commands, cutout }) =>
      `<path d="${commands.map((command) => command.join(" ")).join(" ")} Z" fill="${cutout ? "var(--power-icon-backing, #06111f)" : "currentColor"}"/>`,
  );
  return `<svg class="power-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths.join("")}</svg>`;
}
