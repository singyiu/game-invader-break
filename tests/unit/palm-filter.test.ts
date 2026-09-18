import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "../../src/input/palm-filter";

describe("OneEuroFilter", () => {
  it("reduces stationary input noise without freezing slow movement", () => {
    const filter = new OneEuroFilter({
      minCutoff: 1,
      beta: 0.08,
      derivativeCutoff: 1,
    });
    const raw = [0.5, 0.508, 0.492, 0.507, 0.493, 0.505];
    const filtered = raw.map((value, index) =>
      filter.filter(value, index * 33),
    );
    expect(
      Math.max(...filtered.slice(2)) - Math.min(...filtered.slice(2)),
    ).toBeLessThan(0.01);
    expect(filter.filter(0.58, 220)).toBeGreaterThan(filtered.at(-1)!);
  });

  it("resets cleanly across non-monotonic timestamps", () => {
    const filter = new OneEuroFilter();
    filter.filter(0.2, 100);
    expect(filter.filter(0.8, 90)).toBe(0.8);
  });
});
