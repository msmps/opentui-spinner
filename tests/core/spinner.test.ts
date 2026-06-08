import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { resolveRenderLib } from "@opentui/core";
import {
  createTestRenderer,
  type TestRenderer,
  type TestRendererSetup,
} from "@opentui/core/testing";
import spinners from "cli-spinners";
import { SpinnerRenderable } from "../../src/index";

let setup: TestRendererSetup;
let renderer: TestRenderer;
let intervalCallbacks: Array<() => void>;
let intervalDelays: number[];
let clearedIntervals: ReturnType<typeof setInterval>[];
let nextIntervalHandle: number;
let originalSetInterval: typeof globalThis.setInterval;
let originalClearInterval: typeof globalThis.clearInterval;

beforeEach(async () => {
  intervalCallbacks = [];
  intervalDelays = [];
  clearedIntervals = [];
  nextIntervalHandle = 1;
  originalSetInterval = globalThis.setInterval;
  originalClearInterval = globalThis.clearInterval;

  globalThis.setInterval = ((callback: () => void, delay?: number) => {
    intervalCallbacks.push(callback);
    intervalDelays.push(delay ?? 0);
    return nextIntervalHandle++ as unknown as ReturnType<typeof setInterval>;
  }) as typeof globalThis.setInterval;
  globalThis.clearInterval = ((handle: ReturnType<typeof setInterval>) => {
    clearedIntervals.push(handle);
  }) as typeof globalThis.clearInterval;

  setup = await createTestRenderer({ width: 20, height: 4 });
  renderer = setup.renderer;
});

afterEach(() => {
  renderer.destroy();
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
});

function createSpinner(
  options: ConstructorParameters<typeof SpinnerRenderable>[1],
): SpinnerRenderable {
  const spinner = new SpinnerRenderable(renderer, {
    autoplay: false,
    ...options,
  });
  renderer.root.add(spinner);
  return spinner;
}

function firstLine(): string {
  return setup.captureCharFrame().split("\n")[0] ?? "";
}

describe("SpinnerRenderable construction", () => {
  it("uses the documented defaults", async () => {
    const spinner = createSpinner({});
    await setup.renderOnce();

    expect(spinner.name).toBeUndefined();
    expect(spinner.frames).toEqual(spinners.dots.frames);
    expect(spinner.interval).toBe(spinners.dots.interval);
    expect(spinner.autoplay).toBe(false);
    expect(spinner.color).toBe("white");
    expect(spinner.backgroundColor).toBe("transparent");
    expect(spinner.height).toBe(1);
    expect(intervalCallbacks).toHaveLength(0);
  });

  it("uses custom frames and interval in preference to a named spinner", () => {
    const spinner = createSpinner({
      name: "line",
      frames: ["A", "B"],
      interval: 17,
    });

    expect(spinner.frames).toEqual(["A", "B"]);
    expect(spinner.interval).toBe(17);
  });

  it("falls back to default frames when constructed with an empty array", async () => {
    const spinner = createSpinner({ frames: [] });

    expect(spinner.frames).toEqual(spinners.dots.frames);
    await setup.renderOnce();
    expect(spinner.width).toBeGreaterThan(0);
    expect(firstLine().trim()).toBe(spinners.dots.frames[0]);
  });
});

describe("SpinnerRenderable rendering", () => {
  it("renders its first frame", async () => {
    createSpinner({ frames: ["AB"] });

    await setup.renderOnce();

    expect(firstLine().slice(0, 2)).toBe("AB");
  });

  it("sizes mixed Unicode frames by terminal-cell width", async () => {
    const spinner = createSpinner({ frames: ["A", "👋", "A👋B"] });

    await setup.renderOnce();

    expect(spinner.width).toBe(4);
    expect(firstLine()).toContain("A");
  });

  it("renders configured foreground and background colors", async () => {
    createSpinner({
      frames: ["X"],
      color: "#ff0000",
      backgroundColor: "#001122",
    });

    await setup.renderOnce();

    const span = setup
      .captureSpans()
      .lines[0]?.spans.find((candidate) => candidate.text.includes("X"));
    expect(span?.fg.toInts()).toEqual([255, 0, 0, 255]);
    expect(span?.bg.toInts()).toEqual([0, 17, 34, 255]);
    expect(span?.width).toBe(1);
  });

  it("calls a color generator for each encoded character", async () => {
    const calls: number[][] = [];
    createSpinner({
      frames: ["AB", "CD"],
      color: (frameIndex, charIndex, totalFrames, totalChars) => {
        calls.push([frameIndex, charIndex, totalFrames, totalChars]);
        return charIndex === 0 ? "red" : "green";
      },
    });

    await setup.renderOnce();

    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.length % 2).toBe(0);
    for (let i = 0; i < calls.length; i += 2) {
      expect(calls.slice(i, i + 2)).toEqual([
        [0, 0, 2, 2],
        [0, 1, 2, 2],
      ]);
    }
    const contentSpans =
      setup.captureSpans().lines[0]?.spans.filter((span) => span.text.trim()) ??
      [];
    expect(contentSpans.map((span) => span.fg.toInts())).toContainEqual([
      255, 0, 0, 255,
    ]);
    expect(contentSpans.map((span) => span.fg.toInts())).toContainEqual([
      0, 128, 0, 255,
    ]);
  });

  it("does not paint while invisible", async () => {
    const spinner = createSpinner({ frames: ["X"] });

    await setup.renderOnce();
    expect(firstLine()).toContain("X");

    spinner.visible = false;
    await setup.renderOnce();
    expect(firstLine()).not.toContain("X");

    spinner.visible = true;
    await setup.renderOnce();
    expect(firstLine()).toContain("X");
  });
});

describe("SpinnerRenderable animation", () => {
  it("advances frames, wraps, and requests rendering", async () => {
    const spinner = new SpinnerRenderable(renderer, {
      frames: ["A", "B"],
      interval: 75,
      autoplay: true,
    });
    renderer.root.add(spinner);
    const requestRender = spyOn(spinner, "requestRender");

    expect(intervalDelays).toEqual([75]);
    await setup.renderOnce();
    expect(firstLine()).toContain("A");
    requestRender.mockClear();

    intervalCallbacks[0]?.();
    expect(requestRender).toHaveBeenCalledTimes(1);
    await setup.renderOnce();
    expect(firstLine()).toContain("B");

    intervalCallbacks[0]?.();
    await setup.renderOnce();
    expect(firstLine()).toContain("A");
  });

  it("starts and stops idempotently", () => {
    const spinner = createSpinner({ frames: ["A", "B"] });

    spinner.start();
    spinner.start();
    expect(intervalCallbacks).toHaveLength(1);

    spinner.stop();
    spinner.stop();
    expect(clearedIntervals).toHaveLength(1);
  });

  it("replaces a running interval but leaves a stopped spinner stopped", () => {
    const spinner = createSpinner({ frames: ["A", "B"], interval: 100 });

    spinner.interval = 50;
    expect(intervalCallbacks).toHaveLength(0);

    spinner.start();
    spinner.interval = 25;
    expect(clearedIntervals).toHaveLength(1);
    expect(intervalDelays).toEqual([50, 25]);
  });

  it("restarts a running spinner with a named spinner's interval", () => {
    const spinner = createSpinner({ frames: ["A", "B"], interval: 100 });
    spinner.start();

    spinner.name = "line";

    expect(clearedIntervals).toHaveLength(1);
    expect(intervalDelays).toEqual([100, spinners.line.interval]);
    expect(spinner.frames).toEqual(spinners.line.frames);
  });

  it("supports reactive autoplay changes", () => {
    const spinner = createSpinner({ frames: ["A", "B"] });

    spinner.autoplay = true;
    spinner.autoplay = true;
    expect(intervalCallbacks).toHaveLength(1);

    spinner.autoplay = false;
    spinner.autoplay = false;
    expect(clearedIntervals).toHaveLength(1);
  });

  it("resets the current frame when frames are replaced", async () => {
    const spinner = createSpinner({ frames: ["A", "B", "C"] });
    spinner.start();
    intervalCallbacks[0]?.();
    intervalCallbacks[0]?.();
    spinner.frames = ["X"];

    await setup.renderOnce();
    expect(firstLine()).toContain("X");
  });
});

describe("SpinnerRenderable updates and cleanup", () => {
  it("requests rendering for visual property changes", () => {
    const spinner = createSpinner({ frames: ["A"] });
    const requestRender = spyOn(spinner, "requestRender");

    spinner.color = "red";
    spinner.backgroundColor = "blue";
    spinner.frames = ["B"];
    spinner.name = "line";

    expect(requestRender).toHaveBeenCalledTimes(4);
  });

  it("frees each unique encoded frame when frames change and on destroy", () => {
    const lib = resolveRenderLib();
    const freeUnicode = spyOn(lib, "freeUnicode");
    try {
      const spinner = createSpinner({ frames: ["A", "A", "B"] });

      spinner.frames = ["C"];
      expect(freeUnicode).toHaveBeenCalledTimes(2);

      spinner.destroy();
      expect(freeUnicode).toHaveBeenCalledTimes(3);
    } finally {
      freeUnicode.mockRestore();
    }
  });

  it("clears its interval and encoded frames exactly once when destroyed", () => {
    const lib = resolveRenderLib();
    const freeUnicode = spyOn(lib, "freeUnicode");
    try {
      const spinner = createSpinner({ frames: ["A", "B"] });
      spinner.start();

      spinner.destroy();
      spinner.destroy();

      expect(spinner.isDestroyed).toBe(true);
      expect(clearedIntervals).toHaveLength(1);
      expect(freeUnicode).toHaveBeenCalledTimes(2);
    } finally {
      freeUnicode.mockRestore();
    }
  });
});
