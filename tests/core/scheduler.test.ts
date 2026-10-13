import { expect, test } from "bun:test";
import { MIN_SPINNER_INTERVAL, SpinnerScheduler } from "../../src/scheduler";
import { FakeSchedulerClock } from "./fake-scheduler-clock";

test("coalesces staggered harmonic spinners without reducing steady-state cadence", () => {
  const clock = new FakeSchedulerClock();
  const scheduler = new SpinnerScheduler(clock);
  const fast = {};
  const slow = {};
  let fastFrames = 0;
  let slowFrames = 0;

  scheduler.start(fast, 40, () => fastFrames++);
  clock.advance(13);
  scheduler.start(slow, 80, () => slowFrames++);
  clock.advance(987);

  const initialFast = fastFrames;
  const initialSlow = slowFrames;
  const initialWakes = clock.firedAt.length;
  clock.advance(10_000);

  expect(fastFrames - initialFast).toBe(250);
  expect(slowFrames - initialSlow).toBe(125);
  expect(clock.firedAt.length - initialWakes).toBe(250);
  expect(clock.maxActiveTimers).toBe(1);

  scheduler.stop(fast);
  scheduler.stop(slow);
  expect(clock.activeTimers).toBe(0);
});

test.each([16, Number.POSITIVE_INFINITY])(
  "keeps harmonic phases aligned after late ticks (dense threshold %s)",
  (threshold) => {
    const clock = new FakeSchedulerClock();
    const scheduler = new SpinnerScheduler(clock, threshold);
    const fast = Array.from({ length: 20 }, () => [] as number[]);
    const slow = Array.from({ length: 20 }, () => [] as number[]);
    for (const frames of fast)
      scheduler.start(frames, 40, () => frames.push(clock.now()));
    clock.advance(13);
    for (const frames of slow)
      scheduler.start(frames, 80, () => frames.push(clock.now()));
    clock.advance(987);
    for (const frames of [...fast, ...slow]) frames.length = 0;

    for (let tick = 0; tick < 250; tick++) {
      const delay = clock.delays.at(-1);
      const callback = clock.callbacks.at(-1);
      if (delay === undefined || !callback) throw new Error("Missing timer");

      clock.nowValue += delay + (tick % 3);
      callback();
    }

    for (const frames of fast) expect(frames).toEqual(fast[0]);
    for (const frames of slow) {
      expect(frames).toEqual(slow[0]);
      expect(frames.every((time) => fast[0].includes(time))).toBe(true);
      expect(frames.length).toBeGreaterThanOrEqual(124);
    }
    expect(fast[0]).toHaveLength(250);
    expect(clock.maxActiveTimers).toBe(1);
    for (const frames of [...fast, ...slow]) scheduler.stop(frames);
    expect(clock.activeTimers).toBe(0);
  },
);

test("preserves non-harmonic target rates within the global wake budget", () => {
  const clock = new FakeSchedulerClock();
  const scheduler = new SpinnerScheduler(clock);
  const first: number[] = [];
  const second: number[] = [];
  scheduler.start(first, 40, () => first.push(clock.now()));
  clock.advance(13);
  scheduler.start(second, 70, () => second.push(clock.now()));
  clock.advance(10_000);

  expect(first.length).toBeGreaterThanOrEqual(249);
  expect(first.length).toBeLessThanOrEqual(251);
  expect(second.length).toBeGreaterThanOrEqual(141);
  expect(second.length).toBeLessThanOrEqual(143);
  for (let index = 1; index < clock.firedAt.length; index++) {
    expect(
      clock.firedAt[index] - clock.firedAt[index - 1],
    ).toBeGreaterThanOrEqual(MIN_SPINNER_INTERVAL - 1e-9);
  }
  scheduler.stop(first);
  scheduler.stop(second);
});

test.each([MIN_SPINNER_INTERVAL, 40 / 1.3])(
  "keeps fractional interval %s advancing at a large clock value",
  (interval) => {
    const clock = new FakeSchedulerClock();
    clock.nowValue = 1_000_000_000;
    const scheduler = new SpinnerScheduler(clock);
    const frames: number[] = [];
    scheduler.start(frames, interval, () => frames.push(clock.now()));
    clock.advance(interval * 10_000);

    expect(frames.length).toBeGreaterThanOrEqual(9_999);
    expect(frames.length).toBeLessThanOrEqual(10_000);
    for (let index = 1; index < frames.length; index++) {
      expect(frames[index] - frames[index - 1]).toBeGreaterThanOrEqual(
        interval / 2,
      );
    }
    expect(clock.maxActiveTimers).toBe(1);
    scheduler.stop(frames);
    expect(clock.activeTimers).toBe(0);
  },
);

test("skips missed deadlines without a short catch-up frame", () => {
  const clock = new FakeSchedulerClock();
  const scheduler = new SpinnerScheduler(clock);
  const frames: number[] = [];
  scheduler.start(frames, 80, () => frames.push(clock.now()));

  clock.nowValue = 550;
  clock.callbacks[0]?.();
  expect(frames).toEqual([550]);
  clock.advance(89);
  expect(frames).toEqual([550]);
  clock.advance(1);
  expect(frames).toEqual([550, 640]);
  scheduler.stop(frames);
});

test("starts a fresh phase when the scheduler becomes idle", () => {
  const clock = new FakeSchedulerClock();
  const scheduler = new SpinnerScheduler(clock);
  const frames: number[] = [];
  scheduler.start(frames, 80, () => frames.push(clock.now()));
  scheduler.stop(frames);
  clock.advance(123);
  scheduler.start(frames, 80, () => frames.push(clock.now()));
  clock.advance(79);
  expect(frames).toEqual([]);
  clock.advance(1);
  expect(frames).toEqual([203]);
  scheduler.stop(frames);
});

test.each([
  [MIN_SPINNER_INTERVAL, 50],
  [40 / 1.3, 80 / 1.3],
])(
  "coalesces fractional harmonic intervals %s and %s",
  (fastInterval, slowInterval) => {
    const clock = new FakeSchedulerClock();
    clock.nowValue = 1_000_000_000;
    const scheduler = new SpinnerScheduler(clock);
    const fast: number[] = [];
    const slow: number[] = [];
    scheduler.start(fast, fastInterval, () => fast.push(clock.now()));
    clock.advance(13);
    scheduler.start(slow, slowInterval, () => slow.push(clock.now()));
    clock.advance(1_000);
    fast.length = 0;
    slow.length = 0;
    clock.advance(10_000);

    expect(slow.length).toBeGreaterThanOrEqual(
      Math.floor(10_000 / slowInterval),
    );
    expect(slow.length).toBeLessThanOrEqual(Math.ceil(10_000 / slowInterval));
    expect(slow.every((time) => fast.includes(time))).toBe(true);
    scheduler.stop(fast);
    scheduler.stop(slow);
  },
);

test.each([1, Number.POSITIVE_INFINITY])(
  "keeps callback lifecycle changes isolated (dense threshold %s)",
  (threshold) => {
    const clock = new FakeSchedulerClock();
    const scheduler = new SpinnerScheduler(clock, threshold);
    const spinners = Array.from({ length: 20 }, () => ({}));
    const frames = spinners.map(() => 0);
    const replacement = {};
    let replacementFrames = 0;
    for (const [index, spinner] of spinners.entries()) {
      scheduler.start(spinner, 80, () => {
        frames[index]++;
        if (index !== 0) return;

        scheduler.stop(spinner);
        scheduler.reschedule(spinners[19], 160);
        scheduler.start(replacement, 80, () => replacementFrames++);
      });
    }

    clock.advance(80);
    expect(frames.slice(0, 19)).toEqual(Array(19).fill(1));
    expect(frames[19]).toBe(0);
    expect(replacementFrames).toBe(0);
    clock.advance(80);
    expect(frames[0]).toBe(1);
    expect(frames.slice(1, 19)).toEqual(Array(18).fill(2));
    expect(frames[19]).toBe(0);
    expect(replacementFrames).toBe(1);
    clock.advance(80);
    expect(frames[19]).toBe(1);
    expect(replacementFrames).toBe(2);
    expect(clock.maxActiveTimers).toBe(1);

    for (const spinner of spinners) scheduler.stop(spinner);
    scheduler.stop(replacement);
    expect(clock.activeTimers).toBe(0);
  },
);

test("can replace the last spinner from its callback", () => {
  const clock = new FakeSchedulerClock();
  const scheduler = new SpinnerScheduler(clock);
  const first = {};
  const replacement = {};
  const frames: number[] = [];
  scheduler.start(first, 80, () => {
    scheduler.stop(first);
    scheduler.start(replacement, 40, () => frames.push(clock.now()));
  });

  clock.advance(119);
  expect(frames).toEqual([]);
  clock.advance(1);
  expect(frames).toEqual([120]);
  scheduler.stop(replacement);
  expect(clock.activeTimers).toBe(0);
});
