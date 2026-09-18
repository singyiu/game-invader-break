import type { EnemyKind } from "../shared/contracts";
export const ENEMIES: Record<
  EnemyKind,
  { width: number; height: number; hp: number; score: number }
> = {
  drone: { width: 6, height: 3.5, hp: 1, score: 100 },
  spitter: { width: 6, height: 4, hp: 1, score: 150 },
  lancer: { width: 4.5, height: 5, hp: 1, score: 200 },
  bastion: { width: 8, height: 4.5, hp: 2, score: 250 },
  conductor: { width: 7, height: 5, hp: 2, score: 300 },
  petal: { width: 13, height: 6, hp: 2, score: 500 },
  core: { width: 14, height: 10, hp: 6, score: 1500 },
};
