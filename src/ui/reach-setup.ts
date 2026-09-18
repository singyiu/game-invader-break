import type { Calibration } from "../shared/contracts";
export class ReachSetup {
  private side: "left" | "right" = "left";
  private anchor: number | null = null;
  private enteredAt = 0;
  private left: number | null = null;
  update(
    side: "left" | "right",
    sourceX: number | null,
    now: number,
  ): { done: boolean; progress: number; calibration?: Calibration } {
    if (side !== this.side) {
      this.side = side;
      this.anchor = null;
    }
    const valid =
      sourceX !== null &&
      Number.isFinite(sourceX) &&
      sourceX >= 0 &&
      sourceX <= 1 &&
      (side === "left"
        ? sourceX > 0.52
        : this.left !== null && this.left - sourceX >= 0.15);
    if (!valid) {
      this.anchor = null;
      return { done: false, progress: 0 };
    }
    if (this.anchor === null || Math.abs(sourceX! - this.anchor) > 0.035) {
      this.anchor = sourceX;
      this.enteredAt = now;
    }
    const progress = Math.max(0, Math.min(1, (now - this.enteredAt) / 1000));
    if (progress < 1) return { done: false, progress };
    if (side === "left") {
      this.left = sourceX;
      return { done: true, progress: 1 };
    }
    return {
      done: true,
      progress: 1,
      calibration: { min: sourceX!, max: this.left! },
    };
  }
}
