import { describe, expect, it } from "vitest";
import { DwellMenu } from "../../src/ui/dwell-menu";
const choices = [
  { id: "retry", min: 0.08, max: 0.4 },
  { id: "exit", min: 0.6, max: 0.92 },
];
describe("horizontal dwell selection", () => {
  it("requires an uninterrupted second inside a target", () => {
    const menu = new DwellMenu();
    expect(menu.update(0.2, 0, choices).selected).toBeNull();
    expect(menu.update(0.2, 999, choices).selected).toBeNull();
    expect(menu.update(0.2, 1000, choices).selected).toBe("retry");
  });
  it("requires leaving the selected region before firing again", () => {
    const menu = new DwellMenu();
    menu.update(0.2, 0, choices);
    menu.update(0.2, 1000, choices);
    expect(menu.update(0.2, 3000, choices).selected).toBeNull();
    menu.update(0.5, 3001, choices);
    menu.update(0.2, 3002, choices);
    expect(menu.update(0.2, 4002, choices).selected).toBe("retry");
  });
  it("resets dwell during lost tracking and when choices change", () => {
    const menu = new DwellMenu();
    menu.update(0.2, 0, choices);
    menu.update(null, 700, choices);
    expect(menu.update(0.2, 1000, choices).progress).toBe(0);
    menu.update(0.2, 2000, choices);
    menu.reset(true);
    expect(
      menu.update(0.2, 4000, [{ id: "start", min: 0.08, max: 0.4 }]).selected,
    ).toBeNull();
    menu.update(0.5, 4100, choices);
    menu.update(0.2, 4200, choices);
    expect(menu.update(0.2, 5200, choices).selected).toBe("retry");
  });
});
