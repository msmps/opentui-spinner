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
import {
  MAX_SPINNER_INTERVAL,
  MIN_SPINNER_INTERVAL,
  SpinnerScheduler,
  setSpinnerSchedulerClockForTesting,
} from "../../src/scheduler";
import { FakeSchedulerClock } from "./fake-scheduler-clock";

type EncodedFrame = NonNullable<ReturnType<RenderLib["encodeUnicode"]>>;

let setup: TestRendererSetup;
let renderer: TestRenderer;
let clock: FakeSchedulerClock;

beforeEach(async () => {
  clock = new FakeSchedulerClock();
  setSpinnerSchedulerClockForTesting(clock);

  setup = await createTestRenderer({ width: 20, height: 4 });
  renderer = setup.renderer;
});

afterEach(() => {
  renderer.destroy();
  setSpinnerSchedulerClockForTesting(undefined);
  mock.restore();
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
    expect(clock.callbacks).toHaveLength(0);
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

  it("accepts inclusive 1-60 FPS interval boundaries", () => {
    const fastest = createSpinner({ interval: MIN_SPINNER_INTERVAL });
    const slowest = createSpinner({ interval: MAX_SPINNER_INTERVAL });

    expect(fastest.interval).toBe(MIN_SPINNER_INTERVAL);
    expect(slowest.interval).toBe(MAX_SPINNER_INTERVAL);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["faster than 60 FPS", MIN_SPINNER_INTERVAL - 0.001],
    ["slower than 1 FPS", MAX_SPINNER_INTERVAL + 0.001],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
  ])("rejects a %s interval", (_description, interval) => {
    expect(
      () => new SpinnerRenderable(renderer, { interval, autoplay: false }),
    ).toThrow(RangeError);
    expect(clock.activeTimers).toBe(0);
  });

  it("keeps all built-in spinner intervals within the supported range", () => {
    for (const spinner of Object.values(spinners)) {
      expect(spinner.interval).toBeGreaterThanOrEqual(MIN_SPINNER_INTERVAL);
      expect(spinner.interval).toBeLessThanOrEqual(MAX_SPINNER_INTERVAL);
    }
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

  it("reuses parsed static colors across characters and renders", async () => {
    createSpinner({
      frames: ["AB"],
      color: "#ff0000",
      backgroundColor: "#001122",
    });
    const drawChar = spyOn(OptimizedBuffer.prototype, "drawChar");

    await setup.renderOnce();
    await setup.renderOnce();

    const calls = drawChar.mock.calls.filter(
      (call) => call[0] === "A".charCodeAt(0) || call[0] === "B".charCodeAt(0),
    );
    expect(calls.length).toBeGreaterThanOrEqual(4);
    expect(new Set(calls.map((call) => call[3])).size).toBe(1);
    expect(new Set(calls.map((call) => call[4])).size).toBe(1);
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
  it.each([
    ["zero", 0],
    ["negative", -1],
    ["faster than 60 FPS", MIN_SPINNER_INTERVAL - 0.001],
    ["slower than 1 FPS", MAX_SPINNER_INTERVAL + 0.001],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
  ])(
    "rejects a %s interval update without changing a running spinner",
    (_description, interval) => {
      const spinner = createSpinner({ interval: 80 });
      spinner.start();

      expect(() => {
        spinner.interval = interval;
      }).toThrow(RangeError);
      expect(spinner.interval).toBe(80);
      expect(clock.activeTimers).toBe(1);
      expect(clock.callbacks).toHaveLength(1);
      expect(clock.cleared).toHaveLength(0);
    },
  );

  it("accepts inclusive interval boundary updates", () => {
    const spinner = createSpinner({ interval: 80 });

    spinner.interval = MIN_SPINNER_INTERVAL;
    expect(spinner.interval).toBe(MIN_SPINNER_INTERVAL);

    spinner.interval = MAX_SPINNER_INTERVAL;
    expect(spinner.interval).toBe(MAX_SPINNER_INTERVAL);
  });

  it("advances frames, wraps, and requests rendering", async () => {
    const spinner = new SpinnerRenderable(renderer, {
      frames: ["A", "B"],
      interval: 75,
      autoplay: true,
    });
    renderer.root.add(spinner);
    const requestRender = spyOn(spinner, "requestRender");

    expect(clock.delays).toEqual([75]);
    await setup.renderOnce();
    expect(firstLine()).toContain("A");
    requestRender.mockClear();

    clock.advance(75);
    expect(requestRender).toHaveBeenCalledTimes(1);
    await setup.renderOnce();
    expect(firstLine()).toContain("B");

    clock.advance(75);
    await setup.renderOnce();
    expect(firstLine()).toContain("A");
  });

  it("starts and stops idempotently", () => {
    const spinner = createSpinner({ frames: ["A", "B"] });

    spinner.start();
    spinner.start();
    expect(clock.callbacks).toHaveLength(1);

    spinner.stop();
    spinner.stop();
    expect(clock.cleared).toHaveLength(1);
  });

  it("replaces a running interval but leaves a stopped spinner stopped", () => {
    const spinner = createSpinner({ frames: ["A", "B"], interval: 100 });

    spinner.interval = 50;
    expect(clock.callbacks).toHaveLength(0);

    spinner.start();
    spinner.interval = 25;
    expect(clock.cleared).toHaveLength(1);
    expect(clock.delays).toEqual([50, 25]);
  });

  it("restarts a running spinner with a named spinner's interval", () => {
    const spinner = createSpinner({ frames: ["A", "B"], interval: 100 });
    spinner.start();

    spinner.name = "line";

    expect(clock.cleared).toHaveLength(1);
    expect(clock.delays).toEqual([100, spinners.line.interval]);
    expect(spinner.frames).toEqual(spinners.line.frames);
  });

  it("supports reactive autoplay changes", () => {
    const spinner = createSpinner({ frames: ["A", "B"] });

    spinner.autoplay = true;
    spinner.autoplay = true;
    expect(clock.callbacks).toHaveLength(1);

    spinner.autoplay = false;
    spinner.autoplay = false;
    expect(clock.cleared).toHaveLength(1);
  });

  it("resets the current frame when frames are replaced", async () => {
    const spinner = createSpinner({ frames: ["A", "B", "C"] });
    spinner.start();
    clock.advance(spinner.interval * 2);
    spinner.frames = ["X"];

    await setup.renderOnce();
    expect(firstLine()).toContain("X");
  });

  it("preserves the current frame when an equivalent frame array is assigned", async () => {
    const spinner = createSpinner({ frames: ["A", "B", "C"] });
    spinner.start();
    clock.advance(spinner.interval * 2);
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
    expect(clock.cleared).toHaveLength(2);
    expect(clock.callbacks).toHaveLength(3);
    encodeUnicode.mockRestore();
    freeUnicode.mockRestore();
    await setup.renderOnce();
    expect(firstLine()).toContain("C");
  });

  it("preserves the current frame when the effective name is unchanged", async () => {
    const spinner = createSpinner({ name: "line" });
    spinner.start();
    clock.advance(spinner.interval);
    const lib = spinnerRenderLib(spinner);
    const encodeUnicode = spyOn(lib, "encodeUnicode");
    const freeUnicode = spyOn(lib, "freeUnicode");
    const requestRender = spyOn(spinner, "requestRender");

    spinner.name = "line";

    expect(spinner.name).toBe("line");
    expect(encodeUnicode).not.toHaveBeenCalled();
    expect(freeUnicode).not.toHaveBeenCalled();
    expect(requestRender).not.toHaveBeenCalled();
    expect(clock.cleared).toHaveLength(1);
    expect(clock.callbacks).toHaveLength(2);
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
      interval: 20,
    });
    spinner.start();
    clock.advance(spinner.interval);
    const lib = spinnerRenderLib(spinner);
    const encodeUnicode = spyOn(lib, "encodeUnicode");
    const freeUnicode = spyOn(lib, "freeUnicode");

    spinner.name = "line";

    expect(spinner.name).toBe("line");
    expect(clock.cleared).toHaveLength(2);
    expect(clock.delays).toEqual([20, 20, spinners.line.interval]);
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
      interval: 20,
    });

    spinner.name = "line";

    expect(spinner.name).toBe("line");
    expect(spinner.frames).toEqual(spinners.line.frames);
    expect(spinner.interval).toBe(spinners.line.interval);
    expect(clock.callbacks).toHaveLength(0);
    expect(clock.cleared).toHaveLength(0);
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
    expect(clock.cleared).toHaveLength(0);
    expect(clock.callbacks).toHaveLength(1);
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
    clock.advance(spinner.interval);

    spinner.frames = [];

    await setup.renderOnce();
    expect(spinner.frames).toEqual(spinners.dots.frames);
    expect(spinner.width).toBeGreaterThan(0);
    expect(firstLine().trim()).toBe(spinners.dots.frames[0]);
    clock.advance(spinner.interval);
    await setup.renderOnce();
    expect(firstLine().trim()).toBe(spinners.dots.frames[1]);
  });
});

describe("shared spinner scheduler", () => {
  it("restores scheduling and advances other spinners when a callback throws", () => {
    const schedulerClock = new FakeSchedulerClock();
    const scheduler = new SpinnerScheduler(schedulerClock);
    const failure = new Error("render failed");
    let healthyAdvances = 0;

    scheduler.start({}, 20, () => {
      throw failure;
    });
    scheduler.start({}, 20, () => healthyAdvances++);

    expect(() => schedulerClock.advance(20)).toThrow(failure);
    expect(healthyAdvances).toBe(1);
    expect(schedulerClock.activeTimers).toBe(1);
    expect(schedulerClock.maxActiveTimers).toBe(1);

    expect(() => schedulerClock.advance(20)).toThrow(failure);
    expect(healthyAdvances).toBe(2);
    expect(schedulerClock.activeTimers).toBe(1);
  });

  it("reports multiple callback failures after restoring scheduling", () => {
    const schedulerClock = new FakeSchedulerClock();
    const scheduler = new SpinnerScheduler(schedulerClock);
    const failures = [new Error("first"), new Error("second")];

    scheduler.start({}, 20, () => {
      throw failures[0];
    });
    scheduler.start({}, 20, () => {
      throw failures[1];
    });

    let thrown: unknown;
    try {
      schedulerClock.advance(20);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors).toEqual(failures);
    expect(schedulerClock.activeTimers).toBe(1);
    expect(schedulerClock.maxActiveTimers).toBe(1);
  });

  it("isolates callback failures in a dense batch", () => {
    const schedulerClock = new FakeSchedulerClock();
    const scheduler = new SpinnerScheduler(schedulerClock);
    const failure = new Error("dense failure");
    let attempts = 0;

    for (let index = 0; index < 100; index++) {
      scheduler.start({}, 20, () => {
        attempts++;
        if (index === 50) throw failure;
      });
    }

    expect(() => schedulerClock.advance(20)).toThrow(failure);
    expect(attempts).toBe(100);
    expect(schedulerClock.activeTimers).toBe(1);
    expect(schedulerClock.maxActiveTimers).toBe(1);
  });

  it("uses one active interval for multiple spinners", () => {
    const first = createSpinner({ frames: ["A", "B"], interval: 80 });
    const second = createSpinner({ frames: ["X", "Y"], interval: 80 });
    const firstRender = spyOn(first, "requestRender");
    const secondRender = spyOn(second, "requestRender");

    first.start();
    second.start();

    expect(clock.activeTimers).toBe(1);
    expect(clock.maxActiveTimers).toBe(1);
    expect(clock.callbacks).toHaveLength(1);

    clock.advance(80);
    expect(firstRender).toHaveBeenCalledTimes(1);
    expect(secondRender).toHaveBeenCalledTimes(1);
    expect(clock.activeTimers).toBe(1);
    expect(clock.maxActiveTimers).toBe(1);
  });

  it("caps staggered global wake-ups at 60 FPS", () => {
    const first = createSpinner({ frames: ["A", "B"], interval: 20 });
    const second = createSpinner({ frames: ["X", "Y"], interval: 20 });
    const firstRender = spyOn(first, "requestRender");
    const secondRender = spyOn(second, "requestRender");

    first.start();
    clock.advance(10);
    second.start();
    clock.advance(50);

    expect(firstRender).toHaveBeenCalledTimes(2);
    expect(secondRender).toHaveBeenCalledTimes(1);
    expect(clock.firedAt.length).toBeGreaterThanOrEqual(3);
    for (let index = 1; index < clock.firedAt.length; index++) {
      expect(
        clock.firedAt[index] - clock.firedAt[index - 1],
      ).toBeGreaterThanOrEqual(MIN_SPINNER_INTERVAL);
    }
    expect(clock.maxActiveTimers).toBe(1);
  });

  it("supports mixed cadences without scanning them into one cadence", () => {
    const fast = createSpinner({ frames: ["A", "B"], interval: 20 });
    const slow = createSpinner({ frames: ["X", "Y"], interval: 100 });
    const fastRender = spyOn(fast, "requestRender");
    const slowRender = spyOn(slow, "requestRender");

    fast.start();
    slow.start();
    clock.advance(100);

    expect(fastRender).toHaveBeenCalledTimes(5);
    expect(slowRender).toHaveBeenCalledTimes(1);
    expect(clock.maxActiveTimers).toBe(1);
  });

  it("preempts a later wake when a newly started spinner is due earlier", () => {
    const slow = createSpinner({ frames: ["A", "B"], interval: 100 });
    const fast = createSpinner({ frames: ["X", "Y"], interval: 20 });
    const slowRender = spyOn(slow, "requestRender");
    const fastRender = spyOn(fast, "requestRender");

    slow.start();
    clock.advance(10);
    fast.start();

    expect(clock.delays).toEqual([100, 20]);
    expect(clock.activeTimers).toBe(1);
    expect(clock.maxActiveTimers).toBe(1);

    clock.advance(20);
    expect(fastRender).toHaveBeenCalledTimes(1);
    expect(slowRender).not.toHaveBeenCalled();
  });

  it("does not reset another spinner when one interval changes", () => {
    const changed = createSpinner({ frames: ["A", "B"], interval: 50 });
    const unchanged = createSpinner({ frames: ["X", "Y"], interval: 100 });
    const changedRender = spyOn(changed, "requestRender");
    const unchangedRender = spyOn(unchanged, "requestRender");

    changed.start();
    unchanged.start();
    clock.advance(20);
    changed.interval = 80;
    clock.advance(80);

    expect(changedRender).toHaveBeenCalledTimes(1);
    expect(unchangedRender).toHaveBeenCalledTimes(1);
  });

  it("compacts stale deadlines after repeated interval changes", () => {
    const earlier = createSpinner({ interval: 20 });
    const spinner = createSpinner({ frames: ["A", "B"], interval: 80 });
    const requestRender = spyOn(spinner, "requestRender");
    earlier.start();
    spinner.start();

    for (let interval = 81; interval <= 110; interval++) {
      spinner.interval = interval;
    }
    earlier.stop();

    expect(clock.activeTimers).toBe(1);
    expect(clock.maxActiveTimers).toBe(1);
    clock.advance(109);
    expect(requestRender).not.toHaveBeenCalled();
    clock.advance(1);
    expect(requestRender).toHaveBeenCalledTimes(1);
  });

  it("keeps the interval alive until the final spinner stops", () => {
    const first = createSpinner({ interval: 80 });
    const second = createSpinner({ interval: 80 });
    first.start();
    second.start();

    first.stop();
    expect(clock.activeTimers).toBe(1);

    second.stop();
    expect(clock.activeTimers).toBe(0);

    first.start();
    expect(clock.activeTimers).toBe(1);
    expect(clock.maxActiveTimers).toBe(1);
  });

  it("ignores stale callbacks after cancellation and restart", () => {
    const spinner = createSpinner({ frames: ["A", "B"], interval: 80 });
    const requestRender = spyOn(spinner, "requestRender");
    spinner.start();
    const staleCallback = clock.callbacks[0];

    spinner.stop();
    spinner.start();
    staleCallback?.();

    expect(requestRender).not.toHaveBeenCalled();
    expect(clock.activeTimers).toBe(1);
    clock.advance(80);
    expect(requestRender).toHaveBeenCalledTimes(1);
  });

  it("gives a restarted spinner a fresh deadline while another remains active", () => {
    const anchor = createSpinner({ interval: 20 });
    const restarted = createSpinner({ frames: ["A", "B"], interval: 100 });
    const requestRender = spyOn(restarted, "requestRender");
    anchor.start();
    restarted.start();

    clock.advance(10);
    restarted.stop();
    restarted.start();

    clock.advance(90);
    expect(requestRender).not.toHaveBeenCalled();
    clock.advance(10);
    expect(requestRender).not.toHaveBeenCalled();
    clock.advance(MIN_SPINNER_INTERVAL);
    expect(requestRender).toHaveBeenCalledTimes(1);
  });

  it("fuzzes restart deadlines with another active spinner", () => {
    let state = 0x5eed1234;
    const random = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };

    for (let iteration = 0; iteration < 500; iteration++) {
      const anchorInterval = 17 + Math.floor(random() * 34);
      const targetInterval = 100 + Math.floor(random() * 901);
      const elapsedBeforeRestart = Math.floor(random() * targetInterval);
      const anchor = createSpinner({ interval: anchorInterval });
      const restarted = createSpinner({ interval: targetInterval });
      const requestRender = spyOn(restarted, "requestRender");

      anchor.start();
      restarted.start();
      clock.advance(elapsedBeforeRestart);
      requestRender.mockClear();
      restarted.stop();
      restarted.start();

      const oldRemaining = targetInterval - elapsedBeforeRestart;
      clock.advance(oldRemaining);
      expect(requestRender).not.toHaveBeenCalled();

      anchor.destroy();
      restarted.destroy();
    }
  });

  it("advances only once after a delayed timer delivery", () => {
    const spinner = createSpinner({ frames: ["A", "B", "C"], interval: 80 });
    const requestRender = spyOn(spinner, "requestRender");
    spinner.start();

    clock.nowValue = 500;
    clock.callbacks[0]?.();

    expect(requestRender).toHaveBeenCalledTimes(1);
    expect(clock.delays.at(-1)).toBe(80);
  });

  it("does not consume the frame budget when a timer fires early", () => {
    const spinner = createSpinner({
      frames: ["A", "B"],
      interval: MIN_SPINNER_INTERVAL,
    });
    const requestRender = spyOn(spinner, "requestRender");
    spinner.start();

    clock.nowValue = 16;
    clock.callbacks[0]?.();

    expect(requestRender).not.toHaveBeenCalled();
    expect(clock.activeTimers).toBe(1);
    expect(clock.delays.at(-1)).toBeCloseTo(MIN_SPINNER_INTERVAL - 16);

    clock.advance(MIN_SPINNER_INTERVAL - 16);
    expect(requestRender).toHaveBeenCalledTimes(1);
  });

  it("advances every overdue spinner once after delayed delivery", () => {
    const fast = createSpinner({ frames: ["A", "B"], interval: 20 });
    const slow = createSpinner({ frames: ["X", "Y"], interval: 100 });
    const fastRender = spyOn(fast, "requestRender");
    const slowRender = spyOn(slow, "requestRender");
    fast.start();
    slow.start();

    clock.nowValue = 500;
    clock.callbacks[0]?.();

    expect(fastRender).toHaveBeenCalledTimes(1);
    expect(slowRender).toHaveBeenCalledTimes(1);
    expect(clock.activeTimers).toBe(1);
    expect(clock.delays.at(-1)).toBe(20);
  });

  it("advances a dense batch once and keeps one timer active", () => {
    const spinners = Array.from({ length: 100 }, () =>
      createSpinner({ frames: ["A", "B"], interval: 80 }),
    );
    const requestRenders = spinners.map((spinner) =>
      spyOn(spinner, "requestRender"),
    );
    for (const spinner of spinners) spinner.start();

    clock.advance(80);

    for (const requestRender of requestRenders) {
      expect(requestRender).toHaveBeenCalledTimes(1);
    }

    clock.advance(80);
    for (const requestRender of requestRenders) {
      expect(requestRender).toHaveBeenCalledTimes(2);
    }
    expect(clock.activeTimers).toBe(1);
    expect(clock.maxActiveTimers).toBe(1);
  });

  it("suspends invisible spinners without changing running intent", () => {
    const spinner = createSpinner({ frames: ["A", "B"], interval: 80 });
    const requestRender = spyOn(spinner, "requestRender");
    spinner.start();
    spinner.visible = false;
    requestRender.mockClear();

    expect(clock.activeTimers).toBe(0);
    clock.advance(800);
    expect(requestRender).not.toHaveBeenCalled();

    spinner.visible = true;
    requestRender.mockClear();
    expect(clock.activeTimers).toBe(1);
    clock.advance(79);
    expect(requestRender).not.toHaveBeenCalled();
    clock.advance(1);

    expect(requestRender).toHaveBeenCalledTimes(1);
  });

  it("does not schedule an invisible autoplay spinner until shown", () => {
    const spinner = new SpinnerRenderable(renderer, {
      frames: ["A", "B"],
      interval: 80,
      autoplay: true,
      visible: false,
    });
    renderer.root.add(spinner);

    expect(clock.activeTimers).toBe(0);

    spinner.visible = true;

    expect(clock.activeTimers).toBe(1);
  });

  it("defers hidden visual updates without requesting renders", () => {
    const spinner = createSpinner({ frames: ["A", "B"] });
    spinner.visible = false;
    const requestRender = spyOn(spinner, "requestRender");

    spinner.frames = ["X", "Y"];
    spinner.name = "line";
    spinner.color = "red";
    spinner.backgroundColor = "blue";

    expect(requestRender).not.toHaveBeenCalled();

    spinner.visible = true;
    expect(requestRender).toHaveBeenCalledTimes(1);
  });

  it("does not restart a destroyed spinner", () => {
    const spinner = createSpinner({ interval: 80 });
    spinner.destroy();

    spinner.start();
    spinner.autoplay = true;

    expect(clock.activeTimers).toBe(0);
  });

  it("isolates render requests and cleanup across multiple renderers", async () => {
    const secondSetup = await createTestRenderer({ width: 20, height: 4 });
    const first = createSpinner({ frames: ["A", "B"], interval: 80 });
    const second = new SpinnerRenderable(secondSetup.renderer, {
      frames: ["X", "Y"],
      interval: 80,
      autoplay: false,
    });
    secondSetup.renderer.root.add(second);
    const firstRender = spyOn(first, "requestRender");
    const secondRender = spyOn(second, "requestRender");

    try {
      first.start();
      second.start();
      expect(clock.activeTimers).toBe(1);

      renderer.destroy();
      expect(first.isDestroyed).toBe(true);
      expect(second.isDestroyed).toBe(false);
      expect(clock.activeTimers).toBe(1);

      clock.advance(80);
      expect(firstRender).not.toHaveBeenCalled();
      expect(secondRender).toHaveBeenCalledTimes(1);
    } finally {
      secondSetup.renderer.destroy();
    }

    expect(clock.activeTimers).toBe(0);
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
      clock.advance(spinner.interval);
      await setup.renderOnce();
      expect(drawChar).not.toHaveBeenCalled();

      clock.advance(spinner.interval);
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
      expect(clock.cleared).toHaveLength(1);
      expect(freeUnicode).toHaveBeenCalledTimes(2);
    } finally {
      freeUnicode.mockRestore();
    }
  });
});
