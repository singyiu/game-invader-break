import type { PowerKind, TimedPowerKind } from "../shared/contracts";
export const POWER_LABELS: Record<PowerKind, { name: string; short: string }> =
  {
    giant: { name: "Giant Ball", short: "Giant" },
    wide: { name: "Wide Paddles", short: "Wide" },
    multi: { name: "Multiball", short: "Multi" },
    fire: { name: "Fireball", short: "Fire" },
    shield: { name: "Shield Repair", short: "Repair" },
  };
export const HUD_POWERS: TimedPowerKind[] = ["giant", "wide", "multi", "fire"];
