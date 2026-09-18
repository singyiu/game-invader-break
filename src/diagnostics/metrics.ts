/** Fixed-memory, one-millisecond histograms. No images, joints, or motion traces are retained. */
class Histogram {
  private bins = new Uint32Array(2001);
  private count = 0;
  add(value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    this.bins[Math.min(2000, Math.ceil(value))]++;
    this.count++;
  }
  summary() {
    const percentile = (fraction: number) => {
      if (!this.count) return 0;
      let total = 0;
      for (let i = 0; i < this.bins.length; i++) {
        total += this.bins[i];
        if (total >= Math.ceil(this.count * fraction)) return i;
      }
      return 2000;
    };
    return {
      count: this.count,
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      overflowBucketMs: 2000,
    };
  }
}
export class MetricsCollector {
  private ages = new Histogram();
  private inferenceTimes = new Histogram();
  private intervals = new Histogram();
  private activeWallMs = 0;
  private trackingPauseMs = 0;
  private currentPause = 0;
  private interruptions = 0;
  inference(age: number, ms: number): void {
    if (!Number.isFinite(age) || age < 0 || !Number.isFinite(ms) || ms < 0)
      return;
    this.ages.add(age);
    this.inferenceTimes.add(ms);
  }
  frame(ms: number, active: boolean, paused: boolean): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.intervals.add(ms);
    if (!active) {
      this.endPause();
      return;
    }
    this.activeWallMs += ms;
    if (paused) {
      this.trackingPauseMs += ms;
      this.currentPause += ms;
    } else this.endPause();
  }
  private endPause(): void {
    if (this.currentPause > 150) this.interruptions++;
    this.currentPause = 0;
  }
  reset(): void {
    this.ages = new Histogram();
    this.inferenceTimes = new Histogram();
    this.intervals = new Histogram();
    this.activeWallMs = 0;
    this.trackingPauseMs = 0;
    this.currentPause = 0;
    this.interruptions = 0;
  }
  summary() {
    return {
      resultAgeMs: this.ages.summary(),
      inferenceMs: this.inferenceTimes.summary(),
      frameIntervalMs: this.intervals.summary(),
      activeWallMs: this.activeWallMs,
      trackingPauseMs: this.trackingPauseMs,
      trackingPausePercent: this.activeWallMs
        ? (this.trackingPauseMs / this.activeWallMs) * 100
        : 0,
      interruptionsOver150ms:
        this.interruptions + (this.currentPause > 150 ? 1 : 0),
    };
  }
}
