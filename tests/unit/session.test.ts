import { describe, expect, it } from "vitest";
import { SessionMachine } from "../../src/app/session-machine";

describe("hand-only session lifecycle", () => {
  it("starts combat directly after camera readiness and both reach calibrations", () => {
    const session = new SessionMachine();
    session.send("retry");
    expect(session.phase).toBe("landing");
    session.send("enable");
    expect(session.phase).toBe("loading");
    session.send("camera-ready");
    expect(session.phase).toBe("align");
    session.send("aligned");
    expect(session.phase).toBe("reach-left");
    session.send("left-set");
    expect(session.phase).toBe("reach-right");
    session.send("right-set");
    expect(session.phase).toBe("playing");
  });
  it("releases permission flow on hiding and resumes to the interrupted run", () => {
    const session = new SessionMachine("playing");
    session.send("hidden");
    expect(session.phase).toBe("suspended");
    session.send("enable");
    session.send("camera-ready");
    expect(session.phase).toBe("recover");
    session.send("resume");
    expect(session.phase).toBe("playing");
  });
  it("never resumes a failed initialization into gameplay", () => {
    const session = new SessionMachine();
    session.send("enable");
    session.send("error");
    expect(session.phase).toBe("error");
    session.send("resume");
    expect(session.phase).toBe("error");
    session.send("enable");
    session.send("camera-ready");
    expect(session.phase).toBe("align");
  });
  it("allows hand-driven settings and retry after result", () => {
    const session = new SessionMachine("playing");
    session.send("finish");
    session.send("settings");
    expect(session.phase).toBe("settings");
    session.send("back");
    expect(session.phase).toBe("results");
    session.send("retry");
    expect(session.phase).toBe("playing");
    session.send("exit");
    expect(session.phase).toBe("landing");
  });
});
