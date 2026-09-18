import { cycleForLevel } from "../game/difficulty";
import type { SessionPhase } from "../app/session-machine";
import type { GameState, PlayerSettings } from "../shared/contracts";
import type { DwellChoice } from "./dwell-menu";
import { icon } from "./shell";
import { reachGuide } from "./reach-guide";
export interface MenuItem {
  id: string;
  title: string;
  caption: string;
}
export interface OverlayContext {
  phase: SessionPhase;
  game: GameState;
  error: string;
  loading: string;
  settings: PlayerSettings;
  settingsPage: number;
  finish: string;
  unlocks: string[];
  paused: boolean;
  needsDwell: boolean;
  hands: number;
  cameraRecover: boolean;
  wallSeconds: number;
  best: number;
  bestLevel?: number;
}
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const step = (n: number) =>
  `<div class="step-indicator">${[0, 1, 2].map((i) => `<i class="${i <= n ? "active" : ""}"></i>`).join("")}</div>`;
export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
export class Overlay {
  private key = "";
  choices: DwellChoice[] = [];
  constructor(private element: HTMLElement) {}
  show(context: OverlayContext): boolean {
    const c = context,
      g = c.game;
    const key = [
      c.phase,
      c.error,
      c.loading,
      c.settingsPage,
      c.finish,
      JSON.stringify(c.settings),
      c.paused,
      c.needsDwell,
      c.hands > 0,
      g.status,
      c.cameraRecover,
      g.status === "rest" ? g.wave : 0,
    ].join("|");
    if (key === this.key) return false;
    this.key = key;
    let body = "",
      items: MenuItem[] = [];
    const title = (eyebrow: string, heading: string, copy: string) =>
      `<div class="eyebrow">${eyebrow}</div><h2>${heading}</h2><p>${copy}</p>`;
    const center = (
      id: string,
      title: string,
      caption = "HOLD YOUR HAND HERE",
    ) => {
      items = [{ id, title, caption }];
    };
    switch (c.phase) {
      case "landing":
        break;
      case "loading":
        body = `<div class="loading-orbit"></div>${title("ESTABLISHING CONTROL LINK", "One moment. Your orbit awaits.", escape(c.loading))}<p class="subtle">Preparing local hand tracking. The first load may take a few seconds.</p>`;
        break;
      case "error":
        body =
          title(
            "CONTROL LINK INTERRUPTED",
            "Camera needs attention",
            "Your game is safely paused.",
          ) +
          `<p class="error-detail">${escape(c.error)}</p><button class="primary-button" data-camera-retry>${icon.camera}Try camera again</button><p class="subtle">Use your browser’s camera controls, then try again.</p>`;
        break;
      case "suspended":
        body =
          title(
            "CAMERA RELEASED",
            "Welcome back, defender.",
            "The camera stopped when you left this tab. Reconnect to continue safely.",
          ) +
          `<button class="primary-button" data-camera-retry>${icon.camera}Reconnect camera</button>`;
        break;
      case "align":
        body =
          step(0) +
          `<div class="setup-symbol">${icon.hand}</div>` +
          title(
            "01 / FIND YOUR HAND",
            "A little movement.<br/><em>A lot of possibility.</em>",
            "Rest your elbow. Bring one relaxed hand into view.<br/>Move it toward the center and hold for one second.",
          );
        center("aligned", "Hand in the center");
        break;
      case "reach-left":
      case "reach-right": {
        const left = c.phase === "reach-left";
        const direction = left ? "left" : "right";
        const label = left ? "Left" : "Right";
        const highlighted = `<strong class="reach-direction" data-direction="${direction}">${label}</strong>`;
        body =
          step(left ? 1 : 2) +
          title(
            `0${left ? 2 : 3} / SET YOUR REACH`,
            `Move your hand to the ${highlighted}.`,
            `Use the ${highlighted} side of your camera view.<br/>A small, comfortable movement is enough.`,
          ) +
          reachGuide(direction) +
          `<p>Hold still for <strong>1 second</strong>.</p><div class="setup-progress reach-progress" data-direction="${direction}"><i id="reach-progress"></i></div><small id="reach-feedback">${left ? "Next: set your right reach." : "Your game starts automatically after this step."}</small>`;
        break;
      }
      case "recover":
        body = title(
          "CONTROL LINK RESTORED",
          "Ready when you are.",
          "Bring your hand to the center. Your run will continue safely.",
        );
        center("recover", "Resume");
        break;
      case "results": {
        body =
          title(
            g.status === "won" ? "MISSION COMPLETE" : "TRANSMISSION ENDED",
            g.status === "won" ? "Orbit secured." : "The line will hold again.",
            g.status === "won"
              ? "The Eclipse Engine is silent. Your hands made the difference."
              : escape(damageCopy(g.lastDamage)),
          ) +
          `<div class="result-stats"><span><b>${g.score.toLocaleString()}</b><small>SCORE</small></span><span><b>${formatTime(g.time)}</b><small>ACTIVE TIME</small></span><span><b>${g.wave}</b><small>LEVEL REACHED</small></span></div><p class="result-record">${g.score >= c.best ? "PERSONAL BEST" : "LOCAL BEST " + c.best.toLocaleString()} · ${g.controlHistory === "mixed" ? "MIXED CONTROL" : g.controlHistory === "two" ? "TWO HANDS" : "ONE HAND"}</p><p class="subtle">${formatTime(c.wallSeconds)} elapsed · Best level ${c.bestLevel ?? g.wave}</p>`;
        if (g.bossesDefeated > 0 || g.status === "won")
          body += `<p class="result-record">${g.bossesDefeated || 1} BOSS${g.bossesDefeated > 1 ? "ES" : ""} DEFEATED · ${g.perfectBossClears > 0 || (g.status === "won" && g.shields === 3) ? "ECLIPSE" : "AURORA"} FINISH EARNED</p>`;
        items = [
          { id: "retry", title: "One more run", caption: "RETRY" },
          { id: "settings", title: "Settings", caption: "REFINE YOUR SETUP" },
          { id: "exit", title: "Stand down", caption: "CAMERA OFF" },
        ];
        break;
      }
      case "settings": {
        const s = c.settings;
        body = title(
          "TUNE YOUR EXPERIENCE",
          "Find your flow.",
          "Move your hand over an option. Hold for one second to change it.",
        );
        items =
          c.settingsPage === 0
            ? [
                {
                  id: "music",
                  title: `Music ${Math.round(s.music * 100)}%`,
                  caption: "CHANGE LEVEL",
                },
                {
                  id: "effects",
                  title: `Sound ${Math.round(s.effects * 100)}%`,
                  caption: "CHANGE LEVEL",
                },
                {
                  id: "reduced",
                  title: s.reducedEffects ? "Calm visuals" : "Full visuals",
                  caption: "TOGGLE EFFECTS",
                },
                { id: "more", title: "More", caption: "REACH & DISPLAY" },
              ]
            : [
                {
                  id: "sensitivity",
                  title:
                    s.sensitivity === "small" ? "Small reach" : "Normal reach",
                  caption: "MOVEMENT RANGE",
                },
                {
                  id: "ui",
                  title: s.uiScale === "large" ? "Large text" : "Normal text",
                  caption: "HUD SCALE",
                },
                {
                  id: "recalibrate",
                  title: "Recalibrate",
                  caption: "RESET YOUR REACH",
                },
                { id: "back", title: "Done", caption: "RETURN" },
              ];
        if (c.settingsPage === 1 && c.unlocks.length)
          items.splice(items.length - 1, 0, {
            id: "finish",
            title:
              c.finish === "standard"
                ? "Cyan finish"
                : c.finish === "aurora"
                  ? "Aurora finish"
                  : "Eclipse finish",
            caption: "COSMETIC ONLY",
          });
        break;
      }
      case "playing": {
        if (c.paused) {
          if (c.needsDwell) {
            body = title(
              "TAKE A BREATH",
              c.hands ? "Your orbit is waiting." : "Hands off. Shields safe.",
              c.hands
                ? "Hold your hand in the center to continue."
                : "Your game is paused. Return a relaxed hand when you’re ready.",
            );
            center(
              "resume",
              "Continue",
              c.hands ? "HOLD IN THE CENTER" : "WAITING FOR YOUR HAND",
            );
          } else if (c.cameraRecover) {
            body = title(
              "SAFETY PAUSE",
              "Let’s catch up.",
              "The display was interrupted. Hold your hand in the center to resume.",
            );
            center("resume", "Continue");
          }
          // Tiny missed-frame and split pauses use the quiet rally notice, no giant overlay.
        } else if (g.status === "rest") {
          const cycleClear = g.wave % 7 === 0;
          body =
            title(
              cycleClear ? "ECLIPSE ENGINE DEFEATED" : "SECTOR SECURED",
              cycleClear
                ? `Cycle ${cycleForLevel(g.wave)} cleared.`
                : `Level ${g.wave} cleared.`,
              `Level ${g.wave + 1} is next. The invasion grows stronger.<br/>Take a breath. Your shields and powers carry forward.`,
            ) +
            `<p class="subtle">Your power timers pause during this break.</p>`;
          center("continue-sector", "Continue", "OR WAIT FOR THE NEXT LEVEL");
        }
        break;
      }
    }
    this.element.hidden = !body;
    this.element.innerHTML = body;
    this.choices = [];
    if (items.length) {
      this.choices = items.map((item, i) => ({
        id: item.id,
        min: items.length === 1 ? 0.34 : (i + 0.08) / items.length,
        max: items.length === 1 ? 0.66 : (i + 0.92) / items.length,
      }));
      this.element.insertAdjacentHTML(
        "beforeend",
        `<div class="dwell-area"><div class="dwell-row ${items.length === 1 ? "dwell-single" : ""}">${items.map((item) => `<div class="dwell-option" data-dwell="${item.id}"><strong>${item.title}</strong><small>${item.caption}</small><i class="fill"></i></div>`).join("")}</div><p class="dwell-hint">MOVE HORIZONTALLY · HOLD TO SELECT · MOVE AWAY TO REARM</p><div class="hand-cursor-rail"><i class="hand-cursor" id="hand-cursor" hidden></i></div></div>`,
      );
    }
    return true;
  }
  progress(active: string | null, progress: number, x: number | null): void {
    for (const element of this.element.querySelectorAll<HTMLElement>(
      "[data-dwell]",
    )) {
      element.classList.toggle("active", element.dataset.dwell === active);
      element.querySelector<HTMLElement>(".fill")!.style.width =
        `${element.dataset.dwell === active ? progress * 100 : 0}%`;
    }
    const cursor = this.element.querySelector<HTMLElement>("#hand-cursor");
    if (cursor) {
      cursor.hidden = x === null;
      if (x !== null) cursor.style.left = `${x * 100}%`;
    }
  }
}
function damageCopy(cause: string): string {
  if (cause.includes("drain"))
    return "The ball slipped past your paddle. A clean return keeps the rally alive.";
  if (
    cause.includes("body") ||
    cause.includes("invader") ||
    cause.includes("diver")
  )
    return "An invader reached your shield. Watch the marked dive lane.";
  return "Hostile fire reached your shield. Watch the diamond shots and their windup.";
}
