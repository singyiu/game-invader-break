export interface OneEuroOptions {
  minCutoff?: number;
  beta?: number;
  derivativeCutoff?: number;
}

/** Timestamp-aware 1€ low-pass filter. Timestamps use the capture document clock. */
export class OneEuroFilter {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly derivativeCutoff: number;
  private value: number | null = null;
  private derivative = 0;
  private at: number | null = null;

  constructor(options: OneEuroOptions = {}) {
    this.minCutoff = options.minCutoff ?? 1.7;
    this.beta = options.beta ?? 0.08;
    this.derivativeCutoff = options.derivativeCutoff ?? 1;
  }

  filter(next: number, at: number): number {
    if (!Number.isFinite(next) || !Number.isFinite(at)) return this.value ?? 0;
    if (this.value === null || this.at === null || at <= this.at) {
      this.value = next;
      this.derivative = 0;
      this.at = at;
      return next;
    }
    const seconds = Math.max((at - this.at) / 1_000, 1 / 240);
    const rawDerivative = (next - this.value) / seconds;
    const derivativeAlpha = alpha(seconds, this.derivativeCutoff);
    this.derivative += derivativeAlpha * (rawDerivative - this.derivative);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.derivative);
    const valueAlpha = alpha(seconds, cutoff);
    this.value += valueAlpha * (next - this.value);
    this.at = at;
    return this.value;
  }

  reset(): void {
    this.value = null;
    this.derivative = 0;
    this.at = null;
  }
}

function alpha(seconds: number, cutoff: number): number {
  const tau = 1 / (2 * Math.PI * Math.max(cutoff, 0.001));
  return 1 / (1 + tau / seconds);
}
