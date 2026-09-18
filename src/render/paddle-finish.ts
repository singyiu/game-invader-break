export type PaddleFinish = "standard" | "aurora" | "eclipse";

export interface PaddleFinishColors {
  energy: number;
  emissive: number;
  glow: number;
  cap: number;
  trim: number;
}

const FINISH_COLORS: Readonly<Record<PaddleFinish, PaddleFinishColors>> = {
  standard: {
    energy: 0x7eefff,
    emissive: 0x09bad4,
    glow: 0x4de9ff,
    cap: 0xbdd6df,
    trim: 0x547493,
  },
  aurora: {
    energy: 0x9effd8,
    emissive: 0x18d59a,
    glow: 0x6dffc9,
    cap: 0xc8f1df,
    trim: 0x5f9c8b,
  },
  eclipse: {
    energy: 0xdac7ff,
    emissive: 0x9368ff,
    glow: 0xb99aff,
    cap: 0xded3f2,
    trim: 0x81709d,
  },
};

export function getPaddleFinishColors(
  finish: PaddleFinish,
): Readonly<PaddleFinishColors> {
  return FINISH_COLORS[finish];
}
