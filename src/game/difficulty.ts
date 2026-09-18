/** Absolute levels repeat six formations and a boss; difficulty never resets. */
export function cycleForLevel(level: number): number {
  return Math.floor((Math.max(1, Math.floor(level)) - 1) / 7) + 1;
}
export function difficultyForLevel(level: number) {
  const tier = Math.floor((Math.max(1, Math.floor(level)) - 1) / 5);
  const pressure = tier / (tier + 4);
  return {
    ballSpeed: 55 + 30 * pressure,
    formationSpeed: 1 + 0.8 * pressure,
    extraHp: Math.floor((cycleForLevel(level) - 1) / 2),
    attackIntervalScale: 1 - 0.45 * pressure,
    hazardSpeed: 1 + 0.5 * pressure,
  };
}
