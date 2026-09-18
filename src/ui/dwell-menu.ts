export interface DwellChoice {
  id: string;
  min: number;
  max: number;
}
export interface DwellState {
  selected: string | null;
  active: string | null;
  progress: number;
}
/** A lost hand cancels dwell. A selected region stays latched until exited. */
export class DwellMenu {
  private active: string | null = null;
  private enteredAt = 0;
  private latched: string | null = null;
  private leaveRequired = false;
  private signature = "";
  reset(requireLeave = false): void {
    this.active = null;
    this.latched = null;
    this.leaveRequired = requireLeave;
  }
  update(x: number | null, now: number, choices: DwellChoice[]): DwellState {
    const signature = choices.map((c) => `${c.id}:${c.min}:${c.max}`).join("|");
    if (signature !== this.signature) {
      this.active = null;
      this.signature = signature;
    }
    const choice =
      x === null || !Number.isFinite(x)
        ? undefined
        : choices.find((c) => x >= c.min && x <= c.max);
    if (!choice) {
      this.reset();
      return { selected: null, active: null, progress: 0 };
    }
    if (this.leaveRequired || this.latched === choice.id)
      return { selected: null, active: choice.id, progress: 0 };
    if (this.latched !== choice.id) this.latched = null;
    if (this.active !== choice.id) {
      this.active = choice.id;
      this.enteredAt = now;
    }
    const progress = Math.max(0, Math.min(1, (now - this.enteredAt) / 1000));
    if (progress === 1) {
      this.latched = choice.id;
      return { selected: choice.id, active: choice.id, progress };
    }
    return { selected: null, active: choice.id, progress };
  }
}
