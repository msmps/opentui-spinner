import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { OptimizedBuffer, type RenderLib } from "@opentui/core";
import {
  createTestRenderer,
  type TestRenderer,
  type TestRendererSetup,
} from "@opentui/core/testing";
import spinners from "cli-spinners";
import { SpinnerRenderable } from "../../src/index";

type EncodedFrame = NonNullable<ReturnType<RenderLib["encodeUnicode"]>>;

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
  mock.restore();
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

function spinnerRenderLib(spinner: SpinnerRenderable): RenderLib {
  return (spinner as unknown as { _lib: RenderLib })._lib;
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

  it("advances drawing coordinates by each character's terminal width", async () => {
    createSpinner({ frames: ["A👋B"] });
    const drawChar = spyOn(OptimizedBuffer.prototype, "drawChar");

    await setup.renderOnce();

    const coordinates = drawChar.mock.calls.map((call) => call[1]);
    expect(coordinates).toContain(0);
    expect(coordinates).toContain(1);
    expect(coordinates).toContain(3);
    drawChar.mockRestore();
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

  it("preserves the current frame when an equivalent frame array is assigned", async () => {
    const spinner = createSpinner({ frames: ["A", "B", "C"] });
    spinner.start();
    intervalCallbacks[0]?.();
    intervalCallbacks[0]?.();
    const frames = ["A", "B", "C"];
    const lib = spinnerRenderLib(spinner);
    const encodeUnicode = spyOn(lib, "encodeUnicode");
    const freeUnicode = spyOn(lib, "freeUnicode");
    const requestRender = spyOn(spinner, "requestRender");

    spinner.frames = frames;

    expect(spinner.frames).toBe(frames);
    expect(encodeUnicode).not.toHaveBeenCalled();
    expect(freeUnicode).not.toHaveBeenCalled();
    expect(requestRender).not.toHaveBeenCalled();
    expect(clearedIntervals).toHaveLength(0);
    expect(intervalCallbacks).toHaveLength(1);
    encodeUnicode.mockRestore();
    freeUnicode.mockRestore();
    await setup.renderOnce();
    expect(firstLine()).toContain("C");
  });

  it("preserves the current frame when the effective name is unchanged", async () => {
    const spinner = createSpinner({ name: "line" });
    spinner.start();
    intervalCallbacks[0]?.();
    const lib = spinnerRenderLib(spinner);
    const encodeUnicode = spyOn(lib, "encodeUnicode");
    const freeUnicode = spyOn(lib, "freeUnicode");
    const requestRender = spyOn(spinner, "requestRender");

    spinner.name = "line";

    expect(spinner.name).toBe("line");
    expect(encodeUnicode).not.toHaveBeenCalled();
    expect(freeUnicode).not.toHaveBeenCalled();
    expect(requestRender).not.toHaveBeenCalled();
    expect(clearedIntervals).toHaveLength(0);
    expect(intervalCallbacks).toHaveLength(1);
    encodeUnicode.mockRestore();
    freeUnicode.mockRestore();
    await setup.renderOnce();
    expect(firstLine()).toContain(spinners.line.frames[1]);
  });

  it("applies a named spinner when the current custom frames differ", () => {
    const spinner = createSpinner({ name: "line", frames: ["A", "B"] });

    spinner.name = "line";

    expect(spinner.frames).toEqual(spinners.line.frames);
    expect(spinner.interval).toBe(spinners.line.interval);
  });

  it("restarts only the timer when a name changes only the interval", async () => {
    const spinner = createSpinner({
      frames: [...spinners.line.frames],
      interval: 1,
    });
    spinner.start();
    intervalCallbacks[0]?.();
    const lib = spinnerRenderLib(spinner);
    const encodeUnicode = spyOn(lib, "encodeUnicode");
    const freeUnicode = spyOn(lib, "freeUnicode");

    spinner.name = "line";

    expect(spinner.name).toBe("line");
    expect(clearedIntervals).toHaveLength(1);
    expect(intervalDelays).toEqual([1, spinners.line.interval]);
    expect(encodeUnicode).not.toHaveBeenCalled();
    expect(freeUnicode).not.toHaveBeenCalled();
    encodeUnicode.mockRestore();
    freeUnicode.mockRestore();
    await setup.renderOnce();
    expect(firstLine()).toContain(spinners.line.frames[1]);
  });

  it("updates only the interval while stopped when named frames are already active", () => {
    const spinner = createSpinner({
      frames: [...spinners.line.frames],
      interval: 1,
    });

    spinner.name = "line";

    expect(spinner.name).toBe("line");
    expect(spinner.frames).toEqual(spinners.line.frames);
    expect(spinner.interval).toBe(spinners.line.interval);
    expect(intervalCallbacks).toHaveLength(0);
    expect(clearedIntervals).toHaveLength(0);
  });

  it("replaces only frames when a name keeps the same interval", () => {
    const spinner = createSpinner({
      frames: ["A"],
      interval: spinners.line.interval,
    });
    spinner.start();

    spinner.name = "line";

    expect(spinner.name).toBe("line");
    expect(spinner.frames).toEqual(spinners.line.frames);
    expect(clearedIntervals).toHaveLength(0);
    expect(intervalCallbacks).toHaveLength(1);
  });

  it("restores default frames and interval when name is cleared", async () => {
    const spinner = createSpinner({ name: "line" });
    spinner.name = undefined;

    await setup.renderOnce();
    expect(spinner.name).toBeUndefined();
    expect(spinner.frames).toEqual(spinners.dots.frames);
    expect(spinner.interval).toBe(spinners.dots.interval);
    expect(firstLine().trim()).toBe(spinners.dots.frames[0]);
  });

  it("falls back to default frames when frames are cleared dynamically", async () => {
    const spinner = createSpinner({ frames: ["A", "B"] });
    spinner.start();
    intervalCallbacks[0]?.();

    spinner.frames = [];

    await setup.renderOnce();
    expect(spinner.frames).toEqual(spinners.dots.frames);
    expect(spinner.width).toBeGreaterThan(0);
    expect(firstLine().trim()).toBe(spinners.dots.frames[0]);
    intervalCallbacks[0]?.();
    await setup.renderOnce();
    expect(firstLine().trim()).toBe(spinners.dots.frames[1]);
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

  it("renders colors assigned through visual setters", async () => {
    const spinner = createSpinner({ frames: ["X"] });

    spinner.color = "#123456";
    spinner.backgroundColor = "#654321";
    await setup.renderOnce();

    expect(spinner.color).toBe("#123456");
    expect(spinner.backgroundColor).toBe("#654321");
    const span = setup
      .captureSpans()
      .lines[0]?.spans.find((candidate) => candidate.text.includes("X"));
    expect(span?.fg.toInts()).toEqual([18, 52, 86, 255]);
    expect(span?.bg.toInts()).toEqual([101, 67, 33, 255]);
  });

  it("frees each unique encoded frame when frames change and on destroy", () => {
    const spinner = createSpinner({ frames: ["initial"] });
    const lib = spinnerRenderLib(spinner);
    const encodeUnicode = spyOn(lib, "encodeUnicode");
    const freeUnicode = spyOn(lib, "freeUnicode");
    try {
      spinner.frames = ["A", "A", "B"];
      const frameCalls = encodeUnicode.mock.calls.map((call, index) => ({
        text: call[0],
        result: encodeUnicode.mock.results[index]?.value as EncodedFrame,
      }));
      const encodings = frameCalls.map((call) => call.result);

      expect(frameCalls.map((call) => call.text)).toEqual(["A", "B"]);
      freeUnicode.mockClear();

      spinner.frames = ["C"];
      expect(freeUnicode).toHaveBeenCalledTimes(2);
      expect(freeUnicode.mock.calls.map((call) => call[0])).toEqual(encodings);

      spinner.destroy();
      expect(freeUnicode).toHaveBeenCalledTimes(3);
      const cEncoding = encodeUnicode.mock.calls.findIndex(
        (call) => call[0] === "C",
      );
      expect(freeUnicode.mock.calls[2]?.[0]).toBe(
        encodeUnicode.mock.results[cEncoding]?.value as EncodedFrame,
      );
    } finally {
      encodeUnicode.mockRestore();
      freeUnicode.mockRestore();
    }
  });

  it("tracks successful, empty, and failed encodings by identity", async () => {
    const spinner = createSpinner({ frames: ["initial"] });
    const lib = spinnerRenderLib(spinner);
    const failed = null;
    const empty = { ptr: 0 as never, data: [] };
    const successful = {
      ptr: 0 as never,
      data: [{ width: 2, char: 1 }],
    };
    const encodeUnicode = spyOn(lib, "encodeUnicode").mockImplementation(
      (text) => {
        if (text === "failed") return failed;
        if (text === "empty") return empty;
        return successful;
      },
    );
    const freeUnicode = spyOn(lib, "freeUnicode").mockImplementation(
      () => undefined,
    );

    try {
      spinner.frames = ["failed", "empty", "successful"];

      expect(encodeUnicode.mock.calls.map((call) => call[0])).toEqual([
        "failed",
        "empty",
        "successful",
      ]);
      const drawChar = spyOn(OptimizedBuffer.prototype, "drawChar");
      await setup.renderOnce();
      expect(spinner.width).toBe(2);
      expect(drawChar).not.toHaveBeenCalled();

      spinner.start();
      intervalCallbacks[0]?.();
      await setup.renderOnce();
      expect(drawChar).not.toHaveBeenCalled();

      intervalCallbacks[0]?.();
      await setup.renderOnce();
      expect(drawChar).toHaveBeenCalled();
      drawChar.mockRestore();
      freeUnicode.mockClear();
      spinner.destroy();
      expect(encodeUnicode.mock.calls.map((call) => call[0])).toEqual([
        "failed",
        "empty",
        "successful",
      ]);
      expect(freeUnicode.mock.calls.map((call) => call[0])).toEqual([
        empty,
        successful,
      ]);
    } finally {
      encodeUnicode.mockRestore();
      freeUnicode.mockRestore();
    }
  });

  it("clears its interval and encoded frames exactly once when destroyed", () => {
    const spinner = createSpinner({ frames: ["A", "B"] });
    const lib = spinnerRenderLib(spinner);
    const freeUnicode = spyOn(lib, "freeUnicode");
    try {
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
