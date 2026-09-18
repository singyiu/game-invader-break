export type SessionPhase =
  | "landing"
  | "loading"
  | "align"
  | "reach-left"
  | "reach-right"
  | "playing"
  | "recover"
  | "suspended"
  | "results"
  | "settings"
  | "error";
export type SessionAction =
  | "enable"
  | "camera-ready"
  | "aligned"
  | "left-set"
  | "right-set"
  | "hidden"
  | "error"
  | "resume"
  | "finish"
  | "settings"
  | "back"
  | "retry"
  | "exit"
  | "recalibrate";
/** Camera connect/disconnect are pointer-accessible. Combat stays hand-controlled. */
export class SessionMachine {
  private interrupted: SessionPhase = "align";
  private settingsReturn: SessionPhase = "results";
  constructor(public phase: SessionPhase = "landing") {}
  send(action: SessionAction): void {
    if (action === "exit") {
      this.phase = "landing";
      this.interrupted = "align";
      return;
    }
    if (action === "hidden" || action === "error") {
      if (
        !["landing", "loading", "suspended", "error", "recover"].includes(
          this.phase,
        )
      )
        this.interrupted = this.phase;
      this.phase = action === "hidden" ? "suspended" : "error";
      return;
    }
    if (
      action === "enable" &&
      ["landing", "suspended", "error"].includes(this.phase)
    ) {
      this.phase = "loading";
      return;
    }
    if (action === "camera-ready" && this.phase === "loading") {
      this.phase = this.interrupted === "align" ? "align" : "recover";
      return;
    }
    if (action === "resume" && this.phase === "recover") {
      this.phase = this.interrupted;
      return;
    }
    if (action === "settings" && this.phase === "results") {
      this.settingsReturn = this.phase;
      this.phase = "settings";
      return;
    }
    if (action === "back" && this.phase === "settings") {
      this.phase = this.settingsReturn;
      return;
    }
    if (action === "recalibrate" && this.phase === "settings") {
      this.phase = "reach-left";
      return;
    }
    const transitions: Partial<
      Record<SessionPhase, Partial<Record<SessionAction, SessionPhase>>>
    > = {
      align: { aligned: "reach-left" },
      "reach-left": { "left-set": "reach-right" },
      "reach-right": { "right-set": "playing" },
      playing: { finish: "results" },
      results: { retry: "playing" },
    };
    this.phase = transitions[this.phase]?.[action] ?? this.phase;
  }
}
