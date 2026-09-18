import type { EnemyKind } from "../shared/contracts";
export const SECTORS = [
  { name: "Broken Orbit", goal: "Find your angle" },
  { name: "Ember Foundry", goal: "Read the dive. Break the armor." },
  { name: "Eclipse Gate", goal: "Silence the conductors" },
] as const;
export const WAVES: { goal: string; rows: EnemyKind[][] }[] = [
  {
    goal: "Build a rally with the scarab drones",
    rows: [
      ["drone", "drone", "drone", "drone", "drone"],
      ["drone", "drone", "drone", "drone"],
    ],
  },
  {
    goal: "Read a locked shot lane",
    rows: [
      ["drone", "spitter", "drone", "spitter", "drone"],
      ["drone", "drone", "drone", "drone", "drone"],
    ],
  },
  {
    goal: "Interrupt a lancer before its dive",
    rows: [
      ["spitter", "drone", "lancer", "drone", "spitter"],
      ["drone", "lancer", "drone", "lancer", "drone"],
    ],
  },
  {
    goal: "Bank around the bastion armor",
    rows: [
      ["bastion", "spitter", "bastion", "spitter", "bastion"],
      ["drone", "lancer", "drone", "lancer", "drone"],
    ],
  },
  {
    goal: "Break the conductor rhythm",
    rows: [
      ["bastion", "conductor", "spitter", "conductor", "bastion"],
      ["lancer", "drone", "spitter", "drone", "lancer"],
    ],
  },
  {
    goal: "Choose your route to the Eclipse Engine",
    rows: [
      ["conductor", "bastion", "spitter", "bastion", "conductor"],
      ["spitter", "lancer", "bastion", "lancer", "spitter"],
      ["drone", "drone", "drone", "drone", "drone"],
    ],
  },
];
