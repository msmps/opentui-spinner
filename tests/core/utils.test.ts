import { describe, expect, it } from "bun:test";
import { createPulse, createWave } from "../../src/utils";

describe("createPulse", () => {
  it("cycles colors at the default speed", () => {
    const pulse = createPulse(["red", "green", "blue"]);

    expect([0, 1, 2, 3, 4].map((frame) => pulse(frame, 0, 5, 1))).toEqual([
      "red",
      "green",
      "blue",
      "red",
      "green",
    ]);
  });

  it("supports fractional and faster speeds", () => {
    const slow = createPulse(["red", "blue"], 0.5);
    const fast = createPulse(["red", "green", "blue"], 2);

    expect([0, 1, 2, 3].map((frame) => slow(frame, 0, 4, 1))).toEqual([
      "red",
      "red",
      "blue",
      "blue",
    ]);
    expect([0, 1, 2].map((frame) => fast(frame, 0, 3, 1))).toEqual([
      "red",
      "blue",
      "green",
    ]);
  });

  it("rejects an empty color palette", () => {
    expect(() => createPulse([])).toThrow(RangeError);
  });
});

describe("createWave", () => {
  it("maps character positions across the supplied colors", () => {
    const wave = createWave(["red", "green", "blue"]);

    expect([0, 1, 2, 3, 4, 5].map((char) => wave(0, char, 1, 6))).toEqual([
      "red",
      "red",
      "green",
      "green",
      "blue",
      "blue",
    ]);
  });

  it("moves and wraps the wave with the frame index", () => {
    const wave = createWave(["red", "blue"]);

    expect([0, 1, 2, 3].map((char) => wave(1, char, 4, 4))).toEqual([
      "red",
      "blue",
      "blue",
      "red",
    ]);
  });

  it("returns the sole color for every position", () => {
    const wave = createWave(["cyan"]);

    expect(wave(20, 10, 30, 12)).toBe("cyan");
  });

  it("rejects an empty color palette", () => {
    expect(() => createWave([])).toThrow(RangeError);
  });
});
